// Brand "worlds" in the spirit of Ralph Breaks the Internet: every company gets
// an iconic building shaped after its product/identity, a plaza floor in its
// colours, and themed props — all still neon-trimmed for the cyberpunk night.
// Geometry is merged by material through the Batcher, so this stays cheap.
//
// Coordinates inside a theme are LOCAL to the brand's block centre, with
// y = height above the sidewalk. Each theme calls k.bounds(hx, hz) to set the
// collision box (kept <= 24 so a sidewalk ring + road surrounds every block).
import * as THREE from 'three';
import { MAP } from '../config/map.js';
import { DISTRICTS } from '../config/brands.js';
import { STYLES, signMaterial, addSignMesh, fourSides, edgeTrim } from './buildings.js';
import { neon, pulseNeon, glass, solid, screenMat } from './materials.js';
import { makeSignTexture } from './textures.js';

const CURB = MAP.curbHeight;
const TAU = Math.PI * 2;
const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const C4 = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

function xf(g, x, y, z, rx = 0, ry = 0, rz = 0) {
  if (rx || ry || rz) g.applyMatrix4(_m.makeRotationFromEuler(_e.set(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}

const texCache = new Map();
function cachedMat(key, make) {
  if (!texCache.has(key)) texCache.set(key, make());
  return texCache.get(key);
}

// brand-coloured lit material with a little self-glow so it reads at night
function bmat(color, glow = 0.3, rough = 0.45, metal = 0.25) {
  const e = new THREE.Color(color).multiplyScalar(glow).getHex();
  return solid(color, rough, metal, e);
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------------ kit
function makeKit(B, b, signs, colliders, root, animated) {
  const ox = b.x, oz = b.z, oy = CURB;
  const sm = signMaterial(b);
  const k = {
    b, sm,
    neon, pulse: pulseNeon, mat: bmat, glass, solid,
    box(m, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
      B.geometry(m, xf(new THREE.BoxGeometry(w, h, d), ox + x, oy + y, oz + z, rx, ry, rz));
    },
    // bottom-anchored box with window UVs (for glass towers)
    tower(m, w, h, d, x, y0, z) { B.box(m, w, h, d, ox + x, oy + y0, oz + z, 0, true); },
    cyl(m, rt, rb, h, x, y, z, seg = 24, rx = 0, rz = 0, open = false, ry = 0) {
      B.geometry(m, xf(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), ox + x, oy + y, oz + z, rx, ry, rz));
    },
    // window-textured cylinder, bottom anchored
    round(m, r, h, x, y0, z, seg = 28) { B.cylinder(m, r, r, h, ox + x, oy + y0, oz + z, seg, true); },
    sph(m, r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 20) {
      const g = new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.6)));
      g.scale(sx, sy, sz);
      B.geometry(m, xf(g, ox + x, oy + y, oz + z));
    },
    hemi(m, r, x, y, z, sy = 1) {
      const g = new THREE.SphereGeometry(r, 28, 12, 0, TAU, 0, Math.PI / 2);
      g.scale(1, sy, 1);
      B.geometry(m, xf(g, ox + x, oy + y, oz + z));
    },
    torus(m, R, t, x, y, z, rx = 0, ry = 0, rz = 0, arc = TAU, seg = 40) {
      B.geometry(m, xf(new THREE.TorusGeometry(R, t, 8, seg, arc), ox + x, oy + y, oz + z, rx, ry, rz));
    },
    cone(m, r, h, x, y, z, seg = 16, rx = 0, rz = 0, ry = 0) {
      B.geometry(m, xf(new THREE.ConeGeometry(r, h, seg), ox + x, oy + y, oz + z, rx, ry, rz));
    },
    ico(m, r, detail, x, y, z) {
      const g = new THREE.IcosahedronGeometry(r, detail);
      B.geometry(m, xf(g, ox + x, oy + y, oz + z));
    },
    // extrude a 2D outline (x right, y up) by depth, centred on depth
    ext(m, pts, depth, x, y, z, rx = 0, ry = 0, rz = 0) {
      const shape = new THREE.Shape(pts.map(([a, c]) => new THREE.Vector2(a, c)));
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
      g.translate(0, 0, -depth / 2);
      B.geometry(m, xf(g, ox + x, oy + y, oz + z, rx, ry, rz));
    },
    trim(m, w, h, d, y0 = 0, t = 0.5, x = 0, z = 0) { edgeTrim(B, m, ox + x, oy + y0, oz + z, w, h, d, t); },
    // text signs on the four faces of a w x d footprint at height y
    signs(y, w, d, maxW = 28, aspect = 4, x = 0, z = 0) {
      addSignMesh(signs, sm, fourSides(ox + x, oz + z, w, d, oy + y, maxW, aspect));
    },
    // four signs tangent to a round building
    signRing(y, r, w, aspect = 4) {
      const panels = [];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        panels.push({ x: ox + Math.sin(a) * r, y: oy + y, z: oz + Math.cos(a) * r, rotY: a, w, h: w / aspect });
      }
      addSignMesh(signs, sm, panels);
    },
    // free-standing sign cube (dark box with a sign on each face)
    signCube(y, size, x = 0, z = 0) {
      const h = size / 4;
      k.box(solid(0x0b0b12, 0.5, 0.5), size, h + 0.6, size, x, y, z);
      k.signs(y, size + 0.1, size + 0.1, size, 4, x, z);
    },
    // classic roadside pylon sign at the block corner (own brand collider)
    pylon(px = 22, pz = 22, height = 18) {
      const X = ox + px, Z = oz + pz;
      B.cylinder(solid(0x2a2a33, 0.4, 0.8), 0.6, 0.6, height, X, oy, Z, 8);
      B.box(solid(0x111111), 12.4, 3.4, 1.2, X, oy + height, Z, Math.PI / 4);
      const c = Math.cos(Math.PI / 4), s = Math.sin(Math.PI / 4);
      addSignMesh(signs, sm, [
        { x: X + s * 0.65, y: oy + height + 1.7, z: Z + c * 0.65, rotY: Math.PI / 4, w: 12, h: 3 },
        { x: X - s * 0.65, y: oy + height + 1.7, z: Z - c * 0.65, rotY: Math.PI / 4 + Math.PI, w: 12, h: 3 },
      ]);
      colliders.addBox(X - 0.8, X + 0.8, Z - 0.8, Z + 0.8, { brand: b, kind: 'pylon', height: height + 4 });
    },
    // a separate (non-merged) group for animated parts
    group(x, y, z) {
      const g = new THREE.Group();
      g.position.set(ox + x, oy + y, oz + z);
      root.add(g);
      return g;
    },
    anim(fn) { animated.push(fn); },
    bounds(hx, hz = hx, height = 40) {
      b.bounds = { minX: ox - hx, maxX: ox + hx, minZ: oz - hz, maxZ: oz + hz };
      k._height = height;
    },
    _height: b.size[2],
  };
  return k;
}

// Plaza floor decal in the brand's colours (one textured quad per brand)
function plazaDecal(root, b, theme) {
  const [c1, c2] = theme.plaza;
  const tex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = c1;
    g.fillRect(0, 0, w, h);
    // tiles
    g.strokeStyle = c2; g.globalAlpha = 0.55; g.lineWidth = 3;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke();
    }
    // repeated brand name, diagonal
    g.globalAlpha = 0.16;
    g.fillStyle = c2;
    g.font = '900 34px Arial';
    g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 4);
    for (let y = -h; y < h; y += 70) {
      for (let x = -w; x < w; x += g.measureText(b.name).width + 40) g.fillText(b.name.toUpperCase(), x + (y % 140 ? 60 : 0), y);
    }
    g.restore();
    // glowing border
    g.globalAlpha = 1; g.strokeStyle = c2; g.lineWidth = 10;
    g.strokeRect(5, 5, w - 10, h - 10);
  });
  const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.75, 0.75, 0.75), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(MAP.blockSize - 1, MAP.blockSize - 1), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(b.x, CURB + 0.015, b.z);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  root.add(mesh);
}


// ------------------------------------------------------------------ statues / mascots
// A cartoon mouse statue (Mickey-style) built from primitives. f = +1 faces +z, -1 faces -z.
function mouseStatue(k, x, z, s = 1, f = 1, y0 = 0) {
  const black = k.mat(0x111116, 0.12, 0.25, 0.4), red = k.mat(0xe0242b, 0.45, 0.35, 0.1);
  const yellow = k.mat(0xffc629, 0.45, 0.35, 0.1), white = k.mat(0xffffff, 0.45, 0.4, 0.05);
  const skin = k.mat(0xf6c89f, 0.3, 0.6, 0);
  const P = (dx, dy, dz) => [x + dx * s, y0 + dy * s, z + dz * s * f];
  k.cyl(k.mat(0xe8e6f0, 0.2, 0.5, 0.2), 3.2 * s, 3.5 * s, 1.5 * s, ...P(0, 0.75, 0), 24);
  k.torus(k.neon(0xffd36b, 2.4), 3.3 * s, 0.15 * s, ...P(0, 1.5, 0), Math.PI / 2);
  const b = 1.5;
  for (const sx of [1, -1]) {
    k.sph(yellow, 1.1 * s, ...P(sx * 1.1, b + 0.55, 0.5), 1, 0.6, 1.6, 14);       // shoes
    k.cyl(black, 0.45 * s, 0.45 * s, 2.2 * s, ...P(sx * 1.1, b + 2, 0), 8);      // legs
    k.sph(white, 0.3 * s, ...P(sx * 0.6, b + 4.3, 1.7), 1, 1, 1, 8);            // buttons
    k.cyl(black, 0.35 * s, 0.35 * s, 3 * s, ...P(sx * 2.3, b + 6.6, 0), 8, 0, sx * 0.7);
    k.sph(white, 0.75 * s, ...P(sx * 3.4, b + 7.8, 0), 1, 1, 1, 12);            // gloves
    k.sph(black, 1.6 * s, ...P(sx * 2.5, b + 11.6, 0), 1, 1, 0.4, 18);         // ears
    k.sph(white, 0.4 * s, ...P(sx * 0.5, b + 10.1, 2), 0.8, 1.6, 0.5, 10);      // eyes
  }
  k.cyl(red, 1.6 * s, 1.95 * s, 2 * s, ...P(0, b + 4, 0), 18);                    // shorts
  k.sph(black, 1.7 * s, ...P(0, b + 6, 0), 1, 1.15, 1, 16);                       // torso
  k.sph(black, 2.3 * s, ...P(0, b + 9.5, 0), 1, 1, 1, 20);                        // head
  k.sph(skin, 1.7 * s, ...P(0, b + 9.1, 1.1), 1, 0.9, 0.8, 16);                   // face
  k.sph(black, 0.4 * s, ...P(0, b + 9.4, 2.5), 1.2, 1, 1, 10);                    // nose
  k.torus(k.mat(0x6a1010, 0.2), 0.8 * s, 0.12 * s, ...P(0, b + 8.8, 2.05), 0, f > 0 ? 0 : Math.PI, Math.PI, Math.PI, 12);
}

// Mouse-ears silhouette (head + 2 ears) as a topiary, balloon or sign
function mouseEars(k, m, x, y, z, s = 1) {
  k.sph(m, 3 * s, x, y, z, 1, 1, 0.8, 20);
  for (const sx of [1, -1]) k.sph(m, 2 * s, x + sx * 3.3 * s, y + 3 * s, z, 1, 1, 0.6, 16);
}

function thumbsUp(k, x, z, f = 1, s = 1) {
  const white = k.mat(0xffffff, 0.5, 0.4, 0.05), blue = k.mat(0x1877f2, 0.5, 0.35, 0.2);
  k.cyl(k.solid(0x101830, 0.4, 0.6), 2.6 * s, 2.8 * s, 1.2 * s, x, 0.6 * s, z, 20);
  k.box(blue, 1.6 * s, 4.2 * s, 3.4 * s, x - 2.2 * s, 3.3 * s, z);                 // cuff
  k.box(white, 3.4 * s, 4.2 * s, 3.4 * s, x + 0.3 * s, 3.3 * s, z);                // fist
  for (let i = 0; i < 3; i++) k.box(k.mat(0xdfe6f5, 0.4), 0.6 * s, 0.1 * s, 3.45 * s, x + 2 * s, 2.1 * s + i * 1.05 * s, z);
  k.box(white, 1.5 * s, 3.6 * s, 1.5 * s, x - 0.6 * s, 7 * s, z + f * 0.6 * s, 0, 0, -0.15);   // thumb
}

function heartBalloon(k, x, z, h, color) {
  const m = k.mat(color, 0.5, 0.2, 0.3);
  k.cyl(k.solid(0xdddddd), 0.04, 0.04, h, x, h / 2, z, 4);
  k.sph(m, 1.25, x - 0.85, h + 2.1, z, 1, 1, 0.7, 14);
  k.sph(m, 1.25, x + 0.85, h + 2.1, z, 1, 1, 0.7, 14);
  k.cone(m, 2.05, 2.6, x, h + 1, z, 16, Math.PI, 0, 0);
}

function mushroom(k, x, z, capColor, s = 1) {
  const cap = k.mat(capColor, 0.45, 0.35, 0.1), cream = k.mat(0xf6ecd0, 0.35, 0.6, 0);
  k.cyl(cream, 1.5 * s, 1.8 * s, 3 * s, x, 1.5 * s, z, 16);
  k.hemi(cap, 3.2 * s, x, 3 * s, z, 0.8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    k.sph(k.mat(0xffffff, 0.5), 0.75 * s, x + Math.cos(a) * 2.2 * s, 4.4 * s, z + Math.sin(a) * 2.2 * s, 1, 0.5, 1, 10);
  }
  k.sph(k.mat(0xffffff, 0.5), 0.8 * s, x, 5.6 * s, z, 1, 0.4, 1, 10);
  for (const sx of [1, -1]) k.box(k.solid(0x111111), 0.35 * s, 1 * s, 0.2 * s, x + sx * 0.5 * s, 2 * s, z + 1.7 * s);
}

function starShape(r1, r2) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + Math.PI / 2, r = i % 2 ? r2 : r1;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

function frogStatue(k, x, y0, z, s = 1) {
  const g = k.mat(0x3fbf3f, 0.4, 0.5, 0.05), white = k.mat(0xffffff, 0.5), black = k.solid(0x111111);
  k.cyl(g, 2.4 * s, 3 * s, 5 * s, x, y0 + 2.5 * s, z, 16);                        // body
  for (let i = 0; i < 9; i++) {                                                   // pointed collar
    const a = (i / 9) * TAU;
    k.cone(g, 1 * s, 2.6 * s, x + Math.cos(a) * 2.8 * s, y0 + 5 * s, z + Math.sin(a) * 2.8 * s, 6, Math.sin(a) * 1.9, -Math.cos(a) * 1.9);
  }
  k.sph(g, 3.4 * s, x, y0 + 7.6 * s, z, 1.3, 0.75, 1, 20);                         // head
  for (const sx of [1, -1]) {
    k.sph(white, 1.3 * s, x + sx * 1.5 * s, y0 + 9.6 * s, z + 1.2 * s, 1, 1, 1, 14);
    k.sph(black, 0.45 * s, x + sx * 1.5 * s, y0 + 9.7 * s, z + 2.4 * s, 1, 1, 0.5, 8);
  }
  k.torus(k.solid(0x7a1010), 2.6 * s, 0.25 * s, x, y0 + 7.2 * s, z + 1.6 * s, 0, 0, Math.PI, Math.PI, 16);
}

function soccerBall(k, x, y, z, r) {
  const white = cachedMat('ball-white', () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, flatShading: true, emissive: 0x333333 }));
  k.ico(white, r, 1, x, y, z);
  const phi = (1 + Math.sqrt(5)) / 2;
  const v = [];
  for (const a of [-1, 1]) for (const b of [-phi, phi]) v.push([0, a, b], [a, b, 0], [b, 0, a]);
  const black = k.solid(0x111111, 0.4, 0.2);
  for (const [vx, vy, vz] of v) {
    const n = Math.hypot(vx, vy, vz);
    k.sph(black, r * 0.33, x + (vx / n) * r * 0.86, y + (vy / n) * r * 0.86, z + (vz / n) * r * 0.86, 1, 1, 1, 10);
  }
}

function trophy(k, x, z, s = 1) {
  const gold = k.mat(0xffc629, 0.55, 0.25, 0.9);
  k.box(k.solid(0x101410, 0.4, 0.6), 2.4 * s, 1.2 * s, 2.4 * s, x, 0.6 * s, z);
  k.cyl(gold, 0.35 * s, 0.6 * s, 2.4 * s, x, 2.4 * s, z, 10);
  k.cyl(gold, 1.9 * s, 0.7 * s, 2.6 * s, x, 4.9 * s, z, 18);
  for (const sx of [1, -1]) k.torus(gold, 0.8 * s, 0.18 * s, x + sx * 1.8 * s, 5 * s, z, 0, 0, 0, TAU, 12);
  k.torus(k.neon(0x39ff6a, 2.2), 1.95 * s, 0.12 * s, x, 6.2 * s, z, Math.PI / 2);
}

function arcadeCabinet(k, x, z, f, color) {
  const body = k.mat(color, 0.3, 0.4, 0.3);
  k.box(body, 2.6, 5.2, 2.2, x, 2.6, z);
  k.box(screenMat(), 2.1, 1.7, 0.2, x, 3.5, z + f * 1.12, -0.25 * f);
  k.box(k.neon(0xffffff, 1.6), 2.3, 0.7, 0.2, x, 4.85, z + f * 1.12);
  k.box(k.solid(0x111111), 2.6, 0.3, 1.2, x, 2.2, z + f * 1.5);
  k.sph(k.neon(0xff3355, 2.4), 0.18, x + 0.4, 2.45, z + f * 1.6, 1, 1, 1, 6);
  k.sph(k.neon(0x39ff6a, 2.4), 0.18, x + 0.8, 2.45, z + f * 1.6, 1, 1, 1, 6);
}

function giraffe(k, x, z) {
  const y = k.mat(0xe8b13a, 0.35, 0.7, 0), sp = k.mat(0x7a4416, 0.15, 0.8, 0);
  k.box(y, 1.8, 2, 4, x, 4.5, z);
  for (const [lx, lz] of C4) k.cyl(y, 0.25, 0.3, 3.6, x + lx * 0.6, 1.8, z + lz * 1.5, 6);
  k.cyl(y, 0.35, 0.55, 5, x, 7.6, z + 2.3, 8, -0.35);
  k.box(y, 0.9, 0.9, 1.9, x, 10, z + 3.4);
  for (const sx of [1, -1]) k.cyl(sp, 0.08, 0.08, 0.8, x + sx * 0.3, 10.7, z + 3.1, 4);
  for (let i = 0; i < 8; i++) k.sph(sp, 0.35, x + (i % 2 ? 0.92 : -0.92), 4.2 + (i % 3) * 0.5, z - 1.5 + i * 0.4, 0.3, 1, 1, 6);
}

function bell(k, x, z) {
  const gold = k.mat(0xffc629, 0.5, 0.3, 0.9);
  k.cyl(k.solid(0x1a0606, 0.4, 0.6), 2.4, 2.6, 1.2, x, 0.6, z, 18);
  k.cyl(gold, 1.2, 2.8, 4, x, 3.8, z, 20);
  k.sph(gold, 1.2, x, 5.8, z, 1, 0.8, 1, 14);
  k.torus(gold, 2.9, 0.3, x, 1.9, z, Math.PI / 2);
  k.sph(gold, 0.7, x, 1.5, z, 1, 1, 1, 10);
}

// ------------------------------------------------------------------ themes
// plaza: [floor colour, line/text colour]; glow: light-pool colour on the roads
export const THEMES = {
  // ============================== TECHNOLOGY
  Amazon: {
    plaza: ['#3a2a18', '#ff9900'], glow: 0xff9900,
    build(k) {
      const tan = k.mat(0xc8965a, 0.22, 0.9, 0), tape = k.mat(0x9c7040, 0.15, 0.6, 0);
      const org = k.neon(0xff9900, 2.6), dark = k.solid(0x232f3e, 0.5, 0.5);
      const w = 38, h = 34, d = 32;
      k.box(tan, w, h, d, 0, h / 2, 0);                 // giant shipping box
      k.box(tape, 7, 0.3, d + 0.1, 0, h + 0.1, 0);      // packing tape over the top
      k.box(tape, 0.3, h * 0.25, 7, w / 2 + 0.05, h * 0.875, 0);
      k.box(tape, 0.3, h * 0.25, 7, -w / 2 - 0.05, h * 0.875, 0);
      k.trim(org, w, h, d, 0, 0.6);
      for (const s of [1, -1]) {                        // the smile, on both faces
        const z = s * (d / 2 + 0.6);
        k.torus(org, 10, 0.9, 0, 15, z, 0, 0, Math.PI, Math.PI);
        k.cone(org, 2, 3.6, s * 10, 16.2, z, 3, 0, -s * 0.5);
      }
      k.signs(26, w, d, 26);
      // parcel stacks on the plaza
      for (const [sx, sz] of C4) {
        k.box(tan, 4, 3, 4, sx * 21.5, 1.5, sz * 18.5, 0, 0.3 * sx, 0);
        k.box(tan, 3, 2.4, 3, sx * 21.5, 4.2, sz * 18.5, 0, -0.2, 0);
        k.box(tape, 0.9, 0.05, 4.05, sx * 21.5, 3.02, sz * 18.5, 0, 0.3 * sx, 0);
      }
      // delivery drone hovering over the roof
      k.box(dark, 3.5, 0.9, 3.5, 0, h + 9, 0);
      for (const [sx, sz] of C4) k.cyl(k.neon(0x00e0ff, 2.6), 1.4, 1.4, 0.15, sx * 2.6, h + 9.6, sz * 2.6, 14);
      k.box(tan, 2, 2, 2, 0, h + 7.5, 0);
      k.bounds(23.5, 20.5, h);
    },
  },

  eBay: {
    plaza: ['#14182a', '#f5af02'], glow: 0x0064d2,
    build(k) {
      const cols = [0xe53238, 0x0064d2, 0xf5af02, 0x86b817];
      cols.forEach((c, i) => {                          // four stacked, twisted coloured blocks
        k.box(k.mat(c, 0.35, 0.35, 0.2), 30, 10, 26, 0, 5 + i * 10, 0, 0, (i % 2 ? 1 : -1) * 0.12, 0);
        k.box(k.neon(0xffffff, 1.6), 30.6, 0.35, 26.6, 0, 10 + i * 10, 0, 0, (i % 2 ? 1 : -1) * 0.12, 0);
      });
      k.signCube(44, 22);
      // auction gavel + sound block
      const wood = k.mat(0x7a4a22, 0.15, 0.5, 0.1);
      k.cyl(wood, 3.2, 3.6, 1.4, -18, 0.7, 17, 20);
      k.cyl(wood, 2.2, 2.2, 7.5, -18, 5, 17, 20, 0, Math.PI / 2, false, 0.6);
      k.cyl(k.neon(0xf5af02, 2), 2.3, 2.3, 0.6, -18, 5, 17, 20, 0, Math.PI / 2, false, 0.6);
      k.cyl(wood, 0.6, 0.6, 12, -13.5, 6.5, 13.5, 10, 0.55, 0.55);
      k.signs(5, 30, 26, 24);
      k.bounds(21.5, 20.5, 48);
    },
  },

  Wikipedia: {
    plaza: ['#1c1d22', '#eaecf0'], glow: 0xdfe6ff,
    build(k) {
      const marble = k.mat(0xe8e6e0, 0.18, 0.7, 0.05);
      k.box(marble, 40, 10, 30, 0, 5, 0);                                   // library
      k.box(marble, 42, 1.2, 32, 0, 10.6, 0);
      for (const s of [1, -1]) {
        for (let i = 0; i < 8; i++) k.cyl(marble, 1, 1.1, 10, -15.75 + i * 4.5, 5, s * 16.2, 14);
        k.ext(marble, [[-21, 0], [21, 0], [0, 6]], 1.5, 0, 11.2, s * 15.4);  // pediment
      }
      // the puzzle globe
      const globe = new THREE.MeshStandardMaterial({ color: 0xf0f0f4, roughness: 0.4, metalness: 0.1, flatShading: true, emissive: 0x3a3a46 });
      k.ico(globe, 13, 1, 0, 26, 0);
      k.torus(k.neon(0x7fe7ff, 2.2), 14.5, 0.35, 0, 26, 0, Math.PI / 2);
      k.torus(k.neon(0x7fe7ff, 1.6), 14.2, 0.25, 0, 26, 0, 0, 0, 0);
      k.signs(5, 40, 30, 26);
      // stacks of giant books
      const bookCols = [0x3366cc, 0xcc3333, 0x339966, 0xffcc33];
      C4.forEach(([sx, sz], i) => {
        for (let j = 0; j < 3; j++) {
          k.box(k.mat(bookCols[(i + j) % 4], 0.25), 5, 1.2, 3.6, sx * 21, 0.6 + j * 1.25, sz * 19, 0, j * 0.25, 0);
          k.box(k.mat(0xf6f1e0, 0.3), 4.6, 0.9, 3.7, sx * 21 + 0.3, 0.6 + j * 1.25, sz * 19, 0, j * 0.25, 0);
        }
      });
      k.bounds(23.5, 21.5, 40);
    },
  },

  'National Geographic': {
    plaza: ['#14120a', '#ffce00'], glow: 0xffce00,
    build(k) {
      const y = k.neon(0xffce00, 2.2), ym = k.mat(0xffce00, 0.5, 0.4, 0.3);
      k.tower(k.glass(0x0b0f14, 0xffd76a, true, 0.8), 26, 34, 26, 0, 0, 0);
      // the iconic yellow rectangle as a giant portal frame around the tower
      const H = 46, W = 34;
      for (const [sx, sz] of C4) k.box(ym, 3, H, 3, sx * W / 2, H / 2, sz * W / 2);
      for (const s of [1, -1]) {
        k.box(ym, W + 3, 3, 3, 0, H, s * W / 2);
        k.box(ym, 3, 3, W + 3, s * W / 2, H, 0);
      }
      k.trim(y, W + 3.2, H + 1.6, W + 3.2, 0, 0.35);
      k.signs(38, 26, 26, 24);
      // explorer's globe on a tripod
      k.sph(k.mat(0x2a6fb5, 0.35, 0.5, 0.2), 3, -20, 7, 18);
      k.torus(ym, 3.4, 0.25, -20, 7, 18, 0, 0, 0.4);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        k.cyl(k.solid(0x3a3a3a), 0.2, 0.2, 5, -20 + Math.cos(a) * 1.2, 2.3, 18 + Math.sin(a) * 1.2, 6, Math.sin(a) * 0.3, -Math.cos(a) * 0.3);
      }
      giraffe(k, 20.3, -11);
      k.bounds(22, 20.5, H);
    },
  },

  Kickstarter: {
    plaza: ['#05261a', '#05ce78'], glow: 0x05ce78,
    build(k) {
      const g = k.mat(0x05ce78, 0.45, 0.3, 0.3), wN = k.neon(0xeafff4, 2);
      k.box(k.solid(0x0f1a14, 0.5, 0.4), 36, 5, 24, 0, 2.5, 0);       // plinth
      // a giant 3D letter K
      k.box(g, 10, 44, 20, -10, 27, 0);
      k.box(g, 30, 9, 20, 5.5, 37, 0, 0, 0, 0.81);
      k.box(g, 30, 9, 20, 5.5, 16, 0, 0, 0, -0.81);
      k.trim(wN, 10, 44, 20, 5, 0.4, -10, 0);
      k.signs(2.5, 36, 24, 20);
      // "launch" rocket on the plaza
      const white = k.mat(0xf2f2f2, 0.25, 0.4, 0.4);
      k.cyl(white, 2.2, 2.2, 12, -19, 7, 18, 18);
      k.cone(k.mat(0x05ce78, 0.5), 2.2, 4, -19, 15, 18, 18);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        k.box(k.mat(0x05ce78, 0.5), 0.4, 4, 2.6, -19 + Math.cos(a) * 2.6, 2.6, 18 + Math.sin(a) * 2.6, 0, -a, 0);
      }
      k.cone(k.neon(0xff9a3c, 2.8), 1.6, 3, -19, 0.2, 18, 12, Math.PI);
      k.bounds(22, 20.5, 49);
    },
  },

  Spotify: {
    plaza: ['#0c0f0d', '#1ed760'], glow: 0x1ed760,
    build(k) {
      const green = k.mat(0x1ed760, 0.55, 0.35, 0.2), black = k.solid(0x121212, 0.4, 0.6);
      k.round(k.glass(0x0a120c, 0x1ed760, false, 0.9), 15, 28, 0, 0, 0);  // round tower
      for (let y = 6; y < 28; y += 7) k.cyl(k.neon(0x1ed760, 2.4), 15.3, 15.3, 0.5, 0, y, 0, 32);
      // the logo as a giant upright disc with three sound-wave arcs
      k.cyl(green, 13, 13, 2.4, 0, 43, 0, 40, Math.PI / 2);
      for (const s of [1, -1]) {
        [[8.5, 0.9, 41.5], [6.5, 0.8, 43.5], [4.6, 0.65, 45.2]].forEach(([R, t, cy], i) => {
          k.torus(black, R, t, 0, cy - 4 + i * 0.3, s * 1.3, 0, 0, Math.PI / 2 - 0.85, 1.7);
        });
      }
      k.box(black, 3, 4, 3, 0, 29.5, 0);
      // headphones around the disc
      k.torus(k.solid(0x1a1a1a, 0.3, 0.8), 15.5, 0.8, 0, 43, 0, 0, Math.PI / 2, 0, Math.PI);
      for (const s of [1, -1]) k.cyl(black, 3.4, 3.4, 3, 0, 43, s * 15.5, 24, Math.PI / 2);
      k.signRing(8, 15.4, 18);
      // pulsing equaliser bars around the plaza
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU, r = 21;
        const h = 2.5 + ((i * 7) % 5) * 1.3;
        k.box(k.pulse(0x1ed760, 2.6, 3.2, i % 4), 1.4, h, 1.4, Math.cos(a) * r, h / 2, Math.sin(a) * r, 0, -a, 0);
      }
      k.bounds(22.5, 22.5, 56);
    },
  },

  Cisco: {
    plaza: ['#06141c', '#049fd9'], glow: 0x049fd9,
    build(k) {
      const heights = [10, 20, 10, 30, 46, 30, 10, 20, 10];
      const bar = k.mat(0x049fd9, 0.45, 0.3, 0.5);
      k.box(k.solid(0x0d1a22, 0.5, 0.5), 40, 4, 26, 0, 2, 0);
      heights.forEach((h, i) => {                        // the "bridge" bars logo as glowing towers
        const x = -17.6 + i * 4.4;
        k.box(bar, 2.6, h, 12, x, 4 + h / 2, 0);
        k.box(k.neon(0xbff0ff, 2.2), 2.8, 0.6, 12.2, x, 4 + h, 0);
        k.box(k.neon(0xbff0ff, 1.4), 0.3, h, 0.3, x, 4 + h / 2, 6.1);
        k.box(k.neon(0xbff0ff, 1.4), 0.3, h, 0.3, x, 4 + h / 2, -6.1);
      });
      k.signs(3, 40, 26, 16);
      // network cables of light across the plaza
      const cable = k.pulse(0x049fd9, 2.2, 4, 1);
      for (const [sx, sz] of C4) k.box(cable, 0.4, 0.06, 14, sx * 21, 0.05, sz * 10, 0, 0, 0);
      for (const s of [1, -1]) k.box(cable, 40, 0.06, 0.4, 0, 0.05, s * 18);
      k.bounds(20.5, 13.5, 50);
    },
  },

  Apple: {
    plaza: ['#121418', '#f5f5f7'], glow: 0xeaf0ff,
    build(k) {
      // clear glass cube store with a bright interior
      const W = 38, H = 34;
      const pane = cachedMat('apple-glass', () => new THREE.MeshStandardMaterial({
        color: 0xbfd8ff, metalness: 0.9, roughness: 0.04, transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 2.5,
      }));
      k.box(k.mat(0xf4f6fa, 0.55, 0.4, 0.1), W, 0.4, W, 0, 0.2, 0);                   // floor
      k.box(k.neon(0xf2f6ff, 1.1), W - 1, 0.3, W - 1, 0, H - 0.4, 0);               // light ceiling
      for (let r = -1; r <= 1; r++) {
        for (const sx of [-1, 1]) {
          k.box(k.mat(0xd8b98a, 0.3, 0.5, 0), 9, 1, 3, sx * 9, 1.4, r * 10);          // wooden tables
          for (let d = -1; d <= 1; d++) k.box(k.solid(0x1a1a1e, 0.2, 0.8, 0x2a3a6a), 1.6, 0.1, 1.1, sx * 9 + d * 3, 1.95, r * 10);
        }
      }
      k.cyl(k.mat(0xdfe3ea, 0.2, 0.2, 0.9), 2.5, 2.5, H, 0, H / 2, 0, 20);            // glass lift core
      k.box(pane, W, H, W, 0, H / 2, 0);
      k.trim(k.neon(0xf2f6ff, 2.4), W, H, W, 0, 0.6);
      k.signs(H * 0.62, W, W, 30);
      // floating silver apple over the glass cube
      const silver = k.mat(0xdfe3ea, 0.35, 0.2, 0.9);
      k.sph(silver, 8, 3.5, 47, 0, 0.95, 1.0, 1.0, 28);
      k.sph(silver, 8, -3.5, 47, 0, 0.95, 1.0, 1.0, 28);
      k.cyl(k.solid(0x6b4a2a), 0.5, 0.6, 4, 0, 56, 0, 8, 0, 0.2);
      k.sph(k.mat(0x6fd36f, 0.5), 3, 2.6, 58, 0, 0.45, 1, 0.2);
      k.torus(k.neon(0xffffff, 2.4), 13, 0.25, 0, 47, 0, Math.PI / 2);
      // minimalist light strips on the plaza
      for (const s of [1, -1]) k.box(k.neon(0xf2f6ff, 1.6), 44, 0.06, 0.3, 0, 0.05, s * 22);
      k.bounds(19.5, 19.5, 60);
    },
  },

  // ============================== SOCIAL
  YouTube: {
    plaza: ['#1a0606', '#ff0000'], glow: 0xff2020,
    build(k) {
      const red = k.mat(0xff0000, 0.45, 0.35, 0.2), white = k.neon(0xffffff, 2.2);
      const w = 40, h = 26, d = 30;
      k.box(red, w, h, d, 0, h / 2, 0);                  // the play-button block
      k.trim(k.neon(0xff6060, 2), w, h, d, 0, 0.5);
      for (const s of [1, -1]) k.ext(white, [[-6, -7.5], [-6, 7.5], [8, 0]], 1.6, 0, 11, s * (d / 2 + 0.5), 0, s > 0 ? 0 : Math.PI);
      k.signs(22, w, d, 22);
      // giant screen on the roof
      k.box(k.solid(0x111111), 1, 10, 1, 0, h + 5, 0);
      k.box(screenMat(), 26, 12, 1, 0, h + 14, 0);
      // little play-button kiosks
      for (const [sx, sz] of C4) {
        k.box(red, 4, 3, 1.2, sx * 21, 2.5, sz * 18, 0, sx * 0.6, 0);
        k.box(k.solid(0x222222), 0.4, 1.5, 0.4, sx * 21, 0.5, sz * 18);
      }
      bell(k, 13, 17.8);
      bell(k, -13, -17.8);
      k.bounds(23, 19.5, 46);
    },
  },

  Facebook: {
    plaza: ['#0a1430', '#1877f2'], glow: 0x1877f2,
    build(k) {
      const blue = k.glass(0x0d2a66, 0x5c9dff, false, 0.9);
      k.tower(blue, 30, 54, 30, 0, 0, 0);
      k.trim(k.neon(0x1877f2, 2.6), 30, 54, 30, 0, 0.6);
      const f = k.neon(0xffffff, 1.25);
      for (const s of [1, -1]) {                         // giant lowercase f on both faces
        const z = s * 15.6;
        k.box(f, 4.5, 30, 1, -1, 25, z);
        k.box(f, 9, 4.5, 1, 2.2, 38, z);
        k.box(f, 13, 4, 1, -0.5, 30, z);
      }
      k.signs(48, 30, 30, 26);
      // chat bubbles on the plaza
      const bub = k.mat(0x1877f2, 0.6, 0.3, 0.2);
      C4.forEach(([sx, sz]) => {
        k.sph(bub, 3, sx * 20, 5, sz * 19, 1.4, 1, 0.6);
        k.cone(bub, 1, 2.2, sx * 20 - sx * 2, 2.6, sz * 19, 6, 0, sx * 0.6);
        for (let i = -1; i <= 1; i++) k.sph(k.neon(0xffffff, 2), 0.45, sx * 20 + i * 1.3, 5, sz * 19 + sz * 1.8, 1, 1, 1, 8);
        k.cyl(k.solid(0x222233), 0.3, 0.3, 3, sx * 20, 1.5, sz * 19, 6);
      });
      thumbsUp(k, 0, 18.5, 1);
      thumbsUp(k, 0, -18.5, -1);
      k.bounds(22.5, 21.5, 54);
    },
  },

  X: {
    plaza: ['#050505', '#e7e9ea'], glow: 0xcfd8e6,
    build(k) {
      k.tower(k.glass(0x050505, 0x8a8a8a, false, 0.7), 32, 16, 32, 0, 0, 0);
      k.trim(k.neon(0xffffff, 2), 32, 16, 32, 0, 0.4);
      const xn = k.neon(0xffffff, 2.6), xd = k.solid(0x0a0a0a, 0.3, 0.9);
      for (const ry of [0, Math.PI / 2]) {               // a 3D letter X, readable from all sides
        k.box(xd, 6, 46, 6, 0, 38, 0, 0, ry, 0.62);
        k.box(xd, 6, 46, 6, 0, 38, 0, 0, ry, -0.62);
        k.box(xn, 1.2, 46.4, 6.3, 0, 38, 0, 0, ry, 0.62);
        k.box(xn, 1.2, 46.4, 6.3, 0, 38, 0, 0, ry, -0.62);
      }
      k.signs(8, 32, 32, 26);
      k.bounds(17, 17, 60);
    },
  },

  Instagram: {
    plaza: ['#1e0a24', '#d62976'], glow: 0xd62976,
    build(k) {
      const grad = cachedMat('ig-grad', () => new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.95, 0.95, 0.95),
        map: canvasTex(256, 256, (g, w, h) => {
          const gr = g.createLinearGradient(0, h, w, 0);
          ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5'].forEach((c, i) => gr.addColorStop(i / 4, c));
          g.fillStyle = gr; g.fillRect(0, 0, w, h);
        }),
      }));
      const s = 32;
      k.box(grad, s, 30, s, 0, 15, 0);                    // the camera cube
      k.trim(k.neon(0xffffff, 2), s, 30, s, 0, 0.6);
      const white = k.neon(0xffffff, 1.3);
      for (const sz of [1, -1]) {
        k.torus(white, 8.5, 1.5, 0, 12.5, sz * (s / 2 + 0.6), 0, 0, 0);
        k.cyl(k.solid(0x120818, 0.1, 0.9), 6.6, 6.6, 0.6, 0, 12.5, sz * (s / 2 + 0.3), 32, Math.PI / 2);
        k.sph(white, 1.6, 10, 22.5, sz * (s / 2 + 0.8), 1, 1, 0.5, 12);
      }
      k.signs(27, s, s, 22);
      // polaroid frames on the plaza
      C4.forEach(([sx, sz], i) => {
        k.box(k.mat(0xf8f8f8, 0.4), 6, 7, 0.4, sx * 21, 3.8, sz * 18, 0, sx * 0.4, sx * 0.08);
        k.box(screenMat(), 5, 4.8, 0.45, sx * 21, 4.4, sz * 18, 0, sx * 0.4, sx * 0.08);
        k.cyl(k.solid(0x333333), 0.15, 0.15, 1, sx * 21, 0.5, sz * 18, 6);
      });
      for (const [sx, sz] of C4) heartBalloon(k, sx * 9, sz * 18.2, 6 + (sx > 0 ? 1.5 : 0), sx * sz > 0 ? 0xff2d6f : 0xfa7e1e);
      k.bounds(23, 19.5, 31);
    },
  },

  Snapchat: {
    plaza: ['#2a2a00', '#fffc00'], glow: 0xfffc00,
    build(k) {
      const yellow = k.mat(0xfffc00, 0.45, 0.35, 0.1), ghost = k.mat(0xf2f2f2, 0.22, 0.35, 0.05);
      k.box(yellow, 36, 6, 36, 0, 3, 0);
      k.trim(k.neon(0xfffc00, 1.8), 36, 6, 36, 0, 0.5);
      k.torus(k.neon(0xfffc00, 2.2), 10.9, 0.3, 0, 7.5, 0, Math.PI / 2);
      // the ghost
      k.cyl(ghost, 10, 10.5, 15, 0, 13.5, 0, 32);
      k.hemi(ghost, 10, 0, 21, 0, 1.1);
      for (let i = 0; i < 10; i++) {                       // wavy hem
        const a = (i / 10) * TAU;
        k.sph(ghost, 2.6, Math.cos(a) * 9.4, 6.8, Math.sin(a) * 9.4, 1, 0.8, 1, 12);
      }
      for (const s of [1, -1]) k.sph(ghost, 2.2, s * 10.5, 15, 0, 1.6, 0.8, 0.9, 12);  // arms
      k.torus(k.neon(0x111111, 1), 10.6, 0.25, 0, 21, 0, Math.PI / 2);
      k.signs(3, 36, 36, 24);
      // mini ghosts
      for (const [sx, sz] of C4) {
        k.cyl(ghost, 1.4, 1.5, 2, sx * 21.5, 7.2, sz * 21.5, 14);
        k.hemi(ghost, 1.4, sx * 21.5, 8.2, sz * 21.5, 1.1);
        k.cyl(k.solid(0x333333), 0.2, 0.2, 6.2, sx * 21.5, 3.1, sz * 21.5, 6);
      }
      k.bounds(22.5, 22.5, 33);
    },
  },

  Pinterest: {
    plaza: ['#24040a', '#e60023'], glow: 0xe60023,
    build(k) {
      const red = k.mat(0xe60023, 0.5, 0.3, 0.3), metal = k.solid(0xcfd3da, 0.2, 0.95);
      k.box(k.solid(0x1a0a0e, 0.5, 0.4), 30, 6, 30, 0, 3, 0);
      k.trim(k.neon(0xe60023, 2.2), 30, 6, 30, 0, 0.5);
      // a giant push-pin stuck into the plinth
      k.cone(metal, 2, 16, 0, 14, 0, 16, Math.PI);
      k.cyl(red, 11, 11, 4, 0, 24, 0, 40);
      k.cyl(red, 6, 7, 10, 0, 31, 0, 32);
      k.sph(red, 10, 0, 42, 0, 1, 0.8, 1, 32);
      k.torus(k.neon(0xffffff, 1.8), 11.1, 0.3, 0, 26, 0, Math.PI / 2);
      k.signs(3, 30, 30, 24);
      // little pins dotted around
      const pins = [[18, 18], [-18, 17], [17, -18], [-17, -17], [0, 19], [19, 0]];
      pins.forEach(([x, z], i) => {
        const t = 0.3 * (i % 2 ? 1 : -1);
        k.cyl(metal, 0.15, 0.15, 3, x, 1.5, z, 6, t, t);
        k.sph(red, 1.5, x + t * 3, 3.5, z + t * 3, 1, 1, 1, 12);
      });
      k.bounds(20, 20, 50);
    },
  },

  Reddit: {
    plaza: ['#260c02', '#ff4500'], glow: 0xff4500,
    build(k) {
      const org = k.mat(0xff4500, 0.5, 0.35, 0.2), white = k.mat(0xffffff, 0.6, 0.3, 0.05);
      k.cyl(org, 16, 16, 8, 0, 4, 0, 40);
      k.hemi(k.glass(0x2a0d02, 0xff8a50, true, 0.8), 15.5, 0, 8, 0, 0.6);
      // alien head on top
      k.sph(white, 9, 0, 22, 0, 1.35, 0.85, 1.1, 32);
      for (const s of [1, -1]) {
        for (const ex of [-4, 4]) k.sph(k.neon(0xff4500, 2.6), 1.9, ex, 23, s * 9.4, 1, 1, 0.6, 14);
        k.torus(k.neon(0x222222, 1), 3.5, 0.35, 0, 19.5, s * 9.6, 0, 0, Math.PI, Math.PI);
        k.sph(white, 2.4, s * 12, 25.5, 0, 0.8, 1, 1, 14);       // ears
      }
      k.cyl(k.solid(0x222222), 0.4, 0.4, 7, 2.2, 32, 0, 8, 0, -0.35);
      k.sph(org, 1.9, 3.5, 35.6, 0, 1, 1, 1, 14);
      k.signRing(4, 16.2, 20);
      // upvote arrows
      for (const [sx, sz] of C4) {
        const up = k.pulse(0xff4500, 2.6, 2.4, sx + sz);
        k.cone(up, 2.6, 3.4, sx * 21, 5.4, sz * 20, 4, 0, 0, Math.PI / 4);
        k.box(up, 1.8, 3.6, 1.8, sx * 21, 2, sz * 20, 0, Math.PI / 4, 0);
      }
      k.bounds(23.5, 22.5, 38);
    },
  },

  // ============================== DISNEY & ENTERTAINMENT
  Disney: {
    plaza: ['#0b1236', '#ffd36b'], glow: 0x6f8bff,
    build(k) {
      STYLES.castle(k.B, k.b, DISTRICTS.disney, k.signsGroup, k.sm);
      // golden star lanterns and firework bursts
      for (const [sx, sz] of C4) {
        k.cyl(k.solid(0x2a2240, 0.4, 0.7), 0.3, 0.4, 7, sx * 19, 3.5, sz * 17, 8);
        k.ico(k.neon(0xffd36b, 3), 1.1, 0, sx * 19, 7.8, sz * 17);
      }
      const fw = [[0xff7ad9, -14, 62, 6], [0xffd36b, 12, 68, -4], [0x7fd0ff, 2, 74, 10]];
      fw.forEach(([c, x, y, z]) => {
        const m = cachedMat('fw' + c, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.2), wireframe: true }));
        k.ico(m, 5, 1, x, y, z);
      });
      // mouse statues + ears topiary on both street fronts, and a giant ears balloon
      const hedge = k.mat(0x2e8b3a, 0.25, 0.9, 0);
      for (const f of [1, -1]) {
        mouseStatue(k, -9, f * 19, 0.82, f);
        k.box(k.mat(0x6b4a2a, 0.1), 5, 1.6, 3, 9, 0.8, f * 19);
        mouseEars(k, hedge, 9, 5, f * 19, 0.8);
      }
      mouseEars(k, k.mat(0xff2f6e, 0.5, 0.25, 0.3), 0, 86, 0, 2.2);
      k.cyl(k.solid(0xdddddd), 0.08, 0.08, 26, 0, 67, 0, 4);
      k.bounds(22, 22, 52);
    },
  },

  Disneyland: {
    plaza: ['#24083a', '#ff7ad9'], glow: 0xff7ad9,
    build(k) {
      // Ferris wheel (animated, kept as a separate group)
      const wheel = k.group(0, 23, 0);
      const pink = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7ad9).multiplyScalar(2.2) });
      const cyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fe7ff).multiplyScalar(2) });
      wheel.add(new THREE.Mesh(new THREE.TorusGeometry(18, 0.55, 8, 64), pink));
      wheel.add(new THREE.Mesh(new THREE.TorusGeometry(11, 0.4, 8, 48), cyan));
      const spokeGeo = new THREE.BoxGeometry(0.4, 36, 0.4);
      const cabGeo = new THREE.BoxGeometry(2.4, 2.4, 2.4);
      const cabCols = [0xffd36b, 0x7fe7ff, 0xa95cff, 0xff4f9a];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const sp = new THREE.Mesh(spokeGeo, pink);
        sp.rotation.z = a;
        wheel.add(sp);
        const cab = new THREE.Mesh(cabGeo, new THREE.MeshStandardMaterial({ color: cabCols[i % 4], emissive: cabCols[i % 4], emissiveIntensity: 0.6 }));
        cab.position.set(Math.cos(a) * 18, Math.sin(a) * 18, 0);
        cab.userData.counter = true;
        wheel.add(cab);
      }
      k.anim((t, dt) => {
        wheel.rotation.z += dt * 0.12;
        for (const c of wheel.children) if (c.userData.counter) c.rotation.z = -wheel.rotation.z;
      });
      // A-frame supports + hub
      const steel = k.solid(0xd8d0f0, 0.3, 0.8);
      for (const s of [1, -1]) {
        k.box(steel, 1, 26, 1, -6, 11, s * 3, 0, 0, -0.25);
        k.box(steel, 1, 26, 1, 6, 11, s * 3, 0, 0, 0.25);
      }
      k.cyl(k.neon(0xffd36b, 2.6), 1.6, 1.6, 7, 0, 23, 0, 16, Math.PI / 2);
      // entrance gates with signs, front and back
      for (const s of [1, -1]) {
        const z = s * 17;
        k.box(k.mat(0x3a0d63, 0.4), 2, 10, 2, -11, 5, z);
        k.box(k.mat(0x3a0d63, 0.4), 2, 10, 2, 11, 5, z);
        k.cone(k.mat(0xff4fb8, 0.4), 1.8, 4, -11, 12, z, 8);
        k.cone(k.mat(0xff4fb8, 0.4), 1.8, 4, 11, 12, z, 8);
        k.box(k.solid(0x1a0630), 22, 5, 1.2, 0, 11, z);
        addSignMesh(k.signsGroup, k.sm, [
          { x: k.b.x, y: CURB + 11, z: k.b.z + z + 0.7, rotY: 0, w: 20, h: 5 },
          { x: k.b.x, y: CURB + 11, z: k.b.z + z - 0.7, rotY: Math.PI, w: 20, h: 5 },
        ]);
      }
      // teacup ride + mouse-ear balloons
      const pastel = [0xff9ad5, 0x9ad8ff, 0xffe08a, 0xb79aff];
      const bcs = [0xff2f6e, 0x7fd0ff, 0xffd36b, 0xa95cff];
      C4.forEach(([sx, sz], i) => {
        const x = sx * 14, z = sz * 11;
        k.cyl(k.mat(0xffffff, 0.3), 2.8, 2.8, 0.3, x, 0.3, z, 20);
        k.cyl(k.mat(pastel[i], 0.45, 0.35, 0.1), 2.1, 1.4, 2.2, x, 1.6, z, 20);
        k.torus(k.neon(0xffd36b, 2), 2.1, 0.15, x, 2.7, z, Math.PI / 2);
        k.torus(k.mat(pastel[i], 0.45), 0.7, 0.2, x + 2.2, 1.7, z, 0, 0, 0, TAU, 10);
        k.cyl(k.solid(0xdddddd), 0.05, 0.05, 9, sx * 19, 4.5, sz * 5, 4);
        mouseEars(k, k.mat(bcs[i], 0.5, 0.2, 0.3), sx * 19, 10.5, sz * 5, 0.45);
      });
      k.bounds(21, 19, 42);
    },
  },

  Pixar: {
    plaza: ['#101826', '#ffd23f'], glow: 0x9fb8ff,
    build(k) {
      const base = k.solid(0x1a1530, 0.5, 0.3);
      k.box(base, 34, 10, 34, 0, 5, 0);
      k.box(k.neon(0x7fe7ff, 2.2), 34.4, 0.5, 34.4, 0, 10.2, 0);
      k.hemi(k.glass(0xdfe6ff, 0x9fb8ff, false, 0.5), 13, 0, 10, 0);
      // giant desk lamp on the roof
      const lamp = k.mat(0xe4e6ec, 0.25, 0.3, 0.85);
      k.cyl(lamp, 3.2, 3.6, 1.2, -9, 10.6, -6, 24);
      k.box(lamp, 1, 13, 1, -7, 16.5, -6, 0, 0, -0.35);
      k.sph(lamp, 1.2, -4.8, 22.6, -6, 1, 1, 1, 12);
      k.box(lamp, 1, 10, 1, -0.6, 23.6, -6, 0, 0, -1.25);
      k.cone(lamp, 4, 6, 4.4, 22.2, -6, 24, 0, 2.3);
      k.sph(k.neon(0xfff3c4, 3), 1.8, 5.6, 21.2, -6, 1, 1, 1, 12);
      // the bouncy ball
      k.sph(k.mat(0xffd23f, 0.5, 0.3, 0.1), 5, 7, 15, 7, 1, 1, 1, 24);
      k.torus(k.mat(0x2f6bff, 0.5), 5.05, 0.7, 7, 15, 7, Math.PI / 2);
      k.ico(k.mat(0xe0242b, 0.6), 1.6, 0, 7, 17.5, 11.6);
      k.signs(5, 34, 34, 26);
      k.bounds(17.5, 17.5, 28);
    },
  },

  Marvel: {
    plaza: ['#2a0406', '#ec1d24'], glow: 0xec1d24,
    build(k) {
      const w = 40, h = 32, d = 30;
      k.box(k.mat(0xb3141a, 0.4, 0.4, 0.2), w, h, d, 0, h / 2, 0);
      // comic-book panel grid on the facades
      const ink = k.neon(0xffffff, 1.5);
      for (const s of [1, -1]) {
        for (const y of [10, 20]) k.box(ink, w, 0.6, 0.3, 0, y, s * (d / 2 + 0.15));
        for (const x of [-10, 6]) k.box(ink, 0.6, 10, 0.3, x, 5, s * (d / 2 + 0.15));
        for (const x of [-4, 12]) k.box(ink, 0.6, 10, 0.3, x, 15, s * (d / 2 + 0.15));
      }
      k.trim(k.neon(0xec1d24, 2.6), w, h, d, 0, 0.5);
      k.signs(26, w, d, 30);
      // round shield on the roof
      [[11, 0xec1d24], [8.5, 0xffffff], [6, 0xec1d24], [3.6, 0x1d4fd8]].forEach(([r, c], i) => {
        k.cyl(k.mat(c, 0.5, 0.3, 0.6), r, r, 1.2 + i * 0.25, 0, h + 12, 0, 40, Math.PI / 2);
      });
      const star = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + Math.PI / 2, r = i % 2 ? 1.4 : 3.3;
        star.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      k.ext(k.neon(0xffffff, 2), star, 2.4, 0, h + 12, 0);
      k.box(k.solid(0x222222), 1, 2, 1, 0, h + 1, 0);
      // a hammer dropped on the plaza
      const steel = k.solid(0x8e96a3, 0.3, 0.9);
      k.box(steel, 6, 3.6, 3.6, -19, 1.8, 18, 0, 0.5, 0);
      k.cyl(k.mat(0x6b4a2a, 0.1), 0.6, 0.6, 9, -15.5, 1.4, 15.5, 10, 0, Math.PI / 2, false, 0.5 - Math.PI / 2);
      k.bounds(22, 20.5, 55);
    },
  },

  Lucasfilm: {
    plaza: ['#05050a', '#ffe81f'], glow: 0x5a8cff,
    build(k) {
      // the building is a giant astromech droid
      const white = k.mat(0xeef0f5, 0.25, 0.4, 0.3), blue = k.mat(0x2f5fd0, 0.45, 0.35, 0.3);
      const silver = k.mat(0xcfd5df, 0.25, 0.2, 0.9);
      k.cyl(white, 12, 12, 24, 0, 13, 0, 40);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        k.box(blue, 4, i % 2 ? 7 : 4, 0.5, Math.sin(a) * 12.1, 8 + (i % 3) * 5, Math.cos(a) * 12.1, 0, a, 0);
      }
      k.torus(k.neon(0x4fa8ff, 2.4), 12.1, 0.35, 0, 24.5, 0, Math.PI / 2, 0, 0, TAU, 48);
      k.hemi(silver, 12, 0, 25, 0, 0.85);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        k.box(blue, 3, 2.5, 0.5, Math.sin(a) * 10.6, 29, Math.cos(a) * 10.6, 0, a, 0);
      }
      for (const f of [1, -1]) {
        k.sph(k.solid(0x111111, 0.1, 0.9), 2, 0, 31, f * 8.6, 1, 1, 1, 14);       // eye
        k.sph(k.neon(0xff3344, 3), 0.7, 3, 29, f * 9.6, 1, 1, 1, 8);
      }
      for (const sx of [1, -1]) {                                              // side legs
        k.box(white, 3, 26, 5, sx * 14, 12, 0, 0, 0, sx * 0.08);
        k.box(blue, 3.2, 6, 3, sx * 14, 20, 0);
        k.box(white, 5, 3, 8, sx * 15, 1.5, 0);
      }
      k.box(white, 4, 4, 5, 0, 2, 0);
      k.signRing(14, 12.4, 16);
      // crossed glowing sabers in front, both sides
      for (const s of [1, -1]) {
        const z = s * 18.5;
        k.cyl(k.neon(0x4fa8ff, 3), 0.55, 0.55, 22, -4, 11, z, 10, 0, 0.5);
        k.cyl(k.neon(0xff3344, 3), 0.55, 0.55, 22, 4, 11, z, 10, 0, -0.5);
        k.cyl(k.solid(0x2a2a2e, 0.3, 0.9), 0.75, 0.75, 4, -9.8, 0.9, z, 10, 0, 0.5);
        k.cyl(k.solid(0x2a2a2e, 0.3, 0.9), 0.75, 0.75, 4, 9.8, 0.9, z, 10, 0, -0.5);
      }
      // a grey moon-station hovering over the spire
      k.sph(k.mat(0x8e929c, 0.2, 0.6, 0.6), 6, 18, 52, -10, 1, 1, 1, 24);
      k.torus(k.neon(0x9fb8ff, 1.6), 6.05, 0.2, 18, 52, -10, Math.PI / 2);
      k.bounds(18, 20, 36);
    },
  },

  'The Muppets': {
    plaza: ['#0a2412', '#ffd36b'], glow: 0x1c8c3c,
    build(k) {
      STYLES.theater(k.B, k.b, DISTRICTS.disney, k.signsGroup, k.sm);
      const [w, d, h] = k.b.size;
      // red stage curtains on both long facades
      const curtain = k.mat(0xb3121f, 0.35, 0.9, 0);
      for (const s of [1, -1]) {
        for (let i = 0; i < 10; i++) k.cyl(curtain, 0.8, 1, 9, -13.5 + i * 3, 12.5, s * (d / 2 + 0.6), 8);
        k.box(k.mat(0xffd36b, 0.6, 0.3, 0.8), w * 0.85, 1.2, 1.2, 0, 17.5, s * (d / 2 + 0.8));
      }
      // roof spotlights
      for (const [sx, sz] of C4) {
        k.cyl(k.solid(0x222222, 0.3, 0.9), 1.2, 1.6, 2.4, sx * 14, h + 1.2, sz * 10, 12, sz * 0.4, -sx * 0.4);
        k.cyl(k.neon(0xfff3c4, 2.8), 1.15, 1.15, 0.2, sx * 14 + sx * 0.4, h + 2.4, sz * 10 + sz * 0.45, 12, sz * 0.4, -sx * 0.4);
      }
      frogStatue(k, 0, h, 0, 1.3);
      k.bounds(19.5, 22, h);
    },
  },

  // ============================== GAMING
  GameStop: {
    plaza: ['#120204', '#e4002b'], glow: 0xe4002b,
    build(k) {
      const w = 36, h = 16, d = 30;
      k.box(k.solid(0x101014, 0.4, 0.5), w, h, d, 0, h / 2, 0);
      for (const y of [4, 9, 14]) k.box(k.pulse(0xe4002b, 2.6, 3, y), w + 0.4, 0.45, d + 0.4, 0, y, 0);
      k.signs(9, w, d, 30);
      // giant game controller on the roof
      const pad = k.mat(0x5a606e, 0.35, 0.35, 0.5);
      k.box(pad, 18, 4, 9, 0, h + 3, 0, 0, 0.15, 0);
      for (const s of [1, -1]) k.sph(pad, 4.4, s * 9, h + 3, 2.2, 1, 0.75, 1.5, 20);
      const btn = [[0xff3355, 1.5, 0], [0x39ff6a, 0, -1.5], [0x3d8bff, -1.5, 0], [0xffd23f, 0, 1.5]];
      btn.forEach(([c, dx, dz]) => k.sph(k.neon(c, 2.6), 0.75, 6 + dx, h + 5.2, dz - 0.8, 1, 0.6, 1, 10));
      k.box(k.neon(0xffffff, 1.6), 4, 0.8, 1.2, -6, h + 5.1, -0.8);
      k.box(k.neon(0xffffff, 1.6), 1.2, 0.8, 4, -6, h + 5.1, -0.8);
      for (const s of [1, -1]) k.cyl(k.solid(0x111111), 1.2, 1.2, 1.4, s * 2.5, h + 5.3, 2.2, 14);
      for (const f of [1, -1]) {
        arcadeCabinet(k, -12, f * 18.6, f, 0x3d1a8a);
        arcadeCabinet(k, -6, f * 18.6, f, 0x8a1a3d);
        arcadeCabinet(k, 12, f * 18.6, f, 0x1a6a8a);
      }
      k.bounds(19, 20.4, h + 8);
    },
  },

  Steam: {
    plaza: ['#0b1622', '#66c0f4'], glow: 0x66c0f4,
    build(k) {
      const navy = k.glass(0x101c2a, 0x66c0f4, false, 0.8), pipe = k.solid(0x5e6b78, 0.35, 0.9);
      k.tower(navy, 28, 42, 28, 0, 0, 0);
      for (const [sx, sz] of C4) k.cyl(pipe, 1.6, 1.6, 46, sx * 14.5, 23, sz * 14.5, 12);
      for (const s of [1, -1]) {
        k.cyl(pipe, 1.1, 1.1, 30, 0, 8, s * 15, 12, 0, Math.PI / 2);
        k.cyl(pipe, 1.1, 1.1, 30, s * 15, 36, 0, 12, Math.PI / 2);
      }
      // chimneys + frozen steam clouds
      const steam = cachedMat('steam', () => new THREE.MeshStandardMaterial({ color: 0xc8d8e8, emissive: 0x334455, transparent: true, opacity: 0.55, roughness: 1 }));
      for (const [x, z] of [[-7, -6], [6, 5]]) {
        k.cyl(pipe, 2, 2.4, 9, x, 46.5, z, 14);
        k.sph(steam, 3, x, 54, z, 1, 0.8, 1, 12);
        k.sph(steam, 4, x + 2, 59, z - 1, 1, 0.8, 1, 12);
      }
      // giant rotating gears on two faces
      const gearMat = new THREE.MeshStandardMaterial({ color: 0x2a475e, metalness: 0.8, roughness: 0.35, emissive: 0x0d2233 });
      const gearRim = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x66c0f4).multiplyScalar(2.2) });
      for (const s of [1, -1]) {
        const g = k.group(0, 26, s * 15.2);
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 1.4, 32), gearMat);
        disc.rotation.x = Math.PI / 2;
        g.add(disc);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(5, 0.4, 8, 32), gearRim);
        g.add(rim);
        const tooth = new THREE.BoxGeometry(2, 2.2, 1.4);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          const t = new THREE.Mesh(tooth, gearMat);
          t.position.set(Math.cos(a) * 8.8, Math.sin(a) * 8.8, 0);
          t.rotation.z = a;
          g.add(t);
        }
        k.anim((time, dt) => { g.rotation.z += dt * 0.4 * s; });
      }
      k.signs(14, 30, 30, 26, 4);
      k.bounds(16.5, 16.5, 46);
    },
  },

  Xbox: {
    plaza: ['#041a04', '#107c10'], glow: 0x2bd12b,
    build(k) {
      k.box(k.solid(0x0c140c, 0.5, 0.4), 36, 5, 36, 0, 2.5, 0);
      k.trim(k.neon(0x39ff6a, 2), 36, 5, 36, 0, 0.4);
      k.sph(k.mat(0x107c10, 0.4, 0.25, 0.4), 16, 0, 21, 0, 1, 1, 1, 40);
      // white X: two great-circle bands crossing the sphere
      const xw = k.neon(0xffffff, 1.5);
      for (const s of [1, -1]) k.torus(xw, 16.2, 1.3, 0, 21, 0, Math.PI / 2, s * Math.PI / 4, 0, TAU, 64);
      k.signs(2.5, 36, 36, 20);
      // glowing rings on the plaza
      for (const r of [20, 22.5]) k.torus(k.pulse(0x39ff6a, 2.2, 1.8, r), r, 0.2, 0, 0.1, 0, Math.PI / 2, 0, 0, TAU, 64);
      for (const [sx, sz] of C4) trophy(k, sx * 20.5, sz * 20.5, 1.1);
      k.bounds(22.5, 22.5, 37);
    },
  },

  'EA Games': {
    plaza: ['#1a0606', '#ff4747'], glow: 0xff4747,
    build(k) {
      // a sports stadium bowl with a pitch inside
      const bowl = cachedMat('ea-bowl', () => new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide, emissive: 0x150608 }));
      k.cyl(bowl, 22, 17, 14, 0, 7, 0, 40, 0, 0, true);
      k.torus(k.neon(0xff4747, 2.6), 22, 0.45, 0, 14, 0, Math.PI / 2, 0, 0, TAU, 64);
      k.torus(k.neon(0xffffff, 1.4), 19.5, 0.25, 0, 7, 0, Math.PI / 2, 0, 0, TAU, 64);
      k.box(k.mat(0x2f8f3a, 0.3, 0.9, 0), 26, 0.4, 17, 0, 0.6, 0);
      const line = k.neon(0xffffff, 1.4);
      k.box(line, 0.3, 0.05, 17, 0, 0.82, 0);
      k.torus(line, 3, 0.15, 0, 0.85, 0, Math.PI / 2);
      k.box(line, 26, 0.05, 0.3, 0, 0.82, 8.4);
      k.box(line, 26, 0.05, 0.3, 0, 0.82, -8.4);
      // floodlight towers
      for (const [sx, sz] of C4) {
        k.cyl(k.solid(0x3a3d46, 0.4, 0.8), 0.5, 0.7, 26, sx * 18, 13, sz * 18, 8);
        k.box(k.neon(0xfff8e0, 3), 5, 2.4, 0.8, sx * 18, 26.5, sz * 18, 0, Math.atan2(sx, sz), 0);
      }
      // big screen
      k.box(k.solid(0x111111), 1, 10, 1, 0, 19, -20);
      k.box(screenMat(), 18, 8, 1, 0, 26, -20);
      k.signRing(9, 21.4, 22);
      soccerBall(k, 0, 24, 0, 5);
      k.bounds(22.5, 22.5, 30);
    },
  },

  Nintendo: {
    plaza: ['#200206', '#ffffff'], glow: 0xe60012,
    build(k) {
      const w = 36, h = 26, d = 28;
      k.box(k.mat(0xe60012, 0.4, 0.4, 0.2), w, h, d, 0, h / 2, 0);
      k.trim(k.neon(0xffffff, 2.2), w, h, d, 0, 0.5);
      k.signs(15, w, d, 30);
      // a giant handheld console standing on the roof
      k.box(k.solid(0x1a1a1e, 0.2, 0.6), 20, 11, 1.6, 0, h + 6.5, 0);
      k.box(screenMat(), 17, 9, 1.7, 0, h + 6.5, 0);
      k.box(k.mat(0x00c3e3, 0.55, 0.3, 0.2), 4.5, 11, 1.8, -12.25, h + 6.5, 0);
      k.box(k.mat(0xff4554, 0.55, 0.3, 0.2), 4.5, 11, 1.8, 12.25, h + 6.5, 0);
      // floating "?" blocks and green warp pipes
      const q = cachedMat('qblock', () => new THREE.MeshStandardMaterial({
        map: makeSignTexture({ bg: '#f8b800', fg: '#ffffff', font: '900 200px Arial', frame: '#b87300' }, '?', 256, 256),
        emissive: 0x6a4a00, roughness: 0.5,
      }));
      for (const [x, z] of [[-19, 17], [19, -17], [0, 19]]) k.box(q, 3.6, 3.6, 3.6, x, 8, z);
      const pipe = k.mat(0x2fb84a, 0.35, 0.3, 0.3);
      for (const [x, z] of [[-18, -16], [18, 16]]) {
        k.cyl(pipe, 3, 3, 4.5, x, 2.25, z, 20);
        k.cyl(pipe, 3.7, 3.7, 1.6, x, 5.2, z, 20);
        k.cyl(k.solid(0x062a10), 3, 3, 0.1, x, 6.05, z, 20);
      }
      mushroom(k, -9, 17.5, 0xe60012);
      mushroom(k, -9, -17.5, 0x2fb84a);
      for (const f of [1, -1]) {
        k.ext(k.mat(0xffd23f, 0.6, 0.3, 0.4), starShape(3.4, 1.5), 1.6, 9, 6.5, f * 17.5);
        for (const sx of [1, -1]) k.box(k.solid(0x111111), 0.4, 1.2, 0.2, 9 + sx * 0.6, 7, f * 18.4);
        k.cyl(k.solid(0x333333), 0.15, 0.15, 3.5, 9, 1.75, f * 17.5, 6);
      }
      k.bounds(21.8, 20.9, h + 12);
    },
  },

  // ============================== FOOD
  "McDonald's": {
    plaza: ['#2a0604', '#ffc72c'], glow: 0xffc72c,
    build(k) {
      STYLES.store(k.B, k.b, DISTRICTS.food, k.signsGroup, k.sm, k.colliders);
      const h = k.b.size[2];
      const gold = k.mat(0xffc72c, 0.7, 0.3, 0.4);
      for (const s of [1, -1]) {                          // golden arches on the roof
        const arch = new THREE.TorusGeometry(5.5, 1, 10, 32, Math.PI);
        arch.scale(1, 2, 1);
        k.B.geometry(gold, xf(arch, k.b.x + s * 5.5, CURB + h + 1, k.b.z));
      }
      // giant fries carton on the plaza
      const fx = 12, fz = -7, fy = h + 1;
      k.cyl(k.mat(0xda291c, 0.4), 3, 2.3, 5, fx, fy + 2.5, fz, 4, 0, 0, false, Math.PI / 4);
      for (let i = 0; i < 9; i++) {
        k.box(k.mat(0xffd65c, 0.6), 0.6, 4, 0.6, fx + ((i % 3) - 1) * 1.3, fy + 6.2 + (i % 2) * 0.6, fz + (Math.floor(i / 3) - 1) * 1.3, (i - 4) * 0.04, 0, ((i % 3) - 1) * 0.1);
      }
      k.cyl(k.mat(0xda291c, 0.45), 2, 1.5, 6, -20, 3, -17, 18);
      k.cyl(k.mat(0xffffff, 0.4), 2.1, 2.1, 0.4, -20, 6.2, -17, 18);
      k.cyl(k.mat(0xffc72c, 0.5), 0.2, 0.2, 4, -19.4, 7.8, -17, 6, 0, -0.25);
      k.torus(k.neon(0xffc72c, 2), 1.85, 0.12, -20, 3.5, -17, Math.PI / 2);
      k.bounds(22.2, 19.3, h + 12);
    },
  },

  'Burger King': {
    plaza: ['#2a1206', '#ff8732'], glow: 0xff8732,
    build(k) {
      STYLES.store(k.B, k.b, DISTRICTS.food, k.signsGroup, k.sm, k.colliders);
      const y0 = k.b.size[2] + 1;
      const bun = k.mat(0xe8a24a, 0.4, 0.6, 0);
      k.cyl(bun, 8.5, 8, 2.4, 0, y0 + 1.2, 0, 32);                       // bottom bun
      k.cyl(k.mat(0x5a2e14, 0.2, 0.8, 0), 9, 9, 2.2, 0, y0 + 3.5, 0, 32); // flame-grilled patty
      k.box(k.mat(0xffc629, 0.5), 15, 0.5, 15, 0, y0 + 4.8, 0, 0, 0.35, 0);
      k.cyl(k.mat(0x4fbf3a, 0.4), 9.4, 9.4, 0.7, 0, y0 + 5.3, 0, 24);
      k.cyl(k.mat(0xd62300, 0.4), 8.2, 8.2, 0.8, 0, y0 + 6, 0, 24);
      k.hemi(bun, 8.6, 0, y0 + 6.4, 0, 0.7);                              // top bun
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4, r = 2 + (i % 4) * 1.5;
        k.sph(k.mat(0xfff4d6, 0.4), 0.45, Math.cos(a) * r, y0 + 6.4 + Math.sqrt(Math.max(0, 74 - r * r)) * 0.7 - 0.1, Math.sin(a) * r, 1, 0.5, 1.6, 6);
      }
      // a crown on top
      const gold = k.neon(0xffc629, 2.4);
      k.cyl(gold, 3, 3, 2, 0, y0 + 13.4, 0, 16, 0, 0, true);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        k.cone(gold, 0.7, 2.2, Math.cos(a) * 3, y0 + 15.5, Math.sin(a) * 3, 6);
      }
      for (const [sx, sz] of C4) {
        k.cone(k.pulse(0xff6a00, 2.8, 5, sx + 2 * sz), 1.4, 4.5, sx * 14, y0 + 1.5, sz * 9, 8);
        k.cone(k.pulse(0xffd23f, 2.8, 6, sx - sz), 0.8, 2.8, sx * 14, y0 + 1.2, sz * 9, 8);
      }
      k.bounds(19, 17, y0 + 16);
    },
  },

  "Wendy's": {
    plaza: ['#2a060a', '#e2203d'], glow: 0xe2203d,
    build(k) {
      STYLES.store(k.B, k.b, DISTRICTS.food, k.signsGroup, k.sm, k.colliders);
      const [w, d, h] = k.b.size;
      // retro red gable roof
      k.ext(k.mat(0xe2203d, 0.35, 0.5, 0.1), [[-d / 2 - 1, 0], [d / 2 + 1, 0], [0, 7]], w + 1, 0, h + 0.8, 0, 0, Math.PI / 2);
      // giant frosty cup on the plaza
      const cup = k.mat(0xffffff, 0.35, 0.4, 0.1);
      k.cyl(cup, 3, 2.2, 6, -20.5, 3, -18, 20);
      k.cyl(k.mat(0xe2203d, 0.4), 3.05, 2.75, 1.6, -20.5, 4, -18, 20);
      k.cone(k.mat(0xc98a4a, 0.35), 2.8, 4, -20.5, 8, -18, 20);
      // square burger on a pole
      k.cyl(k.solid(0x333333), 0.3, 0.3, 8, 20, 4, -18, 8);
      k.box(k.mat(0xe8a24a, 0.4), 5, 1.2, 5, 20, 8.6, -18);
      k.box(k.mat(0x5a2e14, 0.2), 5.4, 1, 5.4, 20, 9.6, -18);
      k.box(k.mat(0xe8a24a, 0.4), 5, 1.4, 5, 20, 10.8, -18);
      k.bounds(23.5, 21, h + 8);
    },
  },

  Starbucks: {
    plaza: ['#04241a', '#d4e9e2'], glow: 0x00a862,
    build(k) {
      // the building is a giant to-go cup
      const cup = k.mat(0xf4f1ea, 0.35, 0.5, 0.05), sleeve = k.mat(0x8a5a32, 0.25, 0.8, 0);
      const green = k.mat(0x00704a, 0.5, 0.35, 0.2);
      k.cyl(cup, 16, 12, 30, 0, 15, 0, 40);
      k.cyl(sleeve, 14.85, 13.55, 8, 0, 10, 0, 40);
      k.cyl(green, 16.6, 16.6, 2.4, 0, 31.2, 0, 40);                   // lid
      k.cyl(green, 13, 15.5, 2, 0, 33.4, 0, 40);
      k.torus(k.neon(0x00d084, 2.4), 16.6, 0.3, 0, 30, 0, Math.PI / 2, 0, 0, TAU, 64);
      const steam = cachedMat('sb-steam', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x556655, transparent: true, opacity: 0.45 }));
      k.sph(steam, 3, -2, 38, 0, 1, 0.8, 1, 12);
      k.sph(steam, 2.4, 1.5, 42, 1, 1, 0.8, 1, 12);
      k.signRing(20, 15.4, 20);
      // café umbrellas
      for (const [sx, sz] of C4) {
        k.cyl(k.solid(0x2a2a2a), 0.15, 0.15, 4, sx * 20, 2, sz * 20, 6);
        k.cone(green, 3, 1.4, sx * 20, 4.6, sz * 20, 12);
        k.cyl(k.mat(0x6b4a2a, 0.1), 1.4, 1.4, 0.2, sx * 20, 1.5, sz * 20, 12);
      }
      k.pylon();
      k.bounds(21, 21, 36);
    },
  },

  KFC: {
    plaza: ['#260204', '#ffffff'], glow: 0xff2a2a,
    build(k) {
      // the building is a giant striped bucket
      const stripes = cachedMat('kfc-stripes', () => {
        const t = canvasTex(512, 64, (g, w, h) => {
          for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#c8102e'; g.fillRect(i * 32, 0, 32, h); }
        });
        return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.5 });
      });
      k.cyl(stripes, 15, 12, 24, 0, 12, 0, 48);
      k.cyl(k.mat(0xffffff, 0.4), 15.6, 15.6, 1.4, 0, 24.3, 0, 48);
      k.torus(k.neon(0xff2a2a, 2.4), 15.7, 0.3, 0, 23.5, 0, Math.PI / 2, 0, 0, TAU, 64);
      // a pile of golden pieces
      const crispy = k.mat(0xc8842a, 0.35, 0.95, 0);
      [[0, 26.5, 0, 6], [-6, 25.5, 4, 4.5], [6, 25.5, -3, 4.5], [3, 26, 7, 4], [-5, 25.8, -6, 4.2], [8, 25.2, 5, 3.5]].forEach(([x, y, z, r], i) => {
        k.sph(crispy, r, x, y, z, 1.3, 0.75, 0.9, 14);
        if (i % 2) k.cyl(k.mat(0xf2e3c8, 0.3), 0.6, 0.6, 3, x + r, y + 0.5, z, 8, 0, Math.PI / 2 - 0.3);
      });
      k.signRing(12, 13.9, 20);
      // striped awnings on the plaza
      for (const [sx, sz] of C4) {
        k.cyl(k.solid(0x2a2a2a), 0.15, 0.15, 4, sx * 20, 2, sz * 20, 6);
        k.cone(stripes, 3, 1.4, sx * 20, 4.6, sz * 20, 16);
      }
      k.pylon();
      const crispy2 = k.mat(0xc8842a, 0.35, 0.95, 0), bone = k.mat(0xf2e3c8, 0.3);
      for (const f of [1, -1]) {
        k.sph(crispy2, 3, -1.5, 2.6, f * 18.5, 1.7, 0.9, 0.95, 16);
        k.cyl(bone, 0.6, 0.6, 4, 4.5, 2.6, f * 18.5, 8, 0, Math.PI / 2);
        k.sph(bone, 0.9, 6.6, 3.1, f * 18.5, 1, 1, 1, 8);
        k.sph(bone, 0.9, 6.6, 2.1, f * 18.5, 1, 1, 1, 8);
      }
      k.bounds(21, 21, 33);
    },
  },

  // ============================== INSURANCE
  Manulife: {
    plaza: ['#032214', '#00a758'], glow: 0x00a758,
    build(k) {
      STYLES.office(k.B, k.b, { ...DISTRICTS.insurance, color: 0x00a758, fin: 0x00a758 }, k.signsGroup, k.sm);
      const h = k.b.size[2];
      const g = k.mat(0x00a758, 0.55, 0.3, 0.4);
      // stepped green crown
      [[22, 4, -6], [16, 8, 0], [10, 12, 6]].forEach(([w, hh, x]) => k.box(g, w * 0.5, hh, 26, x, h + hh / 2, 0));
      // umbrella sculpture (protection) + hedges
      k.cyl(k.solid(0xd0d4da, 0.3, 0.9), 0.35, 0.35, 9, -20, 4.5, 19, 8);
      k.cone(g, 6, 2.6, -20, 9.6, 19, 16);
      k.torus(k.mat(0xd0d4da, 0.3), 0.9, 0.3, -19.1, 0.6, 19, 0, 0, 0, Math.PI);
      for (const s of [1, -1]) k.box(k.mat(0x1f6b2e, 0.2, 0.9, 0), 1.8, 1.6, 30, s * 21.5, 0.8, -3);
      k.bounds(22.5, 22, h + 12);
    },
  },

  'Sun Life': {
    plaza: ['#0a1a22', '#ffcb05'], glow: 0xffcb05,
    build(k) {
      STYLES.office(k.B, k.b, { ...DISTRICTS.insurance, color: 0xffb300, accent: 0xffcb05, fin: 0xffcb05 }, k.signsGroup, k.sm);
      const h = k.b.size[2];
      // a radiant sun crowning the tower
      const sun = k.neon(0xffcb05, 2.4);
      k.sph(sun, 6, 0, h + 10, 0, 1, 1, 1, 24);
      const N = 18;
      for (let i = 0; i < N; i++) {                      // rays spread over a sphere
        const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
        const dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
        const g = new THREE.ConeGeometry(1.2, 5, 6);
        g.translate(0, 8.5, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
        g.translate(k.b.x, CURB + h + 10, k.b.z);
        k.B.geometry(k.neon(0xffa400, 2.2), g);
      }
      // sundial on the plaza
      k.cyl(k.mat(0xd8d2c0, 0.2), 5, 5.4, 1, 18, 0.5, -18, 32);
      k.ext(k.mat(0xffcb05, 0.6), [[0, 0], [4.5, 0], [0, 4]], 0.4, 18, 1, -18, 0, 0.7, 0);
      k.bounds(23.5, 23.5, h + 16);
    },
  },

  'Intact Insurance': {
    plaza: ['#220208', '#ffffff'], glow: 0xcc0033,
    build(k) {
      STYLES.office(k.B, k.b, { ...DISTRICTS.insurance, color: 0xff2050, accent: 0xffffff, fin: 0xf0f0f0 }, k.signsGroup, k.sm);
      const h = k.b.size[2];
      // shield crown, front and back
      const shield = [[-8, 12], [8, 12], [8, 3], [0, -6], [-8, 3]];
      const inner = shield.map(([x, y]) => [x * 0.7, y * 0.7 + 1.5]);
      k.ext(k.mat(0xcc0033, 0.6, 0.35, 0.3), shield, 2.4, 0, h + 7, 0);
      for (const s of [1, -1]) k.ext(k.neon(0xffffff, 2), inner, 0.4, 0, h + 7, s * 1.4);
      k.box(k.solid(0x333333), 1.5, 2, 1.5, 0, h, 0);
      // red & white bollards
      for (let i = 0; i < 8; i++) {
        const x = -21 + i * 6;
        k.cyl(i % 2 ? k.mat(0xffffff, 0.4) : k.mat(0xcc0033, 0.5), 0.6, 0.6, 1.4, x, 0.7, 21.5, 10);
      }
      k.bounds(19.5, 22.5, h + 20);
    },
  },
};

// ------------------------------------------------------------------ entry
export function buildThemedBrand(B, b, signs, colliders, root, animated) {
  const theme = THEMES[b.name];
  const k = makeKit(B, b, signs, colliders, root, animated);
  k.B = B; k.signsGroup = signs; k.colliders = colliders;
  if (!theme) {
    STYLES[b.style](B, b, DISTRICTS[b.district], signs, k.sm, colliders);
    k.bounds(b.size[0] / 2, b.size[1] / 2, b.size[2]);
  } else {
    plazaDecal(root, b, theme);
    theme.build(k);
  }
  const bb = b.bounds;
  colliders.addBox(bb.minX, bb.maxX, bb.minZ, bb.maxZ, { brand: b, kind: 'building', height: k._height });
  const glow = theme ? theme.glow : DISTRICTS[b.district].color;
  b.themeColor = glow;
  return { x: b.x, z: b.z, color: glow, radius: Math.max(bb.maxX - bb.minX, bb.maxZ - bb.minZ) * 0.5 };
}
