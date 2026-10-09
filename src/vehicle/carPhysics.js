// Arcade vehicle controller built on a dynamic bicycle model:
//  - engine / brake / drag / rolling resistance forces along the car
//  - front + rear tire lateral forces from slip angles with smooth saturation
//  - friction circle on the driven rear axle (power oversteer)
//  - longitudinal weight transfer (braking loads the front tires)
//  - handbrake that drops rear grip for controllable drifts
//  - yaw inertia, momentum, airborne ballistic motion, landings
//  - impulse-based collision response against static colliders
// Coordinates: world XZ plane, heading 0 faces +Z, forward = (sin h, cos h),
// left = (cos h, -sin h). Positive steer / yaw rate = turning left.

import { heightAt } from '../world/terrain.js';
import { obbVsCollider } from '../world/colliders.js';
import { MAP } from '../config/map.js';

const G = 9.81;
const tmpH = { h: 0, gx: 0, gz: 0 };
const tmpRes = { nx: 0, nz: 0, depth: 0, px: 0, pz: 0 };
const tmpList = [];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class CarPhysics {
  constructor(params, world) {
    this.p = params;
    this.world = world;
    const p = params;
    this.L = p.cgToFront + p.cgToRear;
    this.inertia = p.mass * (p.cgToFront * p.cgToFront + p.cgToRear * p.cgToRear) * 0.55 * p.inertiaScale;
    this.hl = p.length / 2;
    this.hw = p.width / 2;
    this.contacts = new Map(); // collider -> last contact time
    this.events = [];          // impacts / landings consumed by effects
    this.time = 0;
    this.reset(0, 0, 0);
  }

  reset(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading;
    heightAt(x, z, tmpH);
    this.y = tmpH.h;
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.yawRate = 0;
    this.steer = 0;
    this.onGround = true;
    this.rearGrip = 1;
    this.landingGrip = 1;
    this.axLong = 0; this.ayLat = 0;
    this.forwardSpeed = 0; this.lateralSpeed = 0;
    this.rearSlip = 0; this.frontSlip = 0;
    this.wheelspin = 0;
    this.airTime = 0; this.airSpin = 0; this.airFlip = 0;
    this.gear = 'D';
    this.pitchGround = 0; this.rollGround = 0;
    this.savePrev();
  }

  savePrev() {
    this.px = this.x; this.pz = this.z; this.py = this.y; this.pheading = this.heading;
  }

  get speed() { return Math.hypot(this.vx, this.vz); }

  step(dt, input) {
    const p = this.p;
    this.time += dt;
    this.savePrev();

    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const lx = fz, lz = -fx;
    let u = this.vx * fx + this.vz * fz;   // forward speed
    let v = this.vx * lx + this.vz * lz;   // leftward speed
    const speed = Math.hypot(u, v);

    // ---- Steering (smoothed, speed sensitive) ----
    const maxSteer = p.maxSteer / (1 + Math.abs(u) * p.steerSpeedFalloff);
    const target = clamp(input.steer, -1, 1) * maxSteer;
    const rate = Math.abs(input.steer) > 0.01 ? p.steerRate : p.steerReturnRate;
    this.steer += (target - this.steer) * (1 - Math.exp(-rate * dt));
    const delta = this.steer;

    // ---- Handbrake grip ----
    if (input.handbrake) this.rearGrip = Math.max(p.handbrakeGripScale, this.rearGrip - dt * 6);
    else this.rearGrip = Math.min(1, this.rearGrip + dt * p.gripRecoveryRate);
    this.landingGrip = Math.min(1, this.landingGrip + dt * 2.2);

    let ax = 0, az = 0, yawAcc = 0;
    this.rearSlip = 0; this.frontSlip = 0; this.wheelspin = 0;

    if (this.onGround) {
      const m = p.mass, a = p.cgToFront, b = p.cgToRear, L = this.L;
      // weight transfer from last step's longitudinal accel
      const W = m * G;
      const transfer = clamp((m * this.axLong * p.cgHeight) / L, -W * 0.3, W * 0.3);
      const Nf = (W * b) / L - transfer;
      const Nr = (W * a) / L + transfer;
      const muF = p.gripFront * this.landingGrip;
      const muR = p.gripRear * this.landingGrip * this.rearGrip;

      // ---- Longitudinal ----
      let Fdrive = 0, Fbrake = 0;
      const throttle = input.throttle, brake = input.brake;
      if (throttle > 0) {
        if (u < -0.5) Fbrake += throttle * p.brakeForce;
        else {
          const f = 1 - Math.pow(clamp(u / p.topSpeed, 0, 1), 3);
          Fdrive += throttle * p.driveForce * f;
        }
      }
      if (brake > 0) {
        if (u > 0.5) Fbrake += brake * p.brakeForce;
        else if (throttle <= 0) {
          const f = 1 - clamp(-u / p.reverseTopSpeed, 0, 1);
          Fdrive -= brake * p.reverseForce * f;
        }
      }
      this.gear = u < -0.3 || (brake > 0 && u <= 0.5 && throttle <= 0) ? 'R' : 'D';

      // traction limit on driven rear axle
      const rearCap = muR * Nr;
      if (Math.abs(Fdrive) > rearCap) {
        this.wheelspin = (Math.abs(Fdrive) - rearCap) / rearCap;
        Fdrive = Math.sign(Fdrive) * rearCap;
      }
      const dirU = u >= 0 ? 1 : -1;
      let Fx = Fdrive;
      // brakes (with stop-at-zero handling)
      Fbrake = Math.min(Fbrake, (muF * Nf + muR * Nr) * 1.05);
      if (input.handbrake && Math.abs(u) > 0.3) Fbrake += Math.min(p.handbrakeForce, rearCap * 0.8);
      if (throttle <= 0 && brake <= 0) Fbrake += p.engineBraking * Math.min(1, Math.abs(u) / 3);
      Fbrake += p.rollingResistance * Math.min(1, Math.abs(u));
      const brakeDv = (Fbrake / m) * dt;
      if (Math.abs(u) <= brakeDv && Fdrive === 0) {
        // would cross zero -> stop longitudinally
        Fx = -u * m / dt;
      } else {
        Fx -= dirU * Fbrake;
      }

      // ---- Lateral tire forces ----
      const sgn = u >= 0 ? 1 : -1;
      const uAbs = Math.max(Math.abs(u), 1.5);
      const r = this.yawRate;
      const alphaF = Math.atan2(v + a * r, uAbs) - delta * sgn;
      const alphaR = Math.atan2(v - b * r, uAbs);
      const FfMax = muF * Nf;
      // friction circle: drive/brake force eats into rear lateral capacity
      const rearLong = Math.min(Math.abs(Fdrive) * p.powerOversteer + (input.handbrake ? p.handbrakeForce : 0), rearCap * 0.95);
      const FrMax = Math.sqrt(Math.max(rearCap * rearCap - rearLong * rearLong, rearCap * rearCap * 0.04));
      const Ffy = FfMax * Math.tanh((-p.corneringStiffnessFront * alphaF) / FfMax);
      const Fry = FrMax * Math.tanh((-p.corneringStiffnessRear * alphaR) / FrMax);
      this.frontSlip = Math.abs(alphaF);
      this.rearSlip = Math.abs(v - b * r);

      const cosD = Math.cos(delta), sinD = Math.sin(delta);
      Fx += -Ffy * sinD;
      const Fy = Ffy * cosD + Fry;

      // yaw
      let torque = a * Ffy * cosD - b * Fry;
      // arcade assist: damp yaw toward the driver's intended (grip-limited) rate
      const rKin = (u * Math.tan(delta)) / L;
      const rLimit = (p.gripFront * G * 1.1) / Math.max(Math.abs(u), 3);
      const rIntended = clamp(rKin, -rLimit, rLimit);
      const assist = (p.yawDamping + p.stabilityAssist) * (input.handbrake ? p.handbrakeAssist : 1) * clamp(speed / 8, 0, 1);
      torque -= this.inertia * assist * (r - rIntended) * 6;
      yawAcc = torque / this.inertia;

      // world accel
      ax = (Fx * fx + Fy * lx) / m;
      az = (Fx * fz + Fy * lz) / m;
      this.axLong = Fx / m;
      this.ayLat = Fy / m;
    } else {
      // airborne: just slight air control damping
      // air control: steer spins the car for tricks
      this.yawRate += input.steer * 7 * dt;
      this.yawRate = clamp(this.yawRate, -7, 7) * Math.exp(-0.3 * dt);
      this.airSpin += this.yawRate * dt;
      if (input.handbrake) this.airFlip += dt;
      this.axLong *= 0.9; this.ayLat *= 0.9;
    }

    // aero drag (always)
    const dragF = p.dragCoefficient * speed;
    ax -= (dragF * this.vx) / p.mass;
    az -= (dragF * this.vz) / p.mass;

    this.vx += ax * dt;
    this.vz += az * dt;
    this.yawRate += yawAcc * dt;

    // ---- Low-speed blending toward kinematic steering (prevents jitter) ----
    if (this.onGround) {
      u = this.vx * fx + this.vz * fz;
      v = this.vx * lx + this.vz * lz;
      const sp = Math.hypot(u, v);
      if (sp < 4) {
        const k = sp / 4;
        const rKin = (u * Math.tan(delta)) / this.L;
        this.yawRate = rKin + (this.yawRate - rKin) * k;
        const vNew = v * (0.85 + 0.15 * k);
        this.vx = u * fx + vNew * lx;
        this.vz = u * fz + vNew * lz;
        v = vNew;
      }
      // soft drift-angle limit keeps slides recoverable
      if (sp > 5) {
        const beta = Math.atan2(v, Math.abs(u));
        const lim = this.p.maxDriftAngle;
        if (Math.abs(beta) > lim) {
          const excess = Math.abs(beta) - lim;
          const vTarget = Math.sign(v) * Math.abs(u) * Math.tan(lim);
          const vNew = v + (vTarget - v) * clamp(excess * 40 * dt, 0, 1);
          this.vx = u * fx + vNew * lx;
          this.vz = u * fz + vNew * lz;
          // stop the body rotating further into the slide
          if (Math.sign(this.yawRate) === -Math.sign(v)) this.yawRate *= Math.exp(-excess * 30 * dt);
        }
      }
    }

    this.heading += this.yawRate * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // ---- Collisions ----
    this.resolveCollisions();

    // ---- Vertical / ground contact ----
    this.updateVertical(dt);

    // derived values for HUD / effects
    const hfx = Math.sin(this.heading), hfz = Math.cos(this.heading);
    this.forwardSpeed = this.vx * hfx + this.vz * hfz;
    this.lateralSpeed = this.vx * hfz - this.vz * hfx;
  }

  groundUnderCar() {
    // sample both axles: body height is their average, pitch follows slope
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const a = this.p.cgToFront, b = this.p.cgToRear;
    heightAt(this.x + fx * a, this.z + fz * a, tmpH);
    const hf = tmpH.h, gxf = tmpH.gx, gzf = tmpH.gz;
    heightAt(this.x - fx * b, this.z - fz * b, tmpH);
    const hr = tmpH.h;
    this.pitchGround = Math.atan2(hf - hr, a + b);
    this._gh = (hf + hr) * 0.5;
    this._ggx = (gxf + tmpH.gx) * 0.5;
    this._ggz = (gzf + tmpH.gz) * 0.5;
  }

  updateVertical(dt) {
    const p = this.p;
    const g = G * p.gravityScale;
    this.groundUnderCar();
    const gh = this._gh;
    const vyGround = this._ggx * this.vx + this._ggz * this.vz;
    if (this.onGround) {
      const yBall = this.y + this.vy * dt - g * dt * dt;
      if (yBall > gh + 0.05) {
        // crest or drop-off: become airborne, keep vertical momentum
        this.onGround = false;
        this.airTime = 0; this.airSpin = 0; this.airFlip = 0;
        this.y = yBall;
        this.vy -= g * dt;
      } else {
        if (gh - this.y > 0.08) this.events.push({ type: 'bump', strength: gh - this.y });
        this.y = gh;
        this.vy = vyGround;
      }
    } else {
      this.airTime += dt;
      this.vy -= g * dt;
      this.y += this.vy * dt;
      if (this.y <= gh) {
        const impact = vyGround - this.vy;
        this.y = gh;
        this.vy = vyGround;
        this.onGround = true;
        if (impact > 2) {
          this.landingGrip = Math.min(this.landingGrip, 1 - (1 - p.landingGripLoss) * clamp(impact / 10, 0, 1));
          // landing scrubs a little speed
          const k = 1 - clamp(impact * 0.006, 0, 0.08);
          this.vx *= k; this.vz *= k;
        }
        this.events.push({ type: 'land', strength: impact, airTime: this.airTime, spin: this.airSpin, flip: this.airFlip });
        // land pointing along the direction of travel so tricks stay rideable
        if (Math.abs(this.airSpin) > 1) { const sp = Math.hypot(this.vx, this.vz); if (sp > 3) { const vh = Math.atan2(this.vx, this.vz); const d = Math.atan2(Math.sin(vh - this.heading), Math.cos(vh - this.heading)); if (Math.abs(d) < 1.2) this.heading += d * 0.6; } this.yawRate *= 0.2; }
      }
    }
  }

  resolveCollisions() {
    const world = this.world;
    const r = Math.hypot(this.hl, this.hw) + 0.5;
    world.query(this.x - r, this.x + r, this.z - r, this.z + r, tmpList);
    const m = this.p.mass, I = this.inertia;
    for (let iter = 0; iter < 3; iter++) {
      let any = false;
      for (const col of tmpList) {
        const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
        if (!obbVsCollider(this.x, this.z, fx, fz, this.hl, this.hw, col, this.y, tmpRes)) continue;
        any = true;
        const { nx, nz, depth } = tmpRes;
        // positional correction
        this.x += nx * (depth + 0.001);
        this.z += nz * (depth + 0.001);
        // contact velocity incl. rotation: v_p = v + w * perp(r), perp(r)=(rz,-rx)
        const rx = tmpRes.px - this.x, rz = tmpRes.pz - this.z;
        const vpx = this.vx + this.yawRate * rz;
        const vpz = this.vz - this.yawRate * rx;
        const vn = vpx * nx + vpz * nz;
        const rn = rz * nx - rx * nz;
        if (vn < 0) {
          const e = 0.18;
          const j = (-(1 + e) * vn) / (1 / m + (rn * rn) / I);
          this.vx += (j * nx) / m;
          this.vz += (j * nz) / m;
          this.yawRate += ((rn * j) / I) * 0.55;
          // tangential friction scrub
          const tx = -nz, tz = nx;
          const vt = this.vx * tx + this.vz * tz;
          const scrub = Math.min(Math.abs(vt), (0.25 * j) / m) * Math.sign(vt);
          this.vx -= tx * scrub;
          this.vz -= tz * scrub;
          if (-vn > 1.0 && iter === 0) {
            this.events.push({ type: 'impact', strength: -vn, x: tmpRes.px, z: tmpRes.pz, y: this.y + 0.6, nx, nz });
          }
        }
        this.contacts.set(col, { time: this.time, speed: Math.max(0, -vn) });
      }
      if (!any) break;
    }
    // hard safety clamp inside the perimeter
    const lim = MAP.wallInner - 1;
    if (this.x > lim) { this.x = lim; this.vx = Math.min(this.vx, 0); }
    if (this.x < -lim) { this.x = -lim; this.vx = Math.max(this.vx, 0); }
    if (this.z > lim) { this.z = lim; this.vz = Math.min(this.vz, 0); }
    if (this.z < -lim) { this.z = -lim; this.vz = Math.max(this.vz, 0); }
  }
}
