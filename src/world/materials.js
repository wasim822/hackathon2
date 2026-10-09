// Shared material library. Reusing materials keeps shader programs and draw
// calls low; "neon" materials are unlit with HDR colors so bloom picks them up.
import * as THREE from 'three';
import { makeWindowTexture, makeScreenTexture } from './textures.js';

const cache = new Map();

export const Mats = {
  windowsCool: null,
  windowsWarm: null,
  screen: null,
  pulse: [], // materials whose intensity animates (cheap shared uniforms)
};

export function initMaterials() {
  Mats.windowsCool = makeWindowTexture(7, false);
  Mats.windowsWarm = makeWindowTexture(13, true);
  Mats.screen = makeScreenTexture();
}

export function neon(color, intensity = 2.2) {
  const key = `neon:${color}:${intensity}`;
  if (!cache.has(key)) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), fog: true });
    cache.set(key, m);
  }
  return cache.get(key);
}

// Pulsing neon shared by a whole district (one material = one uniform update)
export function pulseNeon(color, intensity = 2.4, speed = 1.5, phase = 0) {
  const key = `pulse:${color}:${speed}:${phase}`;
  if (!cache.has(key)) {
    const base = new THREE.Color(color);
    const m = new THREE.MeshBasicMaterial({ color: base.clone().multiplyScalar(intensity) });
    m.userData.pulse = { base, intensity, speed, phase };
    Mats.pulse.push(m);
    cache.set(key, m);
  }
  return cache.get(key);
}

export function glass(tint, emissiveTint, warm = false, emissiveIntensity = 1.0) {
  const key = `glass:${tint}:${emissiveTint}:${warm}:${emissiveIntensity}`;
  if (!cache.has(key)) {
    const tex = warm ? Mats.windowsWarm : Mats.windowsCool;
    cache.set(key, new THREE.MeshStandardMaterial({
      color: tint, metalness: 0.85, roughness: 0.18,
      emissive: emissiveTint, emissiveMap: tex, emissiveIntensity,
      envMapIntensity: 1.4,
    }));
  }
  return cache.get(key);
}

export function solid(color, rough = 0.6, metal = 0.2, emissive = 0x000000) {
  const key = `solid:${color}:${rough}:${metal}:${emissive}`;
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive }));
  }
  return cache.get(key);
}

export function screenMat() {
  const key = 'screen';
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshBasicMaterial({ map: Mats.screen, color: new THREE.Color(1.5, 1.5, 1.5) }));
  }
  return cache.get(key);
}

export function updateMaterials(t) {
  for (const m of Mats.pulse) {
    const p = m.userData.pulse;
    const k = p.intensity * (0.65 + 0.35 * Math.sin(t * p.speed + p.phase));
    m.color.copy(p.base).multiplyScalar(k);
  }
  if (Mats.screen) Mats.screen.offset.y = (t * 0.05) % 1;
}
