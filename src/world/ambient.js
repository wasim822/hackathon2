// Map-wide ambience: flying-car sky traffic, advertising blimps, sweeping
// searchlights and district gateway arches. Everything here is either one
// instanced draw call or a handful of meshes, updated with cheap per-frame math.
import * as THREE from 'three';
import { MAP } from '../config/map.js';
import { makeBannerTexture, makeGlowTexture } from './textures.js';
import { screenMat, neon, solid } from './materials.js';

const TAU = Math.PI * 2;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// ------------------------------------------------------------------ sky traffic
function skyTraffic(scene, animated) {
  const rnd = rng(77);
  const N = 90;
  const geo = new THREE.CapsuleGeometry(0.8, 3.2, 4, 8);
  geo.rotateZ(Math.PI / 2); // lie along x
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false;
  const cols = [0xff2fb4, 0x7fe7ff, 0xffd23f, 0xb44dff, 0x39ff6a, 0xff7a1a];
  const cars = [];
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const line = -MAP.half + Math.floor(rnd() * (MAP.blocks + 1)) * MAP.pitch;
    cars.push({
      axis: rnd() < 0.5 ? 'x' : 'z',
      line: line + (rnd() - 0.5) * 8,
      y: 34 + Math.floor(rnd() * 4) * 14 + rnd() * 4,
      s: (rnd() - 0.5) * 1100,
      v: (rnd() < 0.5 ? -1 : 1) * (18 + rnd() * 22),
    });
    mesh.setColorAt(i, c.set(cols[i % cols.length]).multiplyScalar(1.8));
  }
  scene.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const qx = new THREE.Quaternion(), qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  animated.push((t, dt) => {
    for (let i = 0; i < N; i++) {
      const car = cars[i];
      car.s += car.v * dt;
      if (car.s > 560) car.s -= 1120;
      if (car.s < -560) car.s += 1120;
      if (car.axis === 'x') { p.set(car.s, car.y, car.line); q.copy(qx); }
      else { p.set(car.line, car.y, car.s); q.copy(qz); }
      m4.compose(p, q, one);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
}

// ------------------------------------------------------------------ blimps
function blimps(scene, animated) {
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1830, metalness: 0.6, roughness: 0.35, emissive: 0x0a0818 });
  const ad = new THREE.MeshBasicMaterial({ map: makeBannerTexture('NEON BRAND CITY', '#ff2fb4'), color: new THREE.Color(1.3, 1.3, 1.3), side: THREE.DoubleSide });
  const list = [
    { r: 330, y: 125, w: 0.03, a: 0 },
    { r: 430, y: 150, w: -0.022, a: 2.5 },
  ];
  for (const b of list) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 14), bodyMat);
    body.scale.set(3.4, 1, 1);
    g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(10.1, 0.35, 8, 40), neon(0x7fe7ff, 2.4));
    ring.rotation.y = Math.PI / 2;
    ring.scale.set(1, 1, 1);
    g.add(ring);
    for (const s of [1, -1]) {
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(46, 7.2), ad);
      scr.position.set(0, 0.5, s * 10.3);
      if (s < 0) scr.rotation.y = Math.PI;
      g.add(scr);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 9), bodyMat);
      fin.position.set(-30, 0, s * 4);
      g.add(fin);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(6, 9, 0.5), bodyMat);
    tail.position.set(-30, 3, 0);
    g.add(tail);
    const gondola = new THREE.Mesh(new THREE.BoxGeometry(10, 2.4, 3.4), screenMat());
    gondola.position.set(0, -10.5, 0);
    g.add(gondola);
    scene.add(g);
    animated.push((t) => {
      const a = b.a + t * b.w;
      g.position.set(Math.cos(a) * b.r, b.y + Math.sin(t * 0.4 + b.a) * 3, Math.sin(a) * b.r);
      g.rotation.y = -a + (b.w > 0 ? -Math.PI / 2 : Math.PI / 2);
    });
  }
}

// ------------------------------------------------------------------ searchlights
function searchlights(scene, animated) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(0.55, 0.75, 1.0) } },
    vertexShader: `varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 color; varying float vY; void main(){ gl_FragColor = vec4(color, 0.22 * pow(1.0 - vY, 1.6)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const len = 320;
  const geo = new THREE.CylinderGeometry(26, 1.5, len, 24, 1, true);
  geo.translate(0, len / 2, 0);
  // flip uv so 0 is at the lamp
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  const c = MAP.wallInner + MAP.wallThickness / 2;
  [[c, c], [-c, c], [c, -c], [-c, -c]].forEach(([x, z], i) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 32, z);
    const beam = new THREE.Mesh(geo, mat);
    pivot.add(beam);
    scene.add(pivot);
    animated.push((t) => {
      pivot.rotation.set(0.45 + Math.sin(t * 0.3 + i) * 0.2, t * 0.25 + i * 1.6, 0, 'YXZ');
    });
  });
}

// ------------------------------------------------------------------ gateway arches
function gateways(B, signs, colliders) {
  const gates = [
    { x: 0, z: -140, axis: 'x', out: 'TECH  ◂  ▸  SOCIAL', color: '#7fe7ff' },
    { x: 140, z: 0, axis: 'z', out: 'ENTERTAINMENT DISTRICT', color: '#a95cff' },
    { x: 0, z: 140, axis: 'x', out: 'GAMING  ◂  ▸  INSURANCE', color: '#39ff6a' },
    { x: -140, z: 0, axis: 'z', out: 'FOOD STREET', color: '#ff7a1a' },
  ];
  const pillar = solid(0x1a1630, 0.4, 0.7);
  const inner = new THREE.MeshBasicMaterial({ map: makeBannerTexture('GOOGLE CENTRAL', '#4285f4'), color: new THREE.Color(1.2, 1.2, 1.2) });
  for (const g of gates) {
    const half = MAP.roadWidth / 2 + 2;
    const outMat = new THREE.MeshBasicMaterial({ map: makeBannerTexture(g.out, g.color), color: new THREE.Color(1.2, 1.2, 1.2) });
    const c = new THREE.Color(g.color).getHex();
    // direction from the centre outwards
    const outSign = g.axis === 'x' ? Math.sign(g.z) : Math.sign(g.x);
    for (const s of [1, -1]) {
      const px = g.axis === 'x' ? g.x + s * half : g.x;
      const pz = g.axis === 'x' ? g.z : g.z + s * half;
      B.box(pillar, 2.2, 17, 2.2, px, MAP.curbHeight, pz);
      B.box(neon(c, 2.4), 2.4, 0.4, 2.4, px, MAP.curbHeight + 6, pz);
      B.box(neon(c, 2.4), 2.4, 0.4, 2.4, px, MAP.curbHeight + 11, pz);
      colliders.addBox(px - 1.1, px + 1.1, pz - 1.1, pz + 1.1, { kind: 'gate', height: 17 });
    }
    const span = half * 2 + 2.2;
    if (g.axis === 'x') B.box(pillar, span, 4, 1.6, g.x, 13.5, g.z);
    else B.box(pillar, 1.6, 4, span, g.x, 13.5, g.z);
    B.box(neon(c, 2.6), g.axis === 'x' ? span : 1.8, 0.35, g.axis === 'x' ? 1.8 : span, g.x, 17.5, g.z);
    // banner both sides: outward face shows the district, inward face shows "Google Central"
    for (const face of [1, -1]) {
      const geo = new THREE.PlaneGeometry(span - 3, (span - 3) / 6.4);
      const m = new THREE.Mesh(geo, face === outSign ? outMat : inner);
      if (g.axis === 'x') { m.position.set(g.x, 15.5, g.z + face * 0.82); m.rotation.y = face > 0 ? 0 : Math.PI; }
      else { m.position.set(g.x + face * 0.82, 15.5, g.z); m.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2; }
      signs.add(m);
    }
  }
}

// ------------------------------------------------------------------ city-limit force field
function forceField(scene, animated) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float time; varying vec2 vUv; varying vec3 vW;
      void main(){
        float along = (abs(vW.x) > abs(vW.z)) ? vW.z : vW.x;
        float hex = abs(sin(along * 0.35)) * abs(sin(vW.y * 0.35 + time * 0.6));
        float grid = smoothstep(0.92, 1.0, hex);
        float scan = smoothstep(0.96, 1.0, sin(vW.y * 0.25 - time * 2.0));
        float fade = pow(1.0 - vUv.y, 2.0);
        vec3 col = mix(vec3(1.0, 0.18, 0.7), vec3(0.4, 0.9, 1.0), vUv.y);
        gl_FragColor = vec4(col, (0.05 + grid * 0.35 + scan * 0.25) * fade);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const W = MAP.wallInner + MAP.wallThickness / 2, H = 50, y0 = MAP.wallHeight + 0.5;
  const len = W * 2;
  for (const [x, z, ry] of [[0, W, 0], [0, -W, 0], [W, 0, Math.PI / 2], [-W, 0, Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, H), mat);
    m.position.set(x, y0 + H / 2, z);
    m.rotation.y = ry;
    m.renderOrder = 3;
    scene.add(m);
  }
  animated.push((t) => { mat.uniforms.time.value = t; });
}

export function buildAmbient(scene, B, signs, colliders, animated) {
  skyTraffic(scene, animated);
  blimps(scene, animated);
  searchlights(scene, animated);
  gateways(B, signs, colliders);
  forceField(scene, animated);
}

export { makeGlowTexture };
