// Low-poly sports car built from primitives, with a visual suspension rig:
// body roll, pitch (nose dive / squat), heave on landings, wheel spin + steer.
import * as THREE from 'three';
import { makeGlowTexture } from '../world/textures.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class CarModel {
  constructor(params, color = 0xff2fb4) {
    this.p = params;
    this.group = new THREE.Group();      // follows physics position + yaw
    this.body = new THREE.Group();       // visual suspension (pitch/roll/heave)
    this.group.add(this.body);

    const L = params.length, W = params.width;
    const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.3, envMapIntensity: 2.2, emissive: color, emissiveIntensity: 0.12 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0b0b12, metalness: 0.5, roughness: 0.4 });
    const glassM = new THREE.MeshStandardMaterial({ color: 0x0a1020, metalness: 0.9, roughness: 0.05, envMapIntensity: 2 });

    // lower body
    const lower = new THREE.Mesh(new THREE.BoxGeometry(W, 0.55, L), paint);
    lower.position.y = 0.62;
    // nose wedge
    const nose = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.3, 1.1), paint);
    nose.position.set(0, 0.86, L / 2 - 0.75);
    nose.rotation.x = 0.16;
    // cabin
    const cabinGeo = new THREE.BoxGeometry(W * 0.82, 0.55, L * 0.42);
    const pos = cabinGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) { pos.setX(i, pos.getX(i) * 0.82); pos.setZ(i, pos.getZ(i) * 0.7 - 0.1); }
    }
    cabinGeo.computeVertexNormals();
    const cabin = new THREE.Mesh(cabinGeo, glassM);
    cabin.position.set(0, 1.15, -0.25);
    // spoiler
    const wing = new THREE.Mesh(new THREE.BoxGeometry(W * 0.95, 0.08, 0.45), dark);
    wing.position.set(0, 1.28, -L / 2 + 0.3);
    const wl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.25), dark);
    wl.position.set(W * 0.3, 1.08, -L / 2 + 0.3);
    const wr = wl.clone(); wr.position.x = -W * 0.3;
    // side neon stripes
    const stripeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.2, 2.8) });
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, L * 0.85), stripeMat);
    s1.position.set(W / 2 + 0.01, 0.72, 0);
    const s2 = s1.clone(); s2.position.x = -W / 2 - 0.01;

    // lights
    const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3.2) });
    const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.1, 0.2) });
    this.tailMat = tailMat;
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.05), headMat);
    hl.position.set(W * 0.32, 0.82, L / 2 + 0.01);
    const hr = hl.clone(); hr.position.x = -W * 0.32;
    const tl = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.1, 0.05), tailMat);
    tl.position.set(0, 0.85, -L / 2 - 0.01);

    this.body.add(lower, nose, cabin, wing, wl, wr, s1, s2, hl, hr, tl);

    // wheels (not part of body so they stay planted)
    const wheelGeo = new THREE.CylinderGeometry(params.wheelRadius, params.wheelRadius, 0.32, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const rimGeo = new THREE.CylinderGeometry(params.wheelRadius * 0.6, params.wheelRadius * 0.6, 0.34, 6);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 2.2) });
    this.wheels = [];
    const a = params.cgToFront, b = params.cgToRear;
    const wx = W / 2 - 0.12;
    for (const [x, z, front] of [[wx, a, true], [-wx, a, true], [wx, -b, false], [-wx, -b, false]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, params.wheelRadius, z);
      const spin = new THREE.Group();
      spin.add(new THREE.Mesh(wheelGeo, tire), new THREE.Mesh(rimGeo, rimMat));
      pivot.add(spin);
      this.group.add(pivot);
      this.wheels.push({ pivot, spin, front, x, z });
    }

    // underglow + blob shadow
    const glowTex = makeGlowTexture();
    const under = new THREE.Mesh(new THREE.PlaneGeometry(W * 2.6, L * 1.8), new THREE.MeshBasicMaterial({
      map: glowTex, color: new THREE.Color(1.0, 0.25, 1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    under.rotation.x = -Math.PI / 2;
    under.position.y = 0.05;
    this.group.add(under);
    this.under = under;

    // headlight beams: one spotlight + fake light pool ahead
    const spot = new THREE.SpotLight(0xdfe8ff, 60, 70, 0.5, 0.6, 1.4);
    spot.position.set(0, 0.9, L / 2);
    spot.target.position.set(0, 0, L / 2 + 20);
    this.body.add(spot, spot.target);
    this.spot = spot;
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(12, 26), new THREE.MeshBasicMaterial({
      map: glowTex, color: new THREE.Color(0.16, 0.17, 0.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(0, 0.07, L / 2 + 12);
    this.group.add(beam);
    this.beam = beam;

    // suspension state
    this.pitch = 0; this.pitchV = 0;
    this.roll = 0; this.rollV = 0;
    this.heave = 0; this.heaveV = 0;
    this.wheelAngle = 0;
  }

  // physics: CarPhysics; alpha: interpolation factor; dt: frame dt
  update(ph, alpha, dt, brakeLit) {
    const x = ph.px + (ph.x - ph.px) * alpha;
    const z = ph.pz + (ph.z - ph.pz) * alpha;
    const y = ph.py + (ph.y - ph.py) * alpha;
    let dh = ph.heading - ph.pheading;
    const h = ph.pheading + dh * alpha;
    this.group.position.set(x, y, z);
    this.group.rotation.set(0, h, 0);

    // springs toward targets from accelerations
    const k = 60, c = 9;
    // pitch = rotation.x (positive = nose down); roll = rotation.z (positive = rolls right)
    const groundPitch = ph.onGround ? -ph.pitchGround : clamp(-ph.vy * 0.02, -0.35, 0.35);
    const targetPitch = clamp(-ph.axLong * 0.012, -0.08, 0.08) + groundPitch;
    const targetRoll = clamp(ph.ayLat * 0.011, -0.09, 0.09);
    this.pitchV += ((targetPitch - this.pitch) * k - this.pitchV * c) * dt;
    this.rollV += ((targetRoll - this.roll) * k - this.rollV * c) * dt;
    this.heaveV += ((0 - this.heave) * 120 - this.heaveV * 10) * dt;
    this.pitch += this.pitchV * dt;
    this.roll += this.rollV * dt;
    this.heave += this.heaveV * dt;
    this.body.rotation.set(this.pitch, 0, this.roll);
    this.body.position.y = this.heave;

    // wheels
    this.wheelAngle += (ph.forwardSpeed / this.p.wheelRadius) * dt;
    for (const w of this.wheels) {
      w.spin.rotation.x = this.wheelAngle;
      if (w.front) w.pivot.rotation.y = ph.steer;
      // wheels follow the ground pitch so they don't float on ramps
      w.pivot.position.y = this.p.wheelRadius + (ph.onGround ? Math.sin(ph.pitchGround) * w.z : -0.15);
    }
    this.tailMat.color.setRGB(brakeLit ? 4 : 1.6, brakeLit ? 0.2 : 0.05, brakeLit ? 0.3 : 0.12);
    this.under.material.opacity = ph.onGround ? 1 : clamp(1 - (ph.y - ph._gh) * 0.3, 0.1, 1);
  }

  impulse(heave) { this.heaveV -= heave; }
}
