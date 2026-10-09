// Analytic height field: flat asphalt, raised sidewalks (curbs) and ramps.
// heightAt() is allocation-free and O(ramps) so it can run many times per step.

import { MAP, RAMPS, isPlazaBlock } from '../config/map.js';

const H = MAP.roadWidth / 2;
const plazaCache = [];
for (let i = 0; i < MAP.blocks; i++) {
  plazaCache[i] = [];
  for (let j = 0; j < MAP.blocks; j++) plazaCache[i][j] = isPlazaBlock(i, j);
}

// Precompute ramp rectangles + evaluation data
export const rampData = RAMPS.map((r) => {
  const lane = r.lane || 0;
  const s0 = r.from;
  const s1 = r.from + r.dir * r.len;
  const c0 = r.at + lane - r.width / 2;
  const c1 = r.at + lane + r.width / 2;
  const sMin = Math.min(s0, s1), sMax = Math.max(s0, s1);
  const rect = r.axis === 'x'
    ? { minX: sMin, maxX: sMax, minZ: c0, maxZ: c1 }
    : { minX: c0, maxX: c1, minZ: sMin, maxZ: sMax };
  const down = r.kind === 'hump' ? r.len - r.up - r.flat : 0;
  return { ...r, rect, down };
});

// Evaluate one ramp at (x,z). Returns height or -1 if outside. Writes slope
// along the ramp axis into rampSlope.
let rampSlope = 0;
function evalRamp(rd, x, z) {
  const s = rd.axis === 'x' ? x : z;
  const c = rd.axis === 'x' ? z : x;
  const lane = rd.lane || 0;
  if (Math.abs(c - (rd.at + lane)) > rd.width / 2) return -1;
  const u = (s - rd.from) * rd.dir;
  if (u < 0 || u > rd.len) return -1;
  if (rd.kind === 'jump') {
    rampSlope = (rd.height / rd.len) * rd.dir;
    return (rd.height * u) / rd.len;
  }
  if (u < rd.up) {
    rampSlope = (rd.height / rd.up) * rd.dir;
    return (rd.height * u) / rd.up;
  }
  if (u < rd.up + rd.flat) {
    rampSlope = 0;
    return rd.height;
  }
  rampSlope = -(rd.height / rd.down) * rd.dir;
  return (rd.height * (rd.len - u)) / rd.down;
}

export function rampHeightAt(rd, x, z) {
  const h = evalRamp(rd, x, z);
  return h < 0 ? 0 : h;
}

export function isSidewalk(x, z) {
  const fx = x + MAP.half, fz = z + MAP.half;
  const i = Math.floor(fx / MAP.pitch), j = Math.floor(fz / MAP.pitch);
  if (i < 0 || j < 0 || i >= MAP.blocks || j >= MAP.blocks) return false;
  const lx = fx - i * MAP.pitch, lz = fz - j * MAP.pitch;
  if (lx < H || lx > MAP.pitch - H || lz < H || lz > MAP.pitch - H) return false;
  return !plazaCache[i][j];
}

// out = { h, gx, gz } (gradient of height)
export function heightAt(x, z, out) {
  let h = isSidewalk(x, z) ? MAP.curbHeight : 0;
  let gx = 0, gz = 0;
  for (let k = 0; k < rampData.length; k++) {
    const rd = rampData[k];
    const r = rd.rect;
    if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) continue;
    const rh = evalRamp(rd, x, z);
    if (rh > h) {
      h = rh;
      if (rd.axis === 'x') { gx = rampSlope; gz = 0; } else { gz = rampSlope; gx = 0; }
    }
  }
  out.h = h; out.gx = gx; out.gz = gz;
  return out;
}
