// Brand building archetypes. Each builder adds static geometry to the batcher
// (merged per material), sign meshes to `signs`, and its colliders.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DISTRICTS } from '../config/brands.js';
import { MAP } from '../config/map.js';
import { makeSignTexture } from './textures.js';
import { neon, pulseNeon, glass, solid, screenMat } from './materials.js';

const CURB = MAP.curbHeight;
const CORNERS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

// ---------------------------------------------------------------- signs
export function signMaterial(b) {
  const tex = makeSignTexture(b.sign, b.signText || b.name);
  // light backgrounds would bloom into a white blob; keep them below the bloom threshold
  const bg = b.sign.bg.startsWith('#') ? new THREE.Color(b.sign.bg) : new THREE.Color(0.5, 0.5, 0.5);
  const lum = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b;
  const k = lum > 0.6 ? 0.78 : lum > 0.35 ? 1.0 : 1.3;
  return new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(k, k, k), side: THREE.FrontSide });
}

// panels: [{x,y,z,rotY,w,h}]
export function addSignMesh(signs, mat, panels) {
  const geos = panels.map((p) => {
    const g = new THREE.PlaneGeometry(p.w, p.h);
    g.rotateY(p.rotY);
    g.translate(p.x, p.y, p.z);
    return g;
  });
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
  geos.forEach((g) => g.dispose());
  mesh.matrixAutoUpdate = false;
  signs.add(mesh);
  return mesh;
}

// Four signs, one per face of a w x d box centred on (x,z), at height y.
export function fourSides(x, z, w, d, y, maxW, aspect = 4) {
  const out = [];
  const sw = Math.min(maxW, w * 0.92), swSide = Math.min(maxW, d * 0.92);
  out.push({ x, y, z: z + d / 2 + 0.2, rotY: 0, w: sw, h: sw / aspect });
  out.push({ x, y, z: z - d / 2 - 0.2, rotY: Math.PI, w: sw, h: sw / aspect });
  out.push({ x: x + w / 2 + 0.2, y, z, rotY: Math.PI / 2, w: swSide, h: swSide / aspect });
  out.push({ x: x - w / 2 - 0.2, y, z, rotY: -Math.PI / 2, w: swSide, h: swSide / aspect });
  return out;
}

export function edgeTrim(B, mat, x, y, z, w, h, d, t = 0.5) {
  for (const [sx, sz] of CORNERS) B.box(mat, t, h, t, x + (sx * w) / 2, y, z + (sz * d) / 2);
  B.box(mat, w + t, t, t, x, y + h - t, z + d / 2);
  B.box(mat, w + t, t, t, x, y + h - t, z - d / 2);
  B.box(mat, t, t, d + t, x + w / 2, y + h - t, z);
  B.box(mat, t, t, d + t, x - w / 2, y + h - t, z);
}

// ---------------------------------------------------------------- styles
export const STYLES = {
  tower(B, b, D, signs, sm) {
    const { x, z } = b; const [w, d, h] = b.size;
    const podH = 6;
    B.box(solid(0x161827, 0.5, 0.5), w, podH, d, x, CURB, z);
    B.box(neon(D.accent, 2.6), w + 0.4, 0.5, d + 0.4, x, CURB + podH, z);
    const tw = w * 0.8, td = d * 0.8;
    B.box(glass(0x0b1a33, D.color), tw, h - podH, td, x, CURB + podH, z, 0, true);
    B.box(glass(0x0b1a33, D.color), tw * 0.65, 7, td * 0.65, x, CURB + h, z, 0, true);
    const pm = pulseNeon(D.accent, 2.6, 2.2, x * 0.05 + z * 0.03);
    for (const [sx, sz] of CORNERS) B.box(pm, 0.7, h - podH, 0.7, x + (sx * tw) / 2, CURB + podH, z + (sz * td) / 2);
    B.box(neon(D.color, 2.4), tw + 0.6, 0.7, td + 0.6, x, CURB + h - 0.7, z);
    addSignMesh(signs, sm, fourSides(x, z, tw, td, CURB + h - 7, 30));
    addSignMesh(signs, sm, fourSides(x, z, w, d, CURB + podH / 2, 18, 4).map((p) => ({ ...p, w: 14, h: 3.5 })));
  },

  glasscube(B, b, D, signs, sm) {
    const { x, z } = b; const [w, d, h] = b.size;
    B.box(glass(0x1a2233, 0xdde8ff, false, 0.7), w, h, d, x, CURB, z, 0, true);
    edgeTrim(B, neon(0xf2f6ff, 2.8), x, CURB, z, w, h, d, 0.6);
    addSignMesh(signs, sm, fourSides(x, z, w, d, CURB + h * 0.62, 30));
  },

  screens(B, b, D, signs, sm) {
    const { x, z } = b; const [w, d, h] = b.size;
    B.box(solid(0x1b0f2a, 0.4, 0.4), w, h, d, x, CURB, z);
    const scr = screenMat();
    const sh = h * 0.45, sy = CURB + h * 0.12;
    B.box(scr, w * 0.86, sh, 0.3, x, sy, z + d / 2 + 0.1);
    B.box(scr, w * 0.86, sh, 0.3, x, sy, z - d / 2 - 0.1);
    B.box(scr, 0.3, sh, d * 0.86, x + w / 2 + 0.1, sy, z);
    B.box(scr, 0.3, sh, d * 0.86, x - w / 2 - 0.1, sy, z);
    edgeTrim(B, pulseNeon(D.color, 2.8, 3.0, x * 0.1), x, CURB, z, w, h, d, 0.6);
    B.box(neon(D.accent, 2.6), w + 0.8, 0.6, d + 0.8, x, sy + sh + 0.6, z);
    // rooftop billboard frame
    B.box(solid(0x0c0c14), 2, 8, 2, x, CURB + h, z);
    addSignMesh(signs, sm, fourSides(x, z, w, d, CURB + h * 0.8, 30));
  },

  castle(B, b, D, signs, sm) {
    const { x, z } = b; const [w, d, h] = b.size;
    const wall = solid(0xcfc4ee, 0.7, 0.05, 0x241a44);
    const roofA = solid(0x3d5cff, 0.4, 0.2, 0x1a2aa8);
    const roofB = solid(0xff4fb8, 0.4, 0.2, 0x8a1560);
    const baseH = h * 0.32;
    B.box(wall, w * 0.86, baseH, d * 0.7, x, CURB, z);
    const tr = 3.6, th = h * 0.55;
    for (const [sx, sz] of CORNERS) {
      const tx = x + sx * (w / 2 - tr), tz = z + sz * (d / 2 - tr);
      B.cylinder(wall, tr, tr, th, tx, CURB, tz, 14);
      B.cone((sx + sz) % 4 === 0 ? roofA : roofB, tr + 0.8, 10, tx, CURB + th, tz, 14);
      B.cylinder(neon(D.accent, 2.4), tr + 0.15, tr + 0.15, 0.5, tx, CURB + th - 1, tz, 14);
    }
    const kr = 6.5, kh = h * 0.78;
    B.cylinder(wall, kr, kr + 0.5, kh, x, CURB, z, 18);
    B.cone(roofA, kr + 1.2, h - kh + 2, x, CURB + kh, z, 18);
    B.cylinder(neon(D.color, 2.6), kr + 0.6, kr + 0.6, 0.6, x, CURB + kh - 1.2, z, 18);
    B.cylinder(pulseNeon(0xffe7a0, 2.8, 1.2), 0.3, 0.3, 6, x, CURB + h + 1, z, 6);
    // signs on the base walls
    const bw = w * 0.86, bd = d * 0.7;
    addSignMesh(signs, sm, fourSides(x, z, bw, bd, CURB + baseH * 0.55, 28));
  },

  dome(B, b, D, signs, sm) {
    const { x, z } = b; const [w, d, h] = b.size;
    const baseH = 11;
    B.box(solid(0x1a1530, 0.5, 0.3), w, baseH, d, x, CURB, z);
    B.box(neon(D.accent, 2.4), w + 0.4, 0.5, d + 0.4, x, CURB + baseH, z);
    const r = Math.min(w, d) * 0.42;
    const g = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    g.translate(x, CURB + baseH, z);
    B.geometry(glass(0xdfe6ff, 0x9fb8ff, false, 0.5), g);
    B.cylinder(neon(D.color, 2.6), r + 0.3, r + 0.3, 0.6, x, CURB + baseH + 0.2, z, 24);
    // desk-lamp style arm on the roof
    B.cylinder(solid(0xd8d8e0, 0.3, 0.8), 0.6, 0.6, 10, x + r * 0.2, CURB + baseH + r - 1, z, 8);
    B.cone(solid(0xd8d8e0, 0.3, 0.8, 0x333333), 3, 4, x + r * 0.2, CURB + baseH + r + 8, z, 12);
    addSignMesh(signs, sm, fourSides(x, z, w, d, CURB + baseH * 0.5, 26));
  },

  theater(B, b, D, signs, sm) {
    const { x, z } = b; const [w, d, h] = b.size;
    const body = solid(b.name === 'Marvel' ? 0x3a0a0e : 0x0f3a1f, 0.5, 0.2);
    B.box(body, w, h, d, x, CURB, z);
    edgeTrim(B, neon(D.accent, 2.6), x, CURB, z, w, h, d, 0.5);
    // marquee canopies on both long faces
    for (const s of [1, -1]) {
      B.box(solid(0x111111, 0.4, 0.6), w * 0.8, 1.2, 5, x, CURB + 7, z + s * (d / 2 + 2.5));
      B.box(pulseNeon(0xffd36b, 3, 6, s), w * 0.8, 0.35, 0.35, x, CURB + 6.9, z + s * (d / 2 + 5));
    }
    addSignMesh(signs, sm, fourSides(x, z, w, d, CURB + h * 0.62, 32));
  },

  spire(B, b, D, signs, sm) {
    const { x, z } = b; const [w, d, h] = b.size;
    const bh = h * 0.68;
    B.box(glass(0x0a0a0f, 0xffe81f, false, 0.35), w * 0.8, bh, d * 0.8, x, CURB, z, 0, true);
    const g = new THREE.ConeGeometry((w * 0.8) / Math.SQRT2, h - bh, 4);
    g.rotateY(Math.PI / 4);
    g.translate(x, CURB + bh + (h - bh) / 2, z);
    B.geometry(solid(0x14141c, 0.3, 0.9), g);
    edgeTrim(B, neon(0xffe81f, 2.2), x, CURB, z, w * 0.8, bh, d * 0.8, 0.45);
    B.cylinder(pulseNeon(0xff3344, 3, 3), 0.25, 0.25, 8, x, CURB + h, z, 6);
    addSignMesh(signs, sm, fourSides(x, z, w * 0.8, d * 0.8, CURB + bh * 0.75, 28));
  },

  arcade(B, b, D, signs, sm) {
    const { x, z } = b; const [w, d, h] = b.size;
    B.box(solid(0x0d0d16, 0.5, 0.4), w, h, d, x, CURB, z);
    const cols = [0x39ff6a, 0xff3355, 0x3d8bff];
    for (let y = 5, k = 0; y < h - 2; y += 7, k++) {
      B.box(pulseNeon(cols[k % 3], 2.6, 2.5, k), w + 0.4, 0.45, d + 0.4, x, CURB + y, z);
    }
    // pixel blocks on the roof
    const rcols = [0xff3355, 0xffd23f, 0x39ff6a, 0x3d8bff];
    for (let k = 0; k < 4; k++) {
      const [sx, sz] = CORNERS[k];
      B.box(neon(rcols[k], 1.6), 5, 5, 5, x + sx * w * 0.25, CURB + h, z + sz * d * 0.25);
    }
    addSignMesh(signs, sm, fourSides(x, z, w, d, CURB + h * 0.55, 30));
  },

  store(B, b, D, signs, sm, colliders) {
    const { x, z } = b; const [w, d, h] = b.size;
    const bg = b.sign.bg.startsWith('#') ? b.sign.bg : '#444444';
    const body = solid(new THREE.Color(bg).multiplyScalar(0.55).getHex(), 0.5, 0.1);
    B.box(body, w, h, d, x, CURB, z);
    B.box(solid(0x222222, 0.5, 0.5), w + 1.5, 0.8, d + 1.5, x, CURB + h, z);
    B.box(neon(D.accent, 2.4), w + 1.6, 0.4, d + 1.6, x, CURB + h + 0.2, z);
    // awning on the front
    B.box(neon(new THREE.Color(bg).getHex(), 1.3), w * 0.9, 0.5, 3, x, CURB + 4.2, z + d / 2 + 1.5);
    // drive-through lane outline around the building
    const lane = neon(D.color, 1.8);
    const ow = w + 10, od = d + 10;
    B.box(lane, ow, 0.05, 0.4, x, CURB, z + od / 2);
    B.box(lane, ow, 0.05, 0.4, x, CURB, z - od / 2);
    B.box(lane, 0.4, 0.05, od, x + ow / 2, CURB, z);
    B.box(lane, 0.4, 0.05, od, x - ow / 2, CURB, z);
    addSignMesh(signs, sm, fourSides(x, z, w, d, CURB + h * 0.55, 26).map((p) => ({ ...p, h: Math.min(p.h, h * 0.55), w: Math.min(p.h, h * 0.55) * 4 })));
    // tall pylon sign at the block corner (classic roadside drive-in sign)
    const px = x + 22, pz = z + 22;
    B.cylinder(solid(0x2a2a33, 0.4, 0.8), 0.6, 0.6, 18, px, CURB, pz, 8);
    B.box(solid(0x111111), 12.4, 3.4, 1.2, px, CURB + 18, pz, Math.PI / 4);
    const c = Math.cos(Math.PI / 4), s = Math.sin(Math.PI / 4);
    addSignMesh(signs, sm, [
      { x: px + s * 0.65, y: CURB + 19.7, z: pz + c * 0.65, rotY: Math.PI / 4, w: 12, h: 3 },
      { x: px - s * 0.65, y: CURB + 19.7, z: pz - c * 0.65, rotY: Math.PI / 4 + Math.PI, w: 12, h: 3 },
    ]);
    colliders.addBox(px - 0.8, px + 0.8, pz - 0.8, pz + 0.8, { brand: b, kind: 'pylon', height: 22 });
  },

  office(B, b, D, signs, sm) {
    const { x, z } = b; const [w, d, h] = b.size;
    const tw = w * 0.84, td = d * 0.84;
    B.box(solid(0x1d2228, 0.5, 0.6), w, 5, d, x, CURB, z);
    B.box(glass(0x0c1f22, D.color, false, 0.8), tw, h - 5, td, x, CURB + 5, z, 0, true);
    const fin = D.fin != null
      ? solid(D.fin, 0.35, 0.5, new THREE.Color(D.fin).multiplyScalar(0.35).getHex())
      : solid(0x8a96a3, 0.35, 0.9);
    const n = 6;
    for (let k = 0; k <= n; k++) {
      const ox = -tw / 2 + (tw * k) / n, oz = -td / 2 + (td * k) / n;
      B.box(fin, 0.5, h - 5, 0.9, x + ox, CURB + 5, z + td / 2 + 0.3);
      B.box(fin, 0.5, h - 5, 0.9, x + ox, CURB + 5, z - td / 2 - 0.3);
      B.box(fin, 0.9, h - 5, 0.5, x + tw / 2 + 0.3, CURB + 5, z + oz);
      B.box(fin, 0.9, h - 5, 0.5, x - tw / 2 - 0.3, CURB + 5, z + oz);
    }
    B.box(neon(D.accent, 1.8), tw + 1, 1, td + 1, x, CURB + h, z);
    addSignMesh(signs, sm, fourSides(x, z, tw, td, CURB + h - 6, 30).map((p) => ({ ...p, z: p.z + Math.sign(p.z - z) * 0.6, x: p.x + Math.sign(p.x - x) * 0.6 })));
  },
};

export function buildBrand(B, b, signs, colliders) {
  const D = DISTRICTS[b.district];
  const sm = signMaterial(b);
  STYLES[b.style](B, b, D, signs, sm, colliders);
  const bb = b.bounds;
  colliders.addBox(bb.minX, bb.maxX, bb.minZ, bb.maxZ, { brand: b, kind: 'building', height: b.size[2] });
  // light pool color for this building
  return { x: b.x, z: b.z, color: D.color, radius: Math.max(b.size[0], b.size[1]) * 0.9 };
}

// ---------------------------------------------------------------- Google
export function buildGoogle(B, google, signs, colliders, scene) {
  const R = MAP.googleRadius;
  // island + neon ring
  B.cylinder(solid(0x1b1d2e, 0.6, 0.3), R, R + 1, 0.5, 0, 0, 0, 48);
  B.cylinder(neon(0x7fe7ff, 2.6), R + 1.1, R + 1.1, 0.25, 0, 0.3, 0, 48);
  const tR = 16, tH = 64;
  B.cylinder(glass(0x10213d, 0x8fb8ff), tR, tR, tH, 0, 0.5, 0, 32, true);
  const cols = [0x4285f4, 0xea4335, 0xfbbc05, 0x34a853];
  cols.forEach((c, i) => B.cylinder(neon(c, 2.8), tR + 0.35, tR + 0.35, 1.3, 0, 8 + i * 13, 0, 32));
  B.cylinder(glass(0x10213d, 0x8fb8ff), tR * 0.7, tR * 0.7, 8, 0, tH + 0.5, 0, 24, true);
  B.cylinder(neon(0x7fe7ff, 2.5), tR * 0.72, tR * 0.72, 0.6, 0, tH + 8, 0, 24);
  // four ground-level "G" pillars around the island
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const px = Math.cos(a) * (R - 4), pz = Math.sin(a) * (R - 4);
    B.box(solid(0x0d0f1a, 0.4, 0.6), 4, 14, 4, px, 0.5, pz);
    B.box(neon(cols[k], 2.6), 4.3, 0.6, 4.3, px, 14.2, pz);
  }
  const sm = signMaterial({ ...google, sign: { bg: '#ffffff', fg: 'multi:#4285f4,#ea4335,#fbbc05,#4285f4,#34a853,#ea4335', font: '500 190px Arial' } });
  const panels = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    panels.push({ x: Math.sin(a) * (tR + 1.2), y: 50, z: Math.cos(a) * (tR + 1.2), rotY: a, w: 22, h: 5.5 });
  }
  addSignMesh(signs, sm, panels);
  colliders.addCircle(0, 0, R + 0.8, { brand: google, kind: 'building', height: tH });

  // rotating holographic globe (the only per-frame animated object here)
  const globe = new THREE.Group();
  const wire = new THREE.Mesh(
    new THREE.SphereGeometry(11, 20, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.4, 2.4), wireframe: true, transparent: true, opacity: 0.55 }),
  );
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(8, 24, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.45, 1.6), transparent: true, opacity: 0.5 }),
  );
  globe.add(wire, core);
  globe.position.set(0, tH + 24, 0);
  scene.add(globe);
  return globe;
}
