import * as THREE from 'three';
import { cfg } from './config.js';
import { grid } from './maze.js';
import { mat } from './materials.js';
import { scene } from './renderer.js';
import { getBoxGeometry } from './builders.js';

// ============================================================
// MUNDO — grupo que contiene todos los meshes del laberinto
// ============================================================
export const world = new THREE.Group();
scene.add(world);

export let cellMeshes = [];

const tileGeometry = new THREE.PlaneGeometry(0.95, 0.95);
const wallGeometry = getBoxGeometry(1.0, 0.9, 1.0);
const wallTopGeometry = getBoxGeometry(0.95, 0.1, 0.95);
const matrix = new THREE.Matrix4();
const hiddenMatrix = new THREE.Matrix4();
const hiddenScale = new THREE.Vector3(0, 0, 0);
const dirtyMeshes = new Set();
let baseFloorGeometry = null;
let lastFogR = Infinity;
let lastFogC = Infinity;

// ---- Conversiones coordenadas ----
export function cellToWorld(r, c) {
  return { x: c - (cfg.COLS - 1) / 2, z: r - (cfg.ROWS - 1) / 2 };
}

export function worldToCell(x, z) {
  return {
    r: Math.round(z + (cfg.ROWS - 1) / 2),
    c: Math.round(x + (cfg.COLS - 1) / 2),
  };
}

export function worldToCellInto(x, z, out) {
  out.r = Math.round(z + (cfg.ROWS - 1) / 2);
  out.c = Math.round(x + (cfg.COLS - 1) / 2);
  return out;
}

function buildInstances(geometry, material, entries, y, rotationX = 0, wallSlot = -1) {
  if (entries.length === 0) return;
  const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.userData.sharedGeometry = true;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    matrix.makeRotationX(rotationX);
    matrix.setPosition(entry.x, y, entry.z);
    mesh.setMatrixAt(i, matrix);
    const ref = { mesh, index: i, matrix: matrix.clone(), visible: true };
    if (wallSlot < 0) cellMeshes[entry.r][entry.c].floor = ref;
    else cellMeshes[entry.r][entry.c].walls[wallSlot] = ref;
  }

  mesh.instanceMatrix.needsUpdate = true;
  world.add(mesh);
}

// ---- Construcción del laberinto ----
export function buildMazeMeshes() {
  const { COLS, ROWS } = cfg;
  cellMeshes = Array.from(
    { length: ROWS },
    () => Array.from({ length: COLS }, () => ({ floor: null, walls: [] }))
  );
  lastFogR = Infinity;
  lastFogC = Infinity;

  // Suelo base ENORME (40x40) para que en cualquier aspect ratio del móvil
  // el suelo cubra toda la vista — sin barras negras a los lados.
  if (!baseFloorGeometry) baseFloorGeometry = new THREE.PlaneGeometry(40, 40);
  const floorMesh = new THREE.Mesh(baseFloorGeometry, mat.floor);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -0.5;
  floorMesh.userData.sharedGeometry = true;
  floorMesh.receiveShadow = true;
  world.add(floorMesh);

  const floorEntries = [];
  const floorAltEntries = [];
  const wallEntries = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const { x, z } = cellToWorld(r, c);
      if (grid[r][c] === 0) {
        const entries = (r + c) % 2 === 0 ? floorAltEntries : floorEntries;
        entries.push({ r, c, x, z });
      } else {
        wallEntries.push({ r, c, x, z });
      }
    }
  }

  const floorInst    = buildInstances(tileGeometry, mat.floor,    floorEntries, -0.49, -Math.PI / 2);
  const floorAltInst = buildInstances(tileGeometry, mat.floorAlt, floorAltEntries, -0.49, -Math.PI / 2);
  const wallInst     = buildInstances(wallGeometry, mat.wall,     wallEntries, -0.05, 0, 0);
  const wallTopInst  = buildInstances(wallTopGeometry, mat.wallTop, wallEntries, 0.45, 0, 1);
  // Sombras: el suelo recibe, las paredes y los topes castean
  if (floorInst)    floorInst.receiveShadow    = true;
  if (floorAltInst) floorAltInst.receiveShadow = true;
  if (wallInst)     wallInst.castShadow        = true;
  if (wallTopInst)  wallTopInst.castShadow     = true;
}

export function clearWorld() {
  world.traverse(object => {
    if (object.isInstancedMesh) object.dispose();
    if (object.geometry && !object.userData.sharedGeometry) object.geometry.dispose();
  });
  world.clear();
  cellMeshes = [];
  lastFogR = Infinity;
  lastFogC = Infinity;
}

// ---- Fog of War ----
export function updateFog(player) {
  const { COLS, ROWS, FOG_RADIUS } = cfg;
  const pcR = Math.round(player.position.z + (ROWS - 1) / 2);
  const pcC = Math.round(player.position.x + (COLS - 1) / 2);
  if (pcR === lastFogR && pcC === lastFogC) return;
  lastFogR = pcR;
  lastFogC = pcC;
  dirtyMeshes.clear();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = cellMeshes[r][c];
      if (!cell) continue;
      const dist = Math.abs(r - pcR) + Math.abs(c - pcC);
      const visible = dist <= FOG_RADIUS;
      if (cell.floor) setRefVisibility(cell.floor, visible);
      for (const ref of cell.walls) {
        setRefVisibility(ref, visible);
      }
    }
  }
  for (const mesh of dirtyMeshes) mesh.instanceMatrix.needsUpdate = true;
}

function setRefVisibility(ref, visible) {
  if (!ref || ref.visible === visible) return;
  ref.visible = visible;
  if (visible) {
    ref.mesh.setMatrixAt(ref.index, ref.matrix);
  } else {
    hiddenMatrix.copy(ref.matrix).scale(hiddenScale);
    ref.mesh.setMatrixAt(ref.index, hiddenMatrix);
  }
  dirtyMeshes.add(ref.mesh);
}
