// Finds a safe, upright spot on the nearest road for the R (reset) action.
import { MAP } from '../config/map.js';
import { heightAt } from '../world/terrain.js';
import { obbVsCollider } from '../world/colliders.js';

const tmpH = { h: 0, gx: 0, gz: 0 };
const tmpRes = {};
const list = [];
const snapLine = (v) => {
  const k = Math.round((v + MAP.half) / MAP.pitch);
  return -MAP.half + Math.max(0, Math.min(MAP.blocks, k)) * MAP.pitch;
};

function free(colliders, x, z, heading, p) {
  if (Math.abs(x) > MAP.wallInner - 4 || Math.abs(z) > MAP.wallInner - 4) return false;
  heightAt(x, z, tmpH);
  if (tmpH.h > 0.01) return false; // avoid ramps/sidewalks
  const r = 4;
  colliders.query(x - r, x + r, z - r, z + r, list);
  const fx = Math.sin(heading), fz = Math.cos(heading);
  for (const c of list) if (obbVsCollider(x, z, fx, fz, p.length / 2 + 0.5, p.width / 2 + 0.5, c, 0, tmpRes)) return false;
  return true;
}

// metres of free road ahead of (x,z) along heading, up to `max`
function clearance(colliders, x, z, heading, p, max = 30) {
  const fx = Math.sin(heading), fz = Math.cos(heading);
  for (let d = 4; d <= max; d += 4) {
    if (!free(colliders, x + fx * d, z + fz * d, heading, p)) return d;
  }
  return max;
}

export function findResetSpot(car, colliders) {
  const p = car.p;
  const lineX = snapLine(car.x), lineZ = snapLine(car.z);
  const dX = Math.abs(car.x - lineX), dZ = Math.abs(car.z - lineZ);
  const fwdX = Math.sin(car.heading), fwdZ = Math.cos(car.heading);
  // candidate roads: the nearer one first
  const options = [];
  // road along z (x fixed at lineX): heading 0 or PI
  options.push({ d: dX, x: lineX, z: car.z, axis: 'z', heading: fwdZ >= 0 ? 0 : Math.PI });
  options.push({ d: dZ, x: car.x, z: lineZ, axis: 'x', heading: fwdX >= 0 ? Math.PI / 2 : -Math.PI / 2 });
  options.sort((a, b) => a.d - b.d);
  for (const o of options) {
    for (let k = 0; k < 40; k++) {
      const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 6;
      const x = o.axis === 'z' ? o.x : o.x + off;
      const z = o.axis === 'z' ? o.z + off : o.z;
      const lane = 4; // drive on the right-hand lane
      const lx = Math.cos(o.heading), lz = -Math.sin(o.heading);
      const px = x - lx * lane, pz = z - lz * lane;
      if (!free(colliders, px, pz, o.heading, p)) continue;
      // keep the current direction unless it points straight into something
      if (clearance(colliders, px, pz, o.heading, p) >= 30) return { x: px, z: pz, heading: o.heading };
      const back = o.heading + Math.PI;
      const bx = x + lx * lane, bz = z + lz * lane; // right-hand lane for the opposite direction
      if (free(colliders, bx, bz, back, p) && clearance(colliders, bx, bz, back, p) >= 30) return { x: bx, z: bz, heading: back };
      return { x: px, z: pz, heading: o.heading };
    }
  }
  return { x: 0, z: 230, heading: Math.PI };
}
