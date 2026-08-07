import * as THREE from 'three';
import { cfg } from './config.js';

export const canvas = document.getElementById('game');

export const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  stencil: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setClearColor(0x050608);
// Sombras suaves (PCFSoft) + tone mapping ACES (look cinematográfico)
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050608);

// Cámara ortográfica responsiva al aspect ratio del canvas.
const camHalfW = (cfg.COLS - 1) / 2;  // 5
export const camera = new THREE.OrthographicCamera(
  -camHalfW, camHalfW,
   camHalfW, -camHalfW,
  -10, 50
);
camera.position.set(0, 16, 11);
camera.lookAt(0, 0, 0);

function resize() {
  const w = Math.max(1, canvas.clientWidth);
  const h = Math.max(1, canvas.clientHeight);
  renderer.setSize(w, h, false);
  const aspect = w / h;
  const camHalfH = camHalfW / aspect;
  camera.top    =  camHalfH;
  camera.bottom = -camHalfH;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(resize).observe(canvas);
}

// --- Iluminación: 3-point rig (key + fill + rim) para look premium ---
// Key light: sol diagonal, caste sombras, da volumen.
const key = new THREE.DirectionalLight(0xfff0d0, 2.4);
key.position.set(8, 12, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -10;
key.shadow.camera.right = 10;
key.shadow.camera.top = 10;
key.shadow.camera.bottom = -10;
key.shadow.camera.near = 1;
key.shadow.camera.far = 40;
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.02;
key.shadow.radius = 4;  // blur suave
scene.add(key);

// Fill light: rebota la luz del key desde el lado opuesto, suaviza sombras.
const fill = new THREE.DirectionalLight(0x9ec0ff, 0.6);
fill.position.set(-6, 4, -3);
scene.add(fill);

// Hemisphere: ambient con color de cielo/suelo, da profundidad sutil.
const hemi = new THREE.HemisphereLight(0xb8d4ff, 0x3a2a1a, 0.45);
scene.add(hemi);

// Ambient mínimo para que nada quede negro puro.
const ambient = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambient);
