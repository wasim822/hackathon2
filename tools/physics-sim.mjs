// Headless handling tests for the vehicle controller: `npm run test:physics`
import { CarPhysics } from '../src/vehicle/carPhysics.js';
import { ColliderWorld } from '../src/world/colliders.js';
import { VEHICLES } from '../src/config/vehicles.js';

const DT = 1 / 120;
const world = new ColliderWorld();
const kmh = (v) => (v * 3.6).toFixed(1);
const deg = (r) => ((r * 180) / Math.PI).toFixed(1);

function car(x = 0, z = -470, h = 0) {
  const c = new CarPhysics(VEHICLES.sports, world);
  c.reset(x, z, h);
  return c;
}
const inp = (o = {}) => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, ...o });
function run(c, secs, input, every) {
  const n = Math.round(secs / DT);
  for (let i = 0; i < n; i++) {
    c.step(DT, typeof input === 'function' ? input(i * DT, c) : input);
    if (every && i % Math.round(every / DT) === 0) every.cb?.(c);
    if (!Number.isFinite(c.x + c.z + c.vx + c.vz + c.yawRate + c.y)) throw new Error('NaN state');
  }
}

// 1. acceleration
{
  const c = car();
  let t100 = null, t = 0;
  while (t < 30) { c.step(DT, inp({ throttle: 1 })); t += DT; if (!t100 && c.speed >= 100 / 3.6) t100 = t; if (c.z > 470) break; }
  console.log(`0-100 km/h: ${t100?.toFixed(2)}s, speed after ${t.toFixed(1)}s: ${kmh(c.speed)} km/h`);
}
// top speed (long straight simulated by resetting position)
{
  const c = car();
  for (let i = 0; i < 60 / DT; i++) { c.step(DT, inp({ throttle: 1 })); if (c.z > 400) c.z = -400; }
  console.log(`top speed: ${kmh(c.speed)} km/h`);
}
// 2. coast
{
  const c = car(); c.vz = 100 / 3.6;
  run(c, 3, inp());
  console.log(`coast 3s from 100: ${kmh(c.speed)} km/h`);
}
// 3. brake
{
  const c = car(); c.vz = 100 / 3.6; const z0 = c.z; let t = 0;
  while (c.speed > 0.05 && t < 10) { c.step(DT, inp({ brake: 1 })); t += DT; }
  console.log(`brake 100-0: ${t.toFixed(2)}s, ${(c.z - z0).toFixed(1)} m, gear ${c.gear}`);
  run(c, 3, inp({ brake: 1 }));
  console.log(`  then holding S 3s -> reverse speed ${kmh(c.forwardSpeed)} km/h gear ${c.gear}`);
}
// 4. steady-state cornering at several speeds
for (const v0 of [10, 20, 30, 45]) {
  const c = car(0, 0, 0); c.vz = v0;
  // hold speed with throttle controller and full left steer
  run(c, 4, (t, cc) => inp({ throttle: cc.forwardSpeed < v0 ? 1 : 0, steer: 1 }));
  const slip = Math.atan2(c.lateralSpeed, c.forwardSpeed);
  const latG = (c.speed * Math.abs(c.yawRate)) / 9.81;
  console.log(`corner @${kmh(v0)}: yawRate ${deg(c.yawRate)}°/s radius ${(c.speed / Math.abs(c.yawRate)).toFixed(1)}m latG ${latG.toFixed(2)} slip ${deg(slip)}° speed ${kmh(c.speed)}`);
}
// 5. handbrake drift and recovery
{
  const c = car(0, 0, 0); c.vz = 25;
  let maxSlip = 0;
  run(c, 0.25, inp({ throttle: 0.6, steer: 1, handbrake: false }));
  run(c, 0.8, (t, cc) => { maxSlip = Math.max(maxSlip, Math.abs(Math.atan2(cc.lateralSpeed, cc.forwardSpeed))); return inp({ throttle: 0.6, steer: 1, handbrake: true }); });
  const slipAfterHB = Math.atan2(c.lateralSpeed, c.forwardSpeed);
  // countersteer and throttle
  run(c, 1.2, (t, cc) => { const s = Math.atan2(cc.lateralSpeed, cc.forwardSpeed); maxSlip = Math.max(maxSlip, Math.abs(s)); return inp({ throttle: 0.7, steer: -Math.sign(s) * Math.min(1, Math.abs(s) * 2) }); });
  const slipEnd = Math.atan2(c.lateralSpeed, c.forwardSpeed);
  run(c, 1.5, inp({ throttle: 0.5 }));
  console.log(`drift: slip after handbrake ${deg(slipAfterHB)}°, max ${deg(maxSlip)}°, after countersteer ${deg(slipEnd)}°, settled ${deg(Math.atan2(c.lateralSpeed, c.forwardSpeed))}° yaw ${deg(c.yawRate)}°/s speed ${kmh(c.speed)}`);
}
// 6. high-speed lane change stability
{
  const c = car(0, -470, 0); c.vz = 50;
  run(c, 3, (t) => inp({ throttle: 1, steer: Math.sin(t * 3) * 1 }));
  console.log(`slalom @180: slip ${deg(Math.atan2(c.lateralSpeed, c.forwardSpeed))}° yaw ${deg(c.yawRate)}°/s speed ${kmh(c.speed)}`);
}
// 7. wall collision
{
  const w = new ColliderWorld();
  w.addBox(-50, 50, 20, 26, {});
  const c = new CarPhysics(VEHICLES.sports, w); c.reset(0, 0, 0); c.vz = 40;
  run(c, 1.5, inp({ throttle: 1 }));
  console.log(`wall hit @144: z=${c.z.toFixed(2)} (wall at 20) speed ${kmh(c.speed)} events ${c.events.filter((e) => e.type === 'impact').length}`);
  c.reset(0, 0, 0.6); c.vx = 25; c.vz = 30; c.events.length = 0;
  run(c, 1.5, inp({ throttle: 1 }));
  console.log(`angled hit: z=${c.z.toFixed(2)} heading ${deg(c.heading)}° speed ${kmh(c.speed)}`);
}
// 8. jump ramp (first ramp in config: x=-240+5 lane, from z=212 going -z)
{
  const c = car(-235, 300, Math.PI); c.vz = -38;
  let maxY = 0, air = 0, land = null;
  run(c, 4, (t, cc) => { maxY = Math.max(maxY, cc.y); if (!cc.onGround) air += DT; return inp({ throttle: 1 }); });
  land = c.events.find((e) => e.type === 'land');
  console.log(`jump @137: maxY ${maxY.toFixed(2)}m airtime ${air.toFixed(2)}s landing impact ${land?.strength.toFixed(2)}`);
}
// 9. random fuzz
{
  const c = car(0, 0, 0);
  let s = 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let cur = inp();
  run(c, 120, (t) => { if (Math.floor(t * 120) % 60 === 0) cur = inp({ throttle: rnd() > 0.3 ? 1 : 0, brake: rnd() > 0.8 ? 1 : 0, steer: rnd() * 2 - 1, handbrake: rnd() > 0.85 }); return cur; });
  console.log(`fuzz ok: pos ${c.x.toFixed(0)},${c.z.toFixed(0)} speed ${kmh(c.speed)}`);
}
