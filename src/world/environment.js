// Night sky, fog, the few real lights, a neon environment map for glossy
// "wet" reflections, and the bloom post-processing chain.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export function setupEnvironment(scene, renderer) {
  scene.background = new THREE.Color(0x07041a);
  scene.fog = new THREE.FogExp2(0x120a2e, 0.0024);

  // sky dome with gradient + stars
  const skyGeo = new THREE.SphereGeometry(1400, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {},
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir;
      float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        float h = clamp(vDir.y, -0.1, 1.0);
        vec3 horizon = vec3(0.42, 0.10, 0.48);
        vec3 mid = vec3(0.10, 0.04, 0.26);
        vec3 top = vec3(0.01, 0.01, 0.06);
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        c = mix(c, top, smoothstep(0.18, 0.7, h));
        vec3 p = floor(vDir * 420.0);
        float s = step(0.9975, hash(p)) * smoothstep(0.15, 0.5, h);
        c += vec3(s);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -10;
  scene.add(sky);

  // lights: one hemisphere + one moon directional, no shadows (performance)
  scene.add(new THREE.HemisphereLight(0x6a5cff, 0x1a0b24, 0.9));
  const moon = new THREE.DirectionalLight(0xa7b4ff, 0.6);
  moon.position.set(-200, 400, -150);
  scene.add(moon);

  // neon environment map: a box room with glowing colored panels, prefiltered once
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x080414);
  const panel = (color, x, y, z, w, h, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; envScene.add(m);
  };
  panel(0xff2fb4, 0, 2, -10, 6, 2, 0);
  panel(0x2f8cff, -4, 1.5, -10, 6, 1.5, 0);
  panel(0x2fd1ff, 10, 1, 0, 12, 2, -Math.PI / 2);
  panel(0xb44dff, -10, 3, 0, 10, 4, Math.PI / 2);
  panel(0x39ff6a, 0, 1, 10, 6, 1.5, Math.PI);
  panel(0xff7a1a, -6, 1, 10, 5, 1.2, Math.PI);
  panel(0xffd23f, 6, 4, 8, 4, 1, Math.PI);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = env;
  pmrem.dispose();

  return { sky };
}

export function createComposer(renderer, scene, camera, w, h) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.7, 0.5, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return { composer, bloom };
}
