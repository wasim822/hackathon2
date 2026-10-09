// Static collision world (XZ plane) with a uniform-grid broadphase.
// Colliders are axis-aligned boxes or circles. Boxes are effectively infinitely
// tall (so nothing can fly over walls/buildings) unless they are ramp colliders,
// which only block a car that is lower than the ramp surface it touches.

import { rampHeightAt } from './terrain.js';

const CELL = 40;

export class ColliderWorld {
  constructor() {
    this.items = [];
    this.grid = new Map();
    this.stamp = 0;
  }

  _insert(c) {
    c.id = this.items.length;
    c._stamp = -1;
    this.items.push(c);
    const x0 = Math.floor(c.minX / CELL), x1 = Math.floor(c.maxX / CELL);
    const z0 = Math.floor(c.minZ / CELL), z1 = Math.floor(c.maxZ / CELL);
    for (let i = x0; i <= x1; i++) {
      for (let j = z0; j <= z1; j++) {
        const k = i * 100000 + j;
        let cellList = this.grid.get(k);
        if (!cellList) { cellList = []; this.grid.set(k, cellList); }
        cellList.push(c);
      }
    }
    return c;
  }

  // opts: { brand, kind, height (visual, used by camera), ramp }
  addBox(minX, maxX, minZ, maxZ, opts = {}) {
    return this._insert({
      type: 'box', minX, maxX, minZ, maxZ,
      cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2,
      hx: (maxX - minX) / 2, hz: (maxZ - minZ) / 2,
      brand: opts.brand || null, kind: opts.kind || 'solid',
      height: opts.height ?? 10, ramp: opts.ramp || null, camera: opts.camera !== false,
    });
  }

  addCircle(x, z, r, opts = {}) {
    return this._insert({
      type: 'circle', cx: x, cz: z, r,
      minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r,
      brand: opts.brand || null, kind: opts.kind || 'solid',
      height: opts.height ?? 10, camera: opts.camera !== false,
    });
  }

  query(minX, maxX, minZ, maxZ, out) {
    out.length = 0;
    const s = ++this.stamp;
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let i = x0; i <= x1; i++) {
      for (let j = z0; j <= z1; j++) {
        const cellList = this.grid.get(i * 100000 + j);
        if (!cellList) continue;
        for (const c of cellList) {
          if (c._stamp === s) continue;
          c._stamp = s;
          if (c.maxX < minX || c.minX > maxX || c.maxZ < minZ || c.minZ > maxZ) continue;
          out.push(c);
        }
      }
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Narrow phase: oriented box (car) vs collider. Returns penetration info in
// `res` = { nx, nz, depth, px, pz } (normal points from collider toward car,
// p = approximate contact point) or false.

const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

export function obbVsCollider(cx, cz, fx, fz, hl, hw, col, carY, res) {
  // car local axes: forward f=(fx,fz), left l=(fz,-fx)
  const lx = fz, lz = -fx;

  if (col.ramp) {
    // Ramp only blocks if the car is well below the ramp surface at the
    // nearest point of the ramp rectangle.
    const qx = Math.min(Math.max(cx, col.minX), col.maxX);
    const qz = Math.min(Math.max(cz, col.minZ), col.maxZ);
    const top = rampHeightAt(col.ramp, qx, qz);
    if (carY + 0.6 >= top) return false;
  }

  if (col.type === 'circle') {
    // closest point on OBB to circle center
    const dx = col.cx - cx, dz = col.cz - cz;
    const lf = dx * fx + dz * fz;
    const ll = dx * lx + dz * lz;
    const cf = Math.max(-hl, Math.min(hl, lf));
    const cl = Math.max(-hw, Math.min(hw, ll));
    const px = cx + fx * cf + lx * cl, pz = cz + fz * cf + lz * cl;
    let nx = px - col.cx, nz = pz - col.cz;
    const d = Math.hypot(nx, nz);
    if (d >= col.r) return false;
    if (d < 1e-5) { nx = cx - col.cx; nz = cz - col.cz; const dd = Math.hypot(nx, nz) || 1; nx /= dd; nz /= dd; }
    else { nx /= d; nz /= d; }
    res.nx = nx; res.nz = nz; res.depth = col.r - d; res.px = px; res.pz = pz;
    return true;
  }

  // SAT on 4 axes: world X, world Z, car f, car l
  const bx = col.cx, bz = col.cz, bhx = col.hx, bhz = col.hz;
  const dx = cx - bx, dz = cz - bz;
  let best = 1e9, bnx = 0, bnz = 0, axisType = 0;
  const axes = [[1, 0, 0], [0, 1, 0], [fx, fz, 1], [lx, lz, 1]];
  for (let k = 0; k < 4; k++) {
    const ax = axes[k][0], az = axes[k][1];
    const rc = hl * Math.abs(fx * ax + fz * az) + hw * Math.abs(lx * ax + lz * az);
    const rb = bhx * Math.abs(ax) + bhz * Math.abs(az);
    const d = dx * ax + dz * az;
    const o = rc + rb - Math.abs(d);
    if (o <= 0) return false;
    if (o < best - 1e-4) {
      best = o; const s = d >= 0 ? 1 : -1;
      bnx = ax * s; bnz = az * s; axisType = axes[k][2];
    }
  }
  // contact point
  let sx = 0, sz = 0, n = 0;
  if (axisType === 0) {
    // world axis -> car corners deepest along -normal
    let minD = 1e9;
    const proj = [];
    for (const [a, b] of corners) {
      const px = cx + fx * hl * a + lx * hw * b, pz = cz + fz * hl * a + lz * hw * b;
      const d = px * bnx + pz * bnz;
      proj.push([px, pz, d]);
      if (d < minD) minD = d;
    }
    for (const p of proj) if (p[2] < minD + 0.15) { sx += p[0]; sz += p[1]; n++; }
  } else {
    // car axis -> box corners deepest along +normal (into the car)
    let maxD = -1e9;
    const proj = [];
    for (const [a, b] of corners) {
      const px = bx + bhx * a, pz = bz + bhz * b;
      const d = px * bnx + pz * bnz;
      proj.push([px, pz, d]);
      if (d > maxD) maxD = d;
    }
    for (const p of proj) if (p[2] > maxD - 0.15) { sx += p[0]; sz += p[1]; n++; }
  }
  res.nx = bnx; res.nz = bnz; res.depth = best; res.px = sx / n; res.pz = sz / n;
  return true;
}

// Segment (3D) vs collider boxes for the camera. Returns hit fraction t in [0,1].
export function raycastColliders(world, ax, ay, az, bx, by, bz, tmp) {
  const minX = Math.min(ax, bx) - 1, maxX = Math.max(ax, bx) + 1;
  const minZ = Math.min(az, bz) - 1, maxZ = Math.max(az, bz) + 1;
  world.query(minX, maxX, minZ, maxZ, tmp);
  let tBest = 1;
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  for (const c of tmp) {
    if (!c.camera) continue;
    let bminX = c.minX, bmaxX = c.maxX, bminZ = c.minZ, bmaxZ = c.maxZ;
    if (c.type === 'circle') { bminX = c.cx - c.r * 0.8; bmaxX = c.cx + c.r * 0.8; bminZ = c.cz - c.r * 0.8; bmaxZ = c.cz + c.r * 0.8; }
    let t0 = 0, t1 = 1;
    const slab = (o, d, mn, mx) => {
      if (Math.abs(d) < 1e-8) return o >= mn && o <= mx;
      let ta = (mn - o) / d, tb = (mx - o) / d;
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      return t0 <= t1;
    };
    if (!slab(ax, dx, bminX, bmaxX)) continue;
    if (!slab(az, dz, bminZ, bmaxZ)) continue;
    if (!slab(ay, dy, -1, c.height)) continue;
    if (t0 < tBest) tBest = t0;
  }
  return tBest;
}
