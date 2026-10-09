// Pooled particle effects (tire smoke, impact sparks) and ring-buffer skid marks.
// All capped, allocation-free per frame, decoupled from physics.
import * as THREE from 'three';
import { makeSmokeTexture } from '../world/textures.js';

const MAX_SMOKE = 180;
const MAX_SPARKS = 120;
const MAX_SKID = 700; // segments

class ParticlePool {
  constructor(max, material) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max).fill(1);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(g, material);
    this.points.frustumCulled = false;
  }
  spawn(x, y, z, vx, vy, vz, life, size) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size;
  }
  update(dt, gravity, grow, drag) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      any = true;
      this.life[i] -= dt;
      const t = this.life[i] / this.maxLife[i];
      this.vel[i * 3 + 1] -= gravity * dt;
      const d = Math.exp(-drag * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += grow * dt;
      this.alpha[i] = Math.max(0, t);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
    this.points.visible = any;
  }
}

function pointsMaterial(tex, color, additive) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, color: { value: new THREE.Color(...color) }, scale: { value: 420 }, opacity: { value: additive ? 1 : 0.32 } },
    vertexShader: `attribute float size; attribute float alpha; varying float vA; uniform float scale;
      void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 color; uniform float opacity; varying float vA;
      void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(color, t.a * vA * opacity); if (gl_FragColor.a < 0.01) discard; }`,
    transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

export class Effects {
  constructor(scene) {
    const smokeTex = makeSmokeTexture();
    this.smoke = new ParticlePool(MAX_SMOKE, pointsMaterial(smokeTex, [0.75, 0.72, 0.85], false));
    this.smoke.points.material.uniforms.color.value.setRGB(0.7, 0.68, 0.8);
    this.sparks = new ParticlePool(MAX_SPARKS, pointsMaterial(smokeTex, [3.0, 1.8, 0.6], true));
    scene.add(this.smoke.points, this.sparks.points);

    // skid marks: quads in a ring buffer
    this.skidPos = new Float32Array(MAX_SKID * 4 * 3);
    this.skidAlpha = new Float32Array(MAX_SKID * 4);
    this.skidAge = new Float32Array(MAX_SKID).fill(999);
    const idx = new Uint16Array(MAX_SKID * 6);
    for (let i = 0; i < MAX_SKID; i++) {
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.skidPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.skidAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(0.02,0.02,0.03, vA * 0.75); }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.skidMesh = new THREE.Mesh(g, m);
    this.skidMesh.frustumCulled = false;
    scene.add(this.skidMesh);
    this.skidCursor = 0;
    this.lastWheel = [null, null]; // previous rear wheel positions
    this.skidTimer = 0;
  }

  // Called once per render frame with interpolated car data
  update(dt, ph, model) {
    const fx = Math.sin(ph.heading), fz = Math.cos(ph.heading);
    const lx = fz, lz = -fx;
    const slide = ph.onGround ? Math.abs(ph.lateralSpeed) : 0;
    const spin = ph.onGround ? ph.wheelspin : 0;
    const speed = ph.speed;
    const sliding = ph.onGround && speed > 4 && (slide > 3.2 || (ph.rearGrip < 0.8 && speed > 8));
    const smoking = sliding || (spin > 0.15 && ph.onGround);

    const rearZ = -ph.p.cgToRear, hw = ph.p.width / 2 - 0.15;
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? 1 : -1;
      const wx = ph.x + fx * rearZ + lx * hw * side;
      const wz = ph.z + fz * rearZ + lz * hw * side;
      const wy = ph.y + 0.03;
      if (smoking && Math.random() < 0.35) {
        const k = Math.min(1, (slide + spin * 8) / 10);
        this.smoke.spawn(wx, wy + 0.3, wz, (Math.random() - 0.5) * 2 - ph.vx * 0.1, 0.8 + Math.random(), (Math.random() - 0.5) * 2 - ph.vz * 0.1,
          0.7 + Math.random() * 0.6 * k, 0.8 + k * 0.9);
      }
      // skid marks
      const prev = this.lastWheel[s];
      if (sliding) {
        if (prev && Math.hypot(wx - prev[0], wz - prev[1]) > 0.35) {
          this.addSkid(prev[0], prev[1], wx, wz, wy, lx, lz);
          this.lastWheel[s] = [wx, wz];
        } else if (!prev) this.lastWheel[s] = [wx, wz];
      } else this.lastWheel[s] = null;
    }

    this.smoke.update(dt, -0.6, 1.4, 1.5);
    this.sparks.update(dt, 14, -0.5, 0.8);

    // fade skid marks (cheap: only every ~0.2s)
    this.skidTimer += dt;
    if (this.skidTimer > 0.2) {
      const step = this.skidTimer; this.skidTimer = 0;
      for (let i = 0; i < MAX_SKID; i++) {
        if (this.skidAge[i] > 20) continue;
        this.skidAge[i] += step;
        const a = Math.max(0, 1 - this.skidAge[i] / 14);
        for (let k = 0; k < 4; k++) this.skidAlpha[i * 4 + k] = a;
      }
      this.skidMesh.geometry.attributes.alpha.needsUpdate = true;
    }
  }

  addSkid(x0, z0, x1, z1, y, lx, lz) {
    const i = this.skidCursor;
    this.skidCursor = (this.skidCursor + 1) % MAX_SKID;
    const w = 0.13;
    const p = this.skidPos, o = i * 12;
    p[o] = x0 + lx * w; p[o + 1] = y; p[o + 2] = z0 + lz * w;
    p[o + 3] = x0 - lx * w; p[o + 4] = y; p[o + 5] = z0 - lz * w;
    p[o + 6] = x1 + lx * w; p[o + 7] = y; p[o + 8] = z1 + lz * w;
    p[o + 9] = x1 - lx * w; p[o + 10] = y; p[o + 11] = z1 - lz * w;
    this.skidAge[i] = 0;
    for (let k = 0; k < 4; k++) this.skidAlpha[i * 4 + k] = 1;
    const g = this.skidMesh.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
  }

  impact(x, y, z, nx, nz, strength) {
    const n = Math.min(40, Math.floor(strength * 3));
    for (let i = 0; i < n; i++) {
      const sp = 3 + Math.random() * strength * 0.6;
      this.sparks.spawn(x, y, z,
        nx * sp + (Math.random() - 0.5) * 6, 2 + Math.random() * 5, nz * sp + (Math.random() - 0.5) * 6,
        0.3 + Math.random() * 0.4, 0.25 + Math.random() * 0.2);
    }
    for (let i = 0; i < Math.min(8, n / 3); i++) {
      this.smoke.spawn(x, y, z, nx * 2 + (Math.random() - 0.5) * 2, 1, nz * 2 + (Math.random() - 0.5) * 2, 0.8, 1.5);
    }
  }

  landing(x, y, z, strength) {
    const n = Math.min(14, Math.floor(strength * 1.5));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.smoke.spawn(x + Math.cos(a) * 1.5, y + 0.2, z + Math.sin(a) * 1.5, Math.cos(a) * 4, 0.5, Math.sin(a) * 4, 0.7, 1.4);
    }
  }
}
