// North-up minimap (top-right). The static city is pre-rendered once to an
// offscreen canvas; each update only blits a window of it plus live markers.
import { MAP, blockCenter, isPlazaBlock } from '../config/map.js';
import { DISTRICTS, districtAt } from '../config/brands.js';
import { rampData } from '../world/terrain.js';

const WORLD = 1120;          // meters covered by the base image
const PX = 1.5;              // base pixels per meter

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export class Minimap {
  constructor(canvas, brands, colliders) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.brands = brands;
    this.expanded = false;
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = WORLD * PX;
    this.drawBase(colliders);
    this.timer = 0;
    this.resize();
  }

  toW(v) { return (v + WORLD / 2) * PX; }

  drawBase(colliders) {
    const g = this.base.getContext('2d');
    const S = WORLD * PX;
    g.fillStyle = '#05030c';
    g.fillRect(0, 0, S, S);
    // road surface inside the wall
    const w = MAP.wallInner;
    g.fillStyle = '#2b2740';
    g.fillRect(this.toW(-w), this.toW(-w), w * 2 * PX, w * 2 * PX);
    // blocks tinted by district
    for (let i = 0; i < MAP.blocks; i++) {
      for (let j = 0; j < MAP.blocks; j++) {
        if (isPlazaBlock(i, j)) continue;
        const c = blockCenter(i, j);
        const d = DISTRICTS[districtAt(c.x, c.z)];
        const bs = MAP.blockSize;
        g.fillStyle = hex(d.color) + '33';
        g.fillRect(this.toW(c.x - bs / 2), this.toW(c.z - bs / 2), bs * PX, bs * PX);
        g.strokeStyle = hex(d.color) + 'aa';
        g.lineWidth = 1.5;
        g.strokeRect(this.toW(c.x - bs / 2), this.toW(c.z - bs / 2), bs * PX, bs * PX);
      }
    }
    // filler buildings
    g.fillStyle = '#4a4660';
    for (const c of colliders.items) {
      if (c.kind !== 'filler') continue;
      g.fillRect(this.toW(c.minX), this.toW(c.minZ), (c.maxX - c.minX) * PX, (c.maxZ - c.minZ) * PX);
    }
    // brand buildings
    for (const b of this.brands) {
      const d = DISTRICTS[b.district];
      g.fillStyle = hex(b.themeColor ?? d.color);
      const bb = b.bounds;
      g.fillRect(this.toW(bb.minX), this.toW(bb.minZ), (bb.maxX - bb.minX) * PX, (bb.maxZ - bb.minZ) * PX);
    }
    // ramps
    g.fillStyle = '#ffd23f';
    for (const r of rampData) {
      g.fillRect(this.toW(r.rect.minX), this.toW(r.rect.minZ), (r.rect.maxX - r.rect.minX) * PX, (r.rect.maxZ - r.rect.minZ) * PX);
    }
    // google
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(this.toW(0), this.toW(0), (MAP.googleRadius + 1) * PX, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#7fe7ff'; g.lineWidth = 3;
    g.beginPath(); g.arc(this.toW(0), this.toW(0), 46 * PX, 0, Math.PI * 2); g.stroke();
    g.font = `900 ${28 * PX}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#4285f4'; g.fillText('G', this.toW(0), this.toW(0) + 2);
    // brick wall
    g.strokeStyle = '#ff2fb4'; g.lineWidth = 6 * PX;
    g.strokeRect(this.toW(-w - 3), this.toW(-w - 3), (w + 3) * 2 * PX, (w + 3) * 2 * PX);
  }

  resize() {
    const size = this.expanded ? Math.min(520, window.innerHeight * 0.7, window.innerWidth * 0.8) : 210;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = this.canvas.style.height = size + 'px';
    this.canvas.width = this.canvas.height = Math.round(size * dpr);
    this.size = size;
    this.dpr = dpr;
    this.canvas.classList.toggle('expanded', this.expanded);
    const hint = document.getElementById('minimap-hint');
    if (hint) hint.style.display = this.expanded ? 'none' : 'block';
  }

  toggle() { this.expanded = !this.expanded; this.resize(); }

  update(dt, car) {
    this.timer += dt;
    if (this.timer < 1 / 24) return;
    this.timer = 0;
    const g = this.ctx;
    const C = this.canvas.width;
    const viewM = this.expanded ? WORLD : 340;  // meters visible
    const scale = C / viewM;                    // canvas px per meter
    const cx = this.expanded ? 0 : car.x, cz = this.expanded ? 0 : car.z;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, C, C);
    g.save();
    g.beginPath();
    g.arc(C / 2, C / 2, C / 2, 0, Math.PI * 2);
    if (!this.expanded) g.clip();
    // blit base
    const sx = this.toW(cx - viewM / 2), sz = this.toW(cz - viewM / 2);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.base, sx, sz, viewM * PX, viewM * PX, 0, 0, C, C);
    const toC = (x, z) => [(x - cx) * scale + C / 2, (z - cz) * scale + C / 2];

    // brand labels
    g.font = `700 ${Math.round((this.expanded ? 10 : 10) * this.dpr)}px Arial`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const b of this.brands) {
      const [px, pz] = toC(b.x, b.z);
      if (px < -40 || pz < -20 || px > C + 40 || pz > C + 20) continue;
      g.fillStyle = 'rgba(0,0,0,0.65)';
      const label = b.name;
      const tw = g.measureText(label).width + 6 * this.dpr;
      g.fillRect(px - tw / 2, pz - 7 * this.dpr, tw, 14 * this.dpr);
      g.fillStyle = '#ffffff';
      g.fillText(label, px, pz);
    }

    // player arrow
    const [px, pz] = toC(car.x, car.z);
    g.translate(px, pz);
    // heading 0 = +z (down on map). Canvas rotation: map +z is down.
    g.rotate(-car.heading);
    const s = 7 * this.dpr * (this.expanded ? 1.2 : 1);
    g.fillStyle = 'rgba(127,231,255,0.18)';
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, s * 6, Math.PI / 2 - 0.5, Math.PI / 2 + 0.5); g.closePath(); g.fill();
    g.fillStyle = '#7fe7ff';
    g.strokeStyle = '#000'; g.lineWidth = 2 * this.dpr;
    g.beginPath(); g.moveTo(0, s * 1.6); g.lineTo(s, -s); g.lineTo(0, -s * 0.4); g.lineTo(-s, -s); g.closePath();
    g.stroke(); g.fill();
    g.restore();

    // ring + north marker
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.expanded) {
      g.strokeStyle = 'rgba(180,77,255,0.9)'; g.lineWidth = 3 * this.dpr;
      g.beginPath(); g.arc(C / 2, C / 2, C / 2 - 1.5 * this.dpr, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = '#ff2fb4';
    g.font = `900 ${13 * this.dpr}px Arial`;
    g.fillText('N', C / 2, 12 * this.dpr);
  }
}

