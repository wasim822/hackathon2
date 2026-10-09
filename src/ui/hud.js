// Lightweight DOM HUD: speedometer, gear, district banner, camera mode,
// toasts and a toggleable performance overlay. DOM writes are throttled.
import { DISTRICTS } from '../config/brands.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.speedEl = $('speed');
    this.gearEl = $('gear');
    this.arcEl = $('speed-arc');
    this.districtEl = $('district');
    this.districtSub = $('district-sub');
    this.camEl = $('cam-mode');
    this.toastEl = $('toast');
    this.perfEl = $('perf');
    this.helpEl = $('help');
    this.driftEl = $('drift');
    this.lastDistrict = null;
    this.timer = 0;
    this.toastTimer = 0;
    this.perfVisible = false;
    this.arcLen = this.arcEl.getTotalLength ? this.arcEl.getTotalLength() : 283;
    this.arcEl.style.strokeDasharray = `${this.arcLen}`;
    this.driftScore = 0; this.driftShow = 0;
  }

  setCamera(name) { this.camEl.textContent = `CAM: ${name.toUpperCase()}`; }

  toast(msg, secs = 1.8) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    this.toastTimer = secs;
  }

  toggleHelp() { this.helpEl.classList.toggle('collapsed'); }
  togglePerf() { this.perfVisible = !this.perfVisible; this.perfEl.style.display = this.perfVisible ? 'block' : 'none'; }

  update(dt, car, district, perf) {
    this.toastTimer -= dt;
    if (this.toastTimer <= 0) this.toastEl.classList.remove('show');

    // drift meter
    const slip = Math.abs(car.lateralSpeed);
    if (car.onGround && slip > 4 && car.speed > 10) { this.driftScore += slip * dt * 10; this.driftShow = 1.2; }
    else this.driftShow -= dt;
    if (this.driftShow <= 0 && this.driftScore > 0) {
      if (this.driftScore > 60) this.toast(`DRIFT +${Math.round(this.driftScore)}`, 1.4);
      this.driftScore = 0;
    }

    this.timer += dt;
    if (this.timer < 1 / 20) return;
    this.timer = 0;
    const kmh = Math.round(Math.abs(car.forwardSpeed) * 3.6);
    this.speedEl.textContent = kmh;
    this.gearEl.textContent = car.gear;
    this.gearEl.classList.toggle('rev', car.gear === 'R');
    const frac = Math.min(1, kmh / 240);
    this.arcEl.style.strokeDashoffset = `${this.arcLen * (1 - frac)}`;
    this.driftEl.style.opacity = this.driftScore > 10 ? 1 : 0;
    this.driftEl.textContent = `DRIFT ${Math.round(this.driftScore)}`;

    if (district !== this.lastDistrict) {
      this.lastDistrict = district;
      if (district === 'center') {
        this.districtEl.textContent = 'GOOGLE CENTRAL';
        this.districtSub.textContent = 'Landmark roundabout';
        this.districtEl.style.setProperty('--dc', '#7fe7ff');
      } else {
        const d = DISTRICTS[district];
        this.districtEl.textContent = d.short;
        this.districtSub.textContent = d.name;
        this.districtEl.style.setProperty('--dc', '#' + d.color.toString(16).padStart(6, '0'));
      }
      this.districtEl.classList.remove('pulse'); void this.districtEl.offsetWidth; this.districtEl.classList.add('pulse');
    }

    if (this.perfVisible && perf) {
      this.perfEl.textContent =
        `FPS ${perf.fps.toFixed(0)}  frame ${perf.ms.toFixed(1)}ms\n` +
        `draw calls ${perf.calls}  tris ${(perf.tris / 1000).toFixed(0)}k\n` +
        `physics steps/frame ${perf.steps}  colliders ${perf.colliders}\n` +
        `pixel ratio ${perf.pr.toFixed(2)}  bloom ${perf.bloom ? 'on' : 'off'}  quality ${perf.quality}`;
    }
  }
}
