// Procedurally generated canvas textures (no external assets to load).
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296);
}

// Window grid. Edges are dark so UV (0,0) can be used for blank roofs.
export function makeWindowTexture(seed = 7, warm = false) {
  const [c, g] = canvas(256, 256);
  const rnd = seeded(seed);
  g.fillStyle = '#05060c';
  g.fillRect(0, 0, 256, 256);
  const cols = 8, rows = 8, cw = 32, ch = 32;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const r = rnd();
      let col;
      if (r < 0.42) col = '#0a0d18';
      else if (r < 0.62) col = warm ? '#ffcf8a' : '#9fd8ff';
      else if (r < 0.78) col = warm ? '#ffb46b' : '#5a8cff';
      else if (r < 0.9) col = '#e9e4ff';
      else col = warm ? '#ff7ab8' : '#c77dff';
      g.fillStyle = col;
      g.fillRect(i * cw + 5, j * ch + 7, cw - 10, ch - 13);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function makeBrickTexture() {
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#2a1512';
  g.fillRect(0, 0, 256, 128);
  const rnd = seeded(3);
  const bw = 32, bh = 16;
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < 9; col++) {
      const shade = 70 + Math.floor(rnd() * 40);
      g.fillStyle = `rgb(${shade + 40},${shade * 0.45},${shade * 0.38})`;
      g.fillRect(col * bw + off + 1.5, row * bh + 1.5, bw - 3, bh - 3);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function makeAsphaltTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#16151f';
  g.fillRect(0, 0, 256, 256);
  const rnd = seeded(11);
  for (let i = 0; i < 5000; i++) {
    const v = 18 + Math.floor(rnd() * 26);
    g.fillStyle = `rgba(${v},${v},${v + 8},0.55)`;
    g.fillRect(rnd() * 256, rnd() * 256, 1.5, 1.5);
  }
  // wet patches
  for (let i = 0; i < 14; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 10 + rnd() * 30;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(5,5,12,0.55)');
    grd.addColorStop(1, 'rgba(5,5,12,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Roughness map so wet patches look glossier
export function makeAsphaltRoughness() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#7a7a7a';
  g.fillRect(0, 0, 256, 256);
  const rnd = seeded(11);
  for (let i = 0; i < 5000; i++) rnd();
  for (let i = 0; i < 14; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 10 + rnd() * 30;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(20,20,20,1)');
    grd.addColorStop(1, 'rgba(20,20,20,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function makeGlowTexture() {
  const [c, g] = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeSmokeTexture() {
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Animated-looking "screen" texture for the social district (scrolled via offset)
export function makeScreenTexture() {
  const [c, g] = canvas(256, 512);
  const cols = ['#ff2fb4', '#b44dff', '#2fd1ff', '#ff5e7a', '#ffd84d', '#7a5cff'];
  const rnd = seeded(21);
  for (let y = 0; y < 512; y += 64) {
    const grd = g.createLinearGradient(0, y, 256, y + 64);
    grd.addColorStop(0, cols[Math.floor(rnd() * cols.length)]);
    grd.addColorStop(1, cols[Math.floor(rnd() * cols.length)]);
    g.fillStyle = grd;
    g.fillRect(0, y, 256, 64);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let k = 0; k < 6; k++) g.fillRect(rnd() * 220, y + 8 + rnd() * 40, 20 + rnd() * 60, 6);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath(); g.arc(30 + rnd() * 200, y + 32, 10 + rnd() * 10, 0, Math.PI * 2); g.fill();
  }
  // scanlines
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < 512; y += 4) g.fillRect(0, y, 256, 1);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Brand sign: text-based stylised sign (no logos are reproduced).
export function makeSignTexture(sign, text, w = 1024, h = 256) {
  const [c, g] = canvas(w, h);
  if (sign.bg.startsWith('grad:')) {
    const cols = sign.bg.slice(5).split(',');
    const grd = g.createLinearGradient(0, 0, w, h);
    cols.forEach((col, i) => grd.addColorStop(i / (cols.length - 1), col));
    g.fillStyle = grd;
  } else g.fillStyle = sign.bg;
  g.fillRect(0, 0, w, h);
  if (sign.frame) {
    g.strokeStyle = sign.frame; g.lineWidth = 18;
    g.strokeRect(9, 9, w - 18, h - 18);
  }
  if (sign.accent) {
    g.fillStyle = sign.accent;
    g.fillRect(0, h - 22, w, 22);
  }
  g.font = sign.font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // shrink to fit
  let size = parseInt(sign.font.match(/(\d+)px/)[1], 10);
  while (g.measureText(text).width > w * 0.9 && size > 20) {
    size -= 4;
    g.font = sign.font.replace(/\d+px/, `${size}px`);
  }
  if (sign.fg.startsWith('multi:')) {
    const cols = sign.fg.slice(6).split(',');
    const total = g.measureText(text).width;
    let x = w / 2 - total / 2;
    g.textAlign = 'left';
    [...text].forEach((ch, i) => {
      g.fillStyle = cols[i % cols.length];
      g.fillText(ch, x, h / 2 + 4);
      x += g.measureText(ch).width;
    });
  } else {
    g.fillStyle = sign.fg;
    g.fillText(text, w / 2, h / 2 + 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Big floating district banner
export function makeBannerTexture(text, color) {
  const [c, g] = canvas(1024, 160);
  g.fillStyle = 'rgba(8,4,20,0.75)';
  g.fillRect(0, 0, 1024, 160);
  g.strokeStyle = color; g.lineWidth = 10;
  g.strokeRect(8, 8, 1008, 144);
  g.font = '900 76px Arial';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 24;
  g.fillStyle = '#ffffff';
  g.fillText(text, 512, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeLaneTexture() {
  const [c, g] = canvas(16, 64);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 16, 64);
  return new THREE.CanvasTexture(c);
}
