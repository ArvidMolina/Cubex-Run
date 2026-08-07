import * as THREE from 'three';
import { mat } from './materials.js';

const boxGeometryCache = new Map();

export function getBoxGeometry(w, h, d) {
  const key = `${w}:${h}:${d}`;
  let geometry = boxGeometryCache.get(key);
  if (!geometry) {
    geometry = new THREE.BoxGeometry(w, h, d);
    boxGeometryCache.set(key, geometry);
  }
  return geometry;
}

export function cube(parent, w, h, d, m, x, y, z) {
  const mesh = new THREE.Mesh(getBoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.userData.sharedGeometry = true;
  parent.add(mesh);
  return mesh;
}

export function buildGoblin() {
  const g = new THREE.Group();
  cube(g, 0.9,  0.9,  0.9,  mat.skin,  0,      0.45, 0);
  cube(g, 0.22, 0.22, 0.05, mat.eyeW, -0.18,   0.62, 0.47);
  cube(g, 0.22, 0.22, 0.05, mat.eyeW,  0.18,   0.62, 0.47);
  cube(g, 0.10, 0.10, 0.05, mat.eyeB, -0.18,   0.62, 0.50);
  cube(g, 0.10, 0.10, 0.05, mat.eyeB,  0.18,   0.62, 0.50);
  cube(g, 0.32, 0.07, 0.05, mat.eyeB,  0,      0.40, 0.47);
  g.children.forEach(c => { if (c.castShadow !== undefined) c.castShadow = true; });
  return g;
}

export function buildSlime() {
  const g = new THREE.Group();
  cube(g, 0.85, 0.65, 0.85, mat.slime,    0,      0.32, 0);
  cube(g, 0.20, 0.20, 0.05, mat.slimeEye,-0.16,   0.50, 0.44);
  cube(g, 0.20, 0.20, 0.05, mat.slimeEye, 0.16,   0.50, 0.44);
  cube(g, 0.10, 0.10, 0.05, mat.slimeEyeB,    -0.16,   0.50, 0.47);
  cube(g, 0.10, 0.10, 0.05, mat.slimeEyeB,     0.16,   0.50, 0.47);
  cube(g, 0.28, 0.07, 0.05, mat.slimeEyeB,     0,      0.28, 0.44);
  g.children.forEach(c => { if (c.castShadow !== undefined) c.castShadow = true; });
  return g;
}

export function buildExit() {
  const g = new THREE.Group();
  cube(g, 0.95, 0.08, 0.95, mat.gold,      0, -0.42, 0);
  cube(g, 0.75, 0.08, 0.75, mat.goldDk,    0, -0.34, 0);
  cube(g, 0.35, 0.6,  0.35, mat.goldShine, 0,  0.05, 0);
  cube(g, 0.18, 0.7,  0.18, mat.gold,      0,  0.05, 0);
  g.children.forEach(c => { if (c.castShadow !== undefined) c.castShadow = true; });
  return g;
}
