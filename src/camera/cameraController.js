// Cinematic third-person camera: lagging chase yaw, speed-based distance/FOV,
// independent mouse orbit with auto-return, look-back while reversing, hood
// view, and collision so it never clips into buildings or walls.
import * as THREE from 'three';
import { raycastColliders } from '../world/colliders.js';
import { heightAt } from '../world/terrain.js';

const MODES = [
  { name: 'Chase', dist: 6.6, height: 2.1, fov: 64, lookH: 1.1 },
  { name: 'Far Chase', dist: 11, height: 3.8, fov: 60, lookH: 1.4 },
  { name: 'Hood', hood: true, fov: 76 },
];

const tmpList = [];
const tmpH = { h: 0, gx: 0, gz: 0 };
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class CameraController {
  constructor(camera, colliders) {
    this.camera = camera;
    this.colliders = colliders;
    this.modeIndex = 0;
    this.yaw = 0;           // smoothed chase yaw
    this.orbitYaw = 0;      // mouse offset
    this.orbitPitch = 0.12;
    this.idle = 10;
    this.reverseTimer = 0;
    this.lookBackBlend = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.distCur = 6;
    this.shake = 0;
    this.initialized = false;
  }

  get mode() { return MODES[this.modeIndex]; }

  cycle() {
    this.modeIndex = (this.modeIndex + 1) % MODES.length;
    return this.mode.name;
  }

  snap() { this.initialized = false; }

  addShake(s) { this.shake = Math.min(0.6, this.shake + s); }

  // car: { x, y, z, heading, speed, forwardSpeed, vx, vz, onGround }
  update(dt, car, input) {
    const cam = this.camera;
    const m = this.mode;
    const speed = car.speed;

    // mouse orbit
    if (input.lookX || input.lookY) {
      this.orbitYaw -= input.lookX * 0.0035;
      this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + input.lookY * 0.0025, -0.25, 0.9);
      this.idle = 0;
    } else this.idle += dt;
    if (this.idle > 1.3) {
      const k = 1 - Math.exp(-2.5 * dt);
      this.orbitYaw += angDiff(0, this.orbitYaw) * k;
      this.orbitPitch += (0.12 - this.orbitPitch) * k;
    }

    // look back while reversing (or holding V)
    if (car.forwardSpeed < -2.5) this.reverseTimer += dt; else this.reverseTimer = 0;
    const wantBack = input.lookBack || this.reverseTimer > 0.5;
    this.lookBackBlend += ((wantBack ? 1 : 0) - this.lookBackBlend) * (1 - Math.exp(-5 * dt));

    // chase yaw: follow heading, biased toward the velocity direction in slides
    let target = car.heading;
    if (speed > 6 && car.forwardSpeed > 0) {
      const velYaw = Math.atan2(car.vx, car.vz);
      target += angDiff(velYaw, car.heading) * 0.35;
    }
    target += Math.PI * this.lookBackBlend;
    if (!this.initialized) this.yaw = target;
    this.yaw += angDiff(target, this.yaw) * (1 - Math.exp(-(wantBack ? 7 : 3.6) * dt));

    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let desired, lookAt, fov;

    if (m.hood) {
      const yaw = car.heading + this.orbitYaw + Math.PI * this.lookBackBlend;
      desired = new THREE.Vector3(car.x + fx * 0.2, car.y + 1.28, car.z + fz * 0.2);
      lookAt = new THREE.Vector3(
        desired.x + Math.sin(yaw) * 20,
        desired.y - 0.6 - this.orbitPitch * 6 + 0.72,
        desired.z + Math.cos(yaw) * 20,
      );
      fov = m.fov + Math.min(10, speed * 0.15);
      this.pos.copy(desired);
      this.look.copy(lookAt);
    } else {
      const yaw = this.yaw + this.orbitYaw;
      const dist = m.dist + Math.min(4, speed * 0.05);
      const pitch = this.orbitPitch + (m.height - 2.1) * 0.04;
      const pivot = new THREE.Vector3(car.x, car.y + 1.4, car.z);
      const hd = Math.cos(pitch) * dist;
      desired = new THREE.Vector3(
        pivot.x - Math.sin(yaw) * hd,
        pivot.y + m.height - 1.4 + Math.sin(pitch) * dist,
        pivot.z - Math.cos(yaw) * hd,
      );
      // camera collision against buildings / walls
      const t = raycastColliders(this.colliders, pivot.x, pivot.y, pivot.z, desired.x, desired.y, desired.z, tmpList);
      let wantDist = 1;
      if (t < 1) wantDist = Math.max(0.15, t - 0.4 / dist);
      // pull in instantly, ease back out
      this.distCur = wantDist < this.distCur ? wantDist : this.distCur + (wantDist - this.distCur) * (1 - Math.exp(-3 * dt));
      if (!this.initialized) this.distCur = wantDist;
      desired.lerpVectors(pivot, desired, this.distCur);
      heightAt(desired.x, desired.z, tmpH);
      desired.y = Math.max(desired.y, tmpH.h + 0.6);

      const lead = Math.min(12, 2 + speed * 0.14) * (1 - this.lookBackBlend * 2);
      const lookYaw = this.yaw + this.orbitYaw;
      lookAt = new THREE.Vector3(car.x + Math.sin(lookYaw) * lead, car.y + m.lookH, car.z + Math.cos(lookYaw) * lead);
      fov = m.fov + Math.min(12, speed * 0.17);

      if (!this.initialized) { this.pos.copy(desired); this.look.copy(lookAt); }
      // position: fast follow (the lag comes from the smoothed yaw), vertical slightly softer
      if (this.distCur < 0.999) {
        // obstructed: stay exactly on the collision-safe point
        this.pos.copy(desired);
      } else {
        const kp = 1 - Math.exp(-14 * dt), ky = 1 - Math.exp(-6 * dt);
        this.pos.x += (desired.x - this.pos.x) * kp;
        this.pos.z += (desired.z - this.pos.z) * kp;
        this.pos.y += (desired.y - this.pos.y) * ky;
      }
      this.look.lerp(lookAt, 1 - Math.exp(-12 * dt));
    }
    this.initialized = true;

    cam.fov += (fov - cam.fov) * (1 - Math.exp(-4 * dt));
    cam.updateProjectionMatrix();
    cam.position.copy(this.pos);
    if (this.shake > 0.001) {
      const s = this.shake * 0.35;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
      this.shake *= Math.exp(-7 * dt);
    }
    cam.lookAt(this.look);
  }
}
