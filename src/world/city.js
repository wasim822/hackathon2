// Builds the whole city: ground, roads + markings, sidewalks, brand buildings,
// filler blocks, street lamps, perimeter wall, ramps, tunnels and banners.
import * as THREE from 'three';
import { MAP, TUNNELS, blockCenter, isPlazaBlock } from '../config/map.js';
import { DISTRICTS, GOOGLE, layoutBrands } from '../config/brands.js';
import { ColliderWorld } from './colliders.js';
import { rampData } from './terrain.js';
import { Batcher } from './batcher.js';
import { buildGoogle } from './buildings.js';
import { buildThemedBrand } from './brandThemes.js';
import { buildAmbient } from './ambient.js';
import { initMaterials, neon, glass, solid, pulseNeon } from './materials.js';
import {
  makeAsphaltTexture, makeAsphaltRoughness, makeBrickTexture, makeGlowTexture, makeBannerTexture,
} from './textures.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function buildCity(scene) {
  initMaterials();
  const colliders = new ColliderWorld();
  const B = new Batcher();
  const root = new THREE.Group();
  root.name = 'city';
  scene.add(root);
  const signs = new THREE.Group();
  root.add(signs);
  const pools = []; // ground light pools {x,z,color,radius}
  const rnd = rng(1337);

  // ---------------------------------------------------------- ground
  const groundSize = 1700;
  const asphalt = makeAsphaltTexture();
  asphalt.repeat.set(groundSize / 14, groundSize / 14);
  const rough = makeAsphaltRoughness();
  rough.repeat.copy(asphalt.repeat);
  const groundMat = new THREE.MeshStandardMaterial({
    map: asphalt, roughnessMap: rough, roughness: 0.6, metalness: 0.5, envMapIntensity: 0.55, color: 0x9a98b0,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.matrixAutoUpdate = false;
  ground.updateMatrix();
  root.add(ground);

  // ---------------------------------------------------------- brands
  const { brands, blocks } = layoutBrands();
  const animated = [];
  const brandByBlock = new Map();
  for (const b of brands) {
    pools.push(buildThemedBrand(B, b, signs, colliders, root, animated));
    brandByBlock.set(b.block.join(','), b);
  }
  const globe = buildGoogle(B, GOOGLE, signs, colliders, root);
  pools.push({ x: 0, z: 0, color: 0x4f8bff, radius: 48 });

  // ---------------------------------------------------------- sidewalks + curb neon
  const sidewalkMat = solid(0x2a2838, 0.8, 0.1);
  const bs = MAP.blockSize;
  for (let i = 0; i < MAP.blocks; i++) {
    for (let j = 0; j < MAP.blocks; j++) {
      if (isPlazaBlock(i, j)) continue;
      const c = blockCenter(i, j);
      B.box(sidewalkMat, bs, MAP.curbHeight, bs, c.x, 0, c.z);
      const blk = blocks.find((q) => q.i === i && q.j === j);
      const owner = brandByBlock.get(`${i},${j}`);
      const col = owner ? owner.themeColor : DISTRICTS[blk.district].color;
      const nm = neon(col, 1.35);
      const t = 0.35, y = MAP.curbHeight - 0.02;
      B.box(nm, bs, 0.08, t, c.x, y, c.z + bs / 2 - t / 2);
      B.box(nm, bs, 0.08, t, c.x, y, c.z - bs / 2 + t / 2);
      B.box(nm, t, 0.08, bs, c.x + bs / 2 - t / 2, y, c.z);
      B.box(nm, t, 0.08, bs, c.x - bs / 2 + t / 2, y, c.z);
    }
  }

  // ---------------------------------------------------------- filler buildings
  const heightRange = {
    tech: [24, 60], social: [18, 46], disney: [10, 26], gaming: [14, 34], food: [8, 16], insurance: [30, 70],
  };
  for (const blk of blocks) {
    if (blk.used) continue;
    const D = DISTRICTS[blk.district];
    const r = rnd();
    if (r < 0.2) {
      // open plaza: a few glowing bollards, nothing to block the view
      for (const [sx, sz] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        B.box(neon(D.accent, 2), 0.6, 1.4, 0.6, blk.x + sx * 10, MAP.curbHeight, blk.z + sz * 10);
      }
      pools.push({ x: blk.x, z: blk.z, color: D.accent, radius: 16 });
      continue;
    }
    const [hMin, hMax] = heightRange[blk.district];
    const layout = r < 0.55 ? 1 : r < 0.8 ? 2 : 4;
    const cells = layout === 1 ? [[0, 0, 40]] : layout === 2
      ? (rnd() < 0.5 ? [[-12, 0, 20, 44], [12, 0, 20, 44]] : [[0, -12, 44, 20], [0, 12, 44, 20]])
      : [[-12, -12, 20], [12, -12, 20], [-12, 12, 20], [12, 12, 20]];
    const warm = blk.district === 'food' || blk.district === 'disney';
    const mat = glass(0x0c0f1c, D.color, warm, 0.9);
    for (const cell of cells) {
      const w = (cell[2] - rnd() * 4), d = ((cell[3] ?? cell[2]) - rnd() * 4);
      const h = hMin + rnd() * (hMax - hMin);
      const x = blk.x + cell[0], z = blk.z + cell[1];
      B.box(mat, w, h, d, x, MAP.curbHeight, z, 0, true);
      B.box(neon(rnd() < 0.5 ? D.color : D.accent, 1.8), w + 0.3, 0.45, d + 0.3, x, MAP.curbHeight + h - 0.45, z);
      colliders.addBox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, { kind: 'filler', height: h });
    }
  }

  // ---------------------------------------------------------- road markings
  const dashGeo = new THREE.PlaneGeometry(0.35, 4);
  dashGeo.rotateX(-Math.PI / 2);
  const dashMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.85, 0.55) });
  const dashes = [];
  const isInter = (v) => {
    const k = Math.round((v + MAP.half) / MAP.pitch);
    return Math.abs(v - (-MAP.half + k * MAP.pitch)) < MAP.roadWidth / 2 + 2;
  };
  const inPlaza = (x, z) => Math.abs(x) < MAP.plazaHalf - 8 && Math.abs(z) < MAP.plazaHalf - 8;
  for (let k = 0; k <= MAP.blocks; k++) {
    const line = -MAP.half + k * MAP.pitch;
    for (let s = -MAP.half - 20; s <= MAP.half + 20; s += 9) {
      if (isInter(s)) continue;
      if (!inPlaza(line, s)) dashes.push([line, s, 0]);
      if (!inPlaza(s, line)) dashes.push([s, line, Math.PI / 2]);
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  dashes.forEach(([x, z, rot], i) => {
    q.setFromEuler(e.set(0, rot, 0));
    m4.compose(new THREE.Vector3(x, 0.03, z), q, one);
    dashMesh.setMatrixAt(i, m4);
  });
  root.add(dashMesh);

  // crosswalk stripes at every intersection
  const stripeGeo = new THREE.PlaneGeometry(1.1, 5);
  stripeGeo.rotateX(-Math.PI / 2);
  const stripeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.55, 0.65) });
  const stripes = [];
  for (let a = 0; a <= MAP.blocks; a++) {
    for (let b = 0; b <= MAP.blocks; b++) {
      const ix = -MAP.half + a * MAP.pitch, iz = -MAP.half + b * MAP.pitch;
      if (Math.abs(ix) < MAP.plazaHalf && Math.abs(iz) < MAP.plazaHalf) continue;
      const off = MAP.roadWidth / 2 + 3.5;
      for (let s = -4; s <= 4; s++) {
        const o = s * 2.2;
        if (b > 0) stripes.push([ix + o, iz - off, 0]);
        if (b < MAP.blocks) stripes.push([ix + o, iz + off, 0]);
        if (a > 0) stripes.push([ix - off, iz + o, Math.PI / 2]);
        if (a < MAP.blocks) stripes.push([ix + off, iz + o, Math.PI / 2]);
      }
    }
  }
  const stripeMesh = new THREE.InstancedMesh(stripeGeo, stripeMat, stripes.length);
  stripes.forEach(([x, z, rot], i) => {
    q.setFromEuler(e.set(0, rot, 0));
    m4.compose(new THREE.Vector3(x, 0.025, z), q, one);
    stripeMesh.setMatrixAt(i, m4);
  });
  root.add(stripeMesh);

  // roundabout lane ring
  const ringDash = [];
  for (let k = 0; k < 64; k++) ringDash.push((k / 64) * Math.PI * 2);
  const ringMesh = new THREE.InstancedMesh(dashGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.4, 2) }), ringDash.length);
  ringDash.forEach((a, i) => {
    q.setFromEuler(e.set(0, -a, 0));
    m4.compose(new THREE.Vector3(Math.cos(a) * 46, 0.03, Math.sin(a) * 46), q, one);
    ringMesh.setMatrixAt(i, m4);
  });
  root.add(ringMesh);
  // outer roundabout neon circle
  const outerRing = new THREE.Mesh(new THREE.RingGeometry(66, 67, 96), neon(0xb44dff, 1.8));
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.04;
  root.add(outerRing);

  // ---------------------------------------------------------- street lamps
  const lamps = [];
  for (let i = 0; i < MAP.blocks; i++) {
    for (let j = 0; j < MAP.blocks; j++) {
      if (isPlazaBlock(i, j)) continue;
      const c = blockCenter(i, j);
      const o = MAP.blockSize / 2 - 1.6;
      for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) lamps.push([c.x + sx * o, c.z + sz * o]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.15, 0.22, 9, 6);
  poleGeo.translate(0, 4.5, 0);
  const poles = new THREE.InstancedMesh(poleGeo, solid(0x30303c, 0.5, 0.8), lamps.length);
  const headGeo = new THREE.BoxGeometry(1.4, 0.3, 0.6);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.0, 2.6) }), lamps.length);
  lamps.forEach(([x, z], i) => {
    m4.makeTranslation(x, MAP.curbHeight, z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(x, MAP.curbHeight + 9, z);
    heads.setMatrixAt(i, m4);
    pools.push({ x, z, color: 0xb9a4ff, radius: 9, dim: true });
  });
  root.add(poles, heads);

  // ---------------------------------------------------------- perimeter brick wall
  const brick = makeBrickTexture();
  const W = MAP.wallInner, T = MAP.wallThickness, WH = MAP.wallHeight;
  const len = (W + T) * 2;
  brick.repeat.set(len / 4, WH / 2);
  const brickMat = new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9, metalness: 0, color: 0xc8b0b0 });
  const wallTop = neon(0xff2fb4, 2.4);
  const walls = [
    [0, W + T / 2, len, T], [0, -W - T / 2, len, T],
    [W + T / 2, 0, T, len], [-W - T / 2, 0, T, len],
  ];
  for (const [x, z, w, d] of walls) {
    B.box(brickMat, w, WH, d, x, 0, z);
    B.box(wallTop, w + 0.2, 0.4, d + 0.2, x, WH, z);
    // physics: infinitely tall (invisible extension above the wall) — camera only sees WH
    colliders.addBox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, { kind: 'wall', height: WH });
  }
  // pillars every 40m along the inside of the wall
  for (let s = -W; s <= W; s += 40) {
    for (const [x, z] of [[s, W + 1], [s, -W - 1], [W + 1, s], [-W - 1, s]]) {
      B.box(brickMat, 2.4, WH + 1.2, 2.4, x, 0, z);
      B.box(neon(0x7fe7ff, 2.2), 2.5, 0.3, 2.5, x, WH + 1.2, z);
    }
  }

  // ---------------------------------------------------------- skyline outside the wall
  const skyMat = glass(0x05060c, 0x3a3f8a, false, 0.6);
  for (let k = 0; k < 140; k++) {
    const a = rnd() * Math.PI * 2;
    const d = 600 + rnd() * 240;
    const w = 20 + rnd() * 40, h = 40 + rnd() * 160;
    B.box(skyMat, w, h, w, Math.cos(a) * d, 0, Math.sin(a) * d, 0, true);
  }

  // ---------------------------------------------------------- ramps / skyways
  const rampMat = solid(0x34324a, 0.6, 0.3);
  for (const rd of rampData) {
    const prof = rd.kind === 'jump'
      ? [[0, 0], [rd.len, rd.height], [rd.len, 0]]
      : [[0, 0], [rd.up, rd.height], [rd.up + rd.flat, rd.height], [rd.len, 0]];
    const shape = new THREE.Shape(prof.map(([u, h]) => new THREE.Vector2(u, h)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: rd.width, bevelEnabled: false });
    // local: x=u along ramp, y=height, z=across [0,width] -> world
    const pos = g.attributes.position;
    const lane = rd.lane || 0;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i), h = pos.getY(i), c = pos.getZ(i) - rd.width / 2 + rd.at + lane;
      const s = rd.from + rd.dir * u;
      if (rd.axis === 'x') pos.setXYZ(i, s, h + 0.01, c);
      else pos.setXYZ(i, c, h + 0.01, s);
    }
    g.computeVertexNormals();
    // the transform can flip winding; render double-sided by duplicating material
    B.geometry(rampMat, g);
    // neon edge rails
    const rail = pulseNeon(0xffd23f, 2.6, 4, rd.from);
    const steps = 24;
    for (let k = 0; k < steps; k++) {
      const u = (rd.len * (k + 0.5)) / steps;
      const s = rd.from + rd.dir * u;
      const hh = rd.kind === 'jump' ? (rd.height * u) / rd.len
        : u < rd.up ? (rd.height * u) / rd.up : u < rd.up + rd.flat ? rd.height : (rd.height * (rd.len - u)) / rd.down;
      for (const side of [-1, 1]) {
        const c = rd.at + lane + side * (rd.width / 2 - 0.2);
        if (rd.axis === 'x') B.box(rail, rd.len / steps * 0.6, 0.2, 0.4, s, hh, c);
        else B.box(rail, 0.4, 0.2, rd.len / steps * 0.6, c, hh, s);
      }
    }
    const r = rd.rect;
    colliders.addBox(r.minX, r.maxX, r.minZ, r.maxZ, { kind: 'ramp', ramp: rd, height: rd.height, camera: false });
  }
  rampMat.side = THREE.DoubleSide;

  // ---------------------------------------------------------- tunnels
  for (const t of TUNNELS) {
    const roofMat = solid(0x1a1826, 0.7, 0.4);
    const ringMat = pulseNeon(0x2fd1ff, 2.8, 2.0, t.from);
    const span = MAP.roadWidth + 6;
    const L = t.to - t.from, mid = (t.from + t.to) / 2;
    const outer = t.at + Math.sign(t.at) * (MAP.roadWidth / 2 + 2.5);
    if (t.axis === 'x') {
      B.box(roofMat, L, 1, span, mid, 8, t.at + Math.sign(t.at) * 2);
      B.box(roofMat, L, 9, 2, mid, 0, outer);
      colliders.addBox(t.from, t.to, outer - 1, outer + 1, { kind: 'tunnel', height: 9 });
      for (let s = t.from + 3; s < t.to; s += 7) B.box(ringMat, 0.5, 0.3, span, s, 7.7, t.at + Math.sign(t.at) * 2);
    } else {
      B.box(roofMat, span, 1, L, t.at + Math.sign(t.at) * 2, 8, mid);
      B.box(roofMat, 2, 9, L, outer, 0, mid);
      colliders.addBox(outer - 1, outer + 1, t.from, t.to, { kind: 'tunnel', height: 9 });
      for (let s = t.from + 3; s < t.to; s += 7) B.box(ringMat, span, 0.3, 0.5, t.at + Math.sign(t.at) * 2, 7.7, s);
    }
  }

  // ---------------------------------------------------------- district banners
  for (const [id, D] of Object.entries(DISTRICTS)) {
    const a = (D.angle * Math.PI) / 180;
    const r = 250;
    const x = Math.sin(a) * r, z = -Math.cos(a) * r;
    const tex = makeBannerTexture(D.short, '#' + new THREE.Color(D.color).getHexString());
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, color: new THREE.Color(1.4, 1.4, 1.4), depthWrite: false });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(64, 10), mat);
    banner.position.set(x, 58, z);
    banner.lookAt(0, 58, 0);
    root.add(banner);
  }

  buildAmbient(root, B, signs, colliders, animated);
  B.build(root);

  // ---------------------------------------------------------- ground light pools (fake wet reflections)
  const glowTex = makeGlowTexture();
  const poolGeo = new THREE.PlaneGeometry(1, 1);
  poolGeo.rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.38,
  });
  const poolMesh = new THREE.InstancedMesh(poolGeo, poolMat, pools.length);
  const col = new THREE.Color();
  pools.forEach((p, i) => {
    const s = p.radius * 2.4;
    m4.compose(new THREE.Vector3(p.x, 0.06 + (p.dim ? 0.2 : 0), p.z), q.identity(), new THREE.Vector3(s, 1, s));
    poolMesh.setMatrixAt(i, m4);
    poolMesh.setColorAt(i, col.set(p.color).multiplyScalar(p.dim ? 0.22 : 0.55));
  });
  poolMesh.renderOrder = 2;
  root.add(poolMesh);

  return { root, colliders, brands, globe, animated, lampCount: lamps.length };
}
