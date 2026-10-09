// Collects world-space geometries keyed by material and merges each group into
// a single mesh. This keeps the city at a few dozen draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const WIN_U = 6, WIN_V = 4.5; // meters per window texture cell (x8 per texture)

export class Batcher {
  constructor() {
    this.groups = new Map(); // material -> geometries[]
  }

  add(material, geometry) {
    let list = this.groups.get(material);
    if (!list) { list = []; this.groups.set(material, list); }
    // normalise so everything merges (mix of indexed primitives + extrusions)
    if (geometry.index) { const ni = geometry.toNonIndexed(); geometry.dispose(); geometry = ni; }
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') geometry.deleteAttribute(name);
    }
    list.push(geometry);
    return geometry;
  }

  // Axis-aligned box with world-scaled window UVs. rotY optional.
  box(material, w, h, d, x, y, z, rotY = 0, windowUV = false) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (windowUV) scaleBoxUV(g, w, h, d);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y + h / 2, z);
    return this.add(material, g);
  }

  cylinder(material, rTop, rBot, h, x, y, z, seg = 16, windowUV = false) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, false);
    if (windowUV) {
      const uv = g.attributes.uv;
      const circ = Math.PI * 2 * rBot;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / (WIN_U * 8), uv.getY(i) * h / (WIN_V * 8));
    }
    g.translate(x, y + h / 2, z);
    return this.add(material, g);
  }

  cone(material, r, h, x, y, z, seg = 12) {
    const g = new THREE.ConeGeometry(r, h, seg);
    g.translate(x, y + h / 2, z);
    return this.add(material, g);
  }

  geometry(material, g) { return this.add(material, g); }

  build(parent) {
    const meshes = [];
    for (const [mat, list] of this.groups) {
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.groups.clear();
    return meshes;
  }
}

// Box face order: +x, -x, +y, -y, +z, -z (4 verts each)
export function scaleBoxUV(g, w, h, d) {
  const uv = g.attributes.uv;
  const su = 1 / (WIN_U * 8), sv = 1 / (WIN_V * 8);
  for (let f = 0; f < 6; f++) {
    const span = f < 2 ? d : w;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (f === 2 || f === 3) { uv.setXY(i, 0.005, 0.005); continue; }
      uv.setXY(i, uv.getX(i) * span * su, uv.getY(i) * h * sv);
    }
  }
  uv.needsUpdate = true;
}
