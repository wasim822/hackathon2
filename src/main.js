// App bootstrap + game loop.
// Fixed-timestep physics (120 Hz) with an accumulator and a catch-up cap;
// rendering interpolates between the last two physics states.
import * as THREE from 'three';
import { buildCity } from './world/city.js';
import { setupEnvironment, createComposer } from './world/environment.js';
import { updateMaterials } from './world/materials.js';
import { CarPhysics } from './vehicle/carPhysics.js';
import { CarModel } from './vehicle/carModel.js';
import { Effects } from './vehicle/effects.js';
import { findResetSpot } from './vehicle/reset.js';
import { VEHICLES, DEFAULT_VEHICLE } from './config/vehicles.js';
import { SPAWN } from './config/map.js';
import { districtAt } from './config/brands.js';
import { Input } from './input/input.js';
import { CameraController } from './camera/cameraController.js';
import { HUD } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { WebsiteModal } from './ui/modal.js';
import { EngineAudio } from './audio/engineAudio.js';

const FIXED_DT = 1 / 120;
const MAX_STEPS = 12;           // cap catch-up work per frame
const CONTACT_STICKY = 0.25;    // s; contact must lapse this long to count as "separated"
const PROMPT_COOLDOWN = 1.5;    // s after closing a prompt before the same brand can prompt again

const QUALITY = [
  { name: 'High', pr: 1.5, bloom: true },
  { name: 'Medium', pr: 1.0, bloom: true },
  { name: 'Low', pr: 0.75, bloom: false },
];

// ------------------------------------------------------------------ setup
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.info.autoReset = false; // count all passes per frame (stats overlay)

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 2600);
setupEnvironment(scene, renderer);

const city = buildCity(scene);
const params = VEHICLES[DEFAULT_VEHICLE];
const car = new CarPhysics(params, city.colliders);
car.reset(SPAWN.x, SPAWN.z, SPAWN.heading);
const model = new CarModel(params);
scene.add(model.group);
const effects = new Effects(scene);

const input = new Input(canvas);
const camCtl = new CameraController(camera, city.colliders);
const hud = new HUD();
const minimap = new Minimap(document.getElementById('minimap'), city.brands, city.colliders);
const modal = new WebsiteModal(document.getElementById('modal'));
const audio = new EngineAudio();

let qualityIndex = window.devicePixelRatio > 1.25 ? 0 : 1;
let quality = { ...QUALITY[qualityIndex] };
const { composer, bloom } = createComposer(renderer, scene, camera, window.innerWidth, window.innerHeight);

function applyQuality() {
  const pr = Math.min(window.devicePixelRatio || 1, quality.pr);
  renderer.setPixelRatio(pr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  composer.setPixelRatio(pr);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.enabled = quality.bloom;
}
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applyQuality();
  minimap.resize();
}
window.addEventListener('resize', onResize);
onResize();

// ------------------------------------------------------------------ state
let started = false;
let paused = false;        // modal open
let hiddenPause = false;   // tab hidden
let accumulator = 0;
let lastTime = performance.now();
let stepsThisFrame = 0;
const brandState = new Map(); // brand -> { touching, cooldownUntil }
let simTime = 0;

function resetCar() {
  const spot = findResetSpot(car, city.colliders);
  car.reset(spot.x, spot.z, spot.heading);
  camCtl.snap();
  hud.toast('VEHICLE RESET');
}

// ------------------------------------------------------------------ building interaction
function checkBrandContacts() {
  for (const [col, info] of car.contacts) {
    if (!col.brand) continue;
    let st = brandState.get(col.brand);
    if (!st) { st = { touching: false, lastContact: -1, cooldownUntil: 0 }; brandState.set(col.brand, st); }
    st.lastContact = Math.max(st.lastContact, info.time);
  }
  car.contacts.clear();
  for (const [brand, st] of brandState) {
    const touchingNow = simTime - st.lastContact <= CONTACT_STICKY;
    if (touchingNow && !st.touching && simTime >= st.cooldownUntil && !modal.isOpen) {
      openPrompt(brand, st);
    }
    st.touching = touchingNow;
  }
}

function openPrompt(brand, st) {
  paused = true;
  input.enabled = false;
  input.releasePointer();
  audio.suspend(true);
  modal.open(brand, () => {
    paused = false;
    input.enabled = true;
    input.clearPressed();
    st.cooldownUntil = simTime + PROMPT_COOLDOWN;
    lastTime = performance.now();
    accumulator = 0;
    audio.suspend(false);
    canvas.focus();
  });
}

// ------------------------------------------------------------------ actions
function handleActions() {
  if (input.consume('KeyC')) hud.setCamera(camCtl.cycle());
  if (input.consume('KeyR')) resetCar();
  if (input.consume('KeyM')) minimap.toggle();
  if (input.consume('KeyH')) hud.toggleHelp();
  if (input.consume('KeyF') || input.consume('Backquote')) hud.togglePerf();
  if (input.consume('KeyN')) hud.toast(audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON');
  if (input.consume('KeyQ')) {
    qualityIndex = (qualityIndex + 1) % QUALITY.length;
    quality = { ...QUALITY[qualityIndex] };
    applyQuality();
    hud.toast(`QUALITY: ${quality.name.toUpperCase()}`);
  }
}
document.getElementById('btn-reset').addEventListener('click', (e) => { e.currentTarget.blur(); resetCar(); });

// ------------------------------------------------------------------ physics events -> effects
function consumeEvents() {
  for (const ev of car.events) {
    if (ev.type === 'impact') {
      effects.impact(ev.x, ev.y, ev.z, ev.nx, ev.nz, ev.strength);
      camCtl.addShake(Math.min(0.5, ev.strength * 0.025));
      model.impulse(Math.min(2, ev.strength * 0.08));
      if (ev.strength > 8) { model.crash(ev.strength); hud.toast('CRASH!', 0.9); }
      audio.thump(ev.strength);
    } else if (ev.type === 'land') {
      if (ev.strength > 2) {
        model.impulse(Math.min(3.5, ev.strength * 0.35));
        camCtl.addShake(Math.min(0.35, ev.strength * 0.03));
        effects.landing(car.x, car.y, car.z, ev.strength);
        audio.thump(ev.strength * 0.7);
      }
      const spins = Math.round(Math.abs(ev.spin || 0) / Math.PI) * 180;
      const tricks = [];
      if (spins >= 180) tricks.push(`${spins}° SPIN`);
      if ((ev.flip || 0) > 0.6) tricks.push('BARREL ROLL');
      if (ev.airTime > 0.6) tricks.push(`AIR ${ev.airTime.toFixed(1)}s`);
      if (tricks.length && ev.airTime > 0.4) { hud.toast(tricks.join(' + '), 1.8);
      }
    } else if (ev.type === 'bump') {
      model.impulse(Math.min(1.2, ev.strength * 4));
    }
  }
  car.events.length = 0;
}

// ------------------------------------------------------------------ adaptive quality
let perfAccum = 0, perfFrames = 0, slowWindows = 0;
const perf = { fps: 60, ms: 16, calls: 0, tris: 0, steps: 0, colliders: city.colliders.items.length, pr: 1, bloom: true, quality: '' };
function trackPerf(dt) {
  perfAccum += dt; perfFrames++;
  if (perfAccum >= 1) {
    perf.fps = perfFrames / perfAccum;
    perf.ms = (perfAccum / perfFrames) * 1000;
    perfAccum = 0; perfFrames = 0;
    // degrade gracefully: after 3 consecutive slow seconds step quality down
    if (started && !paused && perf.fps < 42 && qualityIndex < QUALITY.length - 1) {
      if (++slowWindows >= 3) {
        qualityIndex++;
        quality = { ...QUALITY[qualityIndex] };
        applyQuality();
        hud.toast(`AUTO QUALITY: ${quality.name.toUpperCase()}`);
        slowWindows = 0;
      }
    } else slowWindows = 0;
  }
  perf.calls = renderer.info.render.calls;
  perf.tris = renderer.info.render.triangles;
  perf.steps = stepsThisFrame;
  perf.pr = renderer.getPixelRatio();
  perf.bloom = quality.bloom;
  perf.quality = quality.name;
}

// ------------------------------------------------------------------ loop
const interp = { x: 0, y: 0, z: 0, heading: 0, speed: 0, forwardSpeed: 0, vx: 0, vz: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.1) dt = 0.1;          // tab switch / hitch: never explode physics
  if (dt < 0) dt = 0;

  const inp = input.poll();
  if (started && !paused) handleActions();
  else input.clearPressed();

  stepsThisFrame = 0;
  if (started && !paused && !hiddenPause) {
    accumulator += dt;
    while (accumulator >= FIXED_DT && stepsThisFrame < MAX_STEPS) {
      car.step(FIXED_DT, inp);
      simTime += FIXED_DT;
      stepsThisFrame++;
      accumulator -= FIXED_DT;
      checkBrandContacts();
      if (paused) { accumulator = 0; break; }
    }
    if (stepsThisFrame >= MAX_STEPS) accumulator = 0;
    consumeEvents();
  }
  const alpha = paused || !started ? 1 : accumulator / FIXED_DT;
  const vdt = paused ? 0 : dt;

  model.update(car, alpha, vdt, inp.brake > 0 && car.forwardSpeed > 0.5);
  effects.update(vdt, car, model);

  interp.x = car.px + (car.x - car.px) * alpha;
  interp.y = car.py + (car.y - car.py) * alpha;
  interp.z = car.pz + (car.z - car.pz) * alpha;
  interp.heading = car.pheading + (car.heading - car.pheading) * alpha;
  interp.speed = car.speed; interp.forwardSpeed = car.forwardSpeed;
  interp.vx = car.vx; interp.vz = car.vz;
  if (!started) {
    // slow orbit on the title screen
    interp.heading = SPAWN.heading + Math.sin(now * 0.0002) * 0.6;
  }
  if (window.__freeCam) {
    // debug/screenshot hook: fixed camera
    camera.position.copy(window.__freeCam.pos);
    camera.lookAt(window.__freeCam.look);
  } else camCtl.update(Math.max(vdt, started ? 0 : dt), interp, started ? inp : { lookX: 0, lookY: 0, lookBack: false });

  const district = districtAt(car.x, car.z);
  hud.update(vdt, car, district, perf);
  minimap.update(dt, interp);
  updateMaterials(now / 1000);
  city.globe.rotation.y += dt * 0.25;
  for (const fn of city.animated) fn(now / 1000, dt);
  audio.update(car, inp.throttle);

  renderer.info.reset();
  if (quality.bloom) composer.render();
  else renderer.render(scene, camera);
  trackPerf(dt);
}

document.addEventListener('visibilitychange', () => {
  hiddenPause = document.hidden;
  if (!document.hidden) { lastTime = performance.now(); accumulator = 0; }
  audio.suspend(document.hidden || paused);
});

// ------------------------------------------------------------------ start screen
const startEl = document.getElementById('start');
const startBtn = document.getElementById('start-btn');
document.getElementById('loading').textContent = `${city.brands.length + 1} brand landmarks · ${perf.colliders} colliders ready`;
function startGame() {
  if (started) return;
  started = true;
  startEl.classList.add('hidden');
  audio.start();
  lastTime = performance.now();
  accumulator = 0;
  camCtl.snap();
  canvas.focus();
}
startBtn.addEventListener('click', startGame);
window.addEventListener('keydown', (e) => {
  if (!started && (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyW')) startGame();
});
hud.setCamera(camCtl.mode.name);

// debug handle for automated checks
window.__game = { car, city, camCtl, THREE, brandState, get paused() { return paused; }, modal, startGame };

requestAnimationFrame((t) => { lastTime = t; frame(t); });
