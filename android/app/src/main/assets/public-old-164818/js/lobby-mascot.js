import * as THREE from 'three';
import { buildGoblin } from './builders.js';

const canvas = document.getElementById('logoGoblin3D');
const emblem = canvas ? canvas.closest('.logo-emblem') : null;
if (!canvas) {
  // Lobby no presente
} else {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    stencil: false,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  camera.position.set(0, 0.8, 3.2);
  camera.lookAt(0, 0.4, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const key = new THREE.DirectionalLight(0xfff2ce, 0.9);
  key.position.set(1.8, 2.5, 2.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fd37a, 0.45);
  rim.position.set(-2, 1.5, -1.5);
  scene.add(rim);

  const goblin = buildGoblin();
  goblin.position.set(0, -0.15, 0);
  goblin.scale.set(1.05, 1.05, 1.05);
  scene.add(goblin);
  const [, , , pupilL, pupilR, mouth] = goblin.children;
  const mouthBaseY = mouth ? mouth.position.y : 0.4;
  const mouthBaseScaleX = mouth ? mouth.scale.x : 1;
  const mouthBaseScaleY = mouth ? mouth.scale.y : 1;
  const animationStart = performance.now() * 0.001;
  const lobby = document.getElementById('lobby');
  let animationFrameId = null;

  function resize() {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }

  renderer.render(scene, camera);
  if (emblem) emblem.classList.add('mascot-ready');

  function shouldAnimate() {
    return !document.hidden && lobby && !lobby.classList.contains('hide');
  }

  function tick() {
    animationFrameId = null;
    if (!shouldAnimate()) return;
    const t = performance.now() * 0.001;
    const elapsed = Math.max(0, t - animationStart);
    const ramp = Math.min(1, elapsed / 0.3);
    const lookX = Math.sin(elapsed * 0.9) * 0.018 * ramp;
    const lookY = Math.sin(elapsed * 1.4) * 0.012 * ramp;
    const expression = Math.sin(elapsed * 1.6) * ramp;

    goblin.rotation.y = Math.sin(elapsed * 1.2) * 0.35 * ramp;
    goblin.position.y = -0.15 + Math.sin(elapsed * 2.4) * 0.04 * ramp;

    if (pupilL && pupilR) {
      pupilL.position.x = -0.18 + lookX;
      pupilR.position.x = 0.18 + lookX;
      pupilL.position.y = 0.62 + lookY;
      pupilR.position.y = 0.62 + lookY;
    }
    if (mouth) {
      mouth.scale.x = mouthBaseScaleX * (1 + expression * 0.08);
      mouth.scale.y = mouthBaseScaleY * (1 + expression * 0.18);
      mouth.position.y = mouthBaseY + expression * 0.009;
    }

    renderer.render(scene, camera);
    animationFrameId = requestAnimationFrame(tick);
  }

  function syncAnimation() {
    if (shouldAnimate()) {
      if (animationFrameId === null) animationFrameId = requestAnimationFrame(tick);
    } else if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  if (lobby) {
    new MutationObserver(syncAnimation).observe(lobby, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }
  document.addEventListener('visibilitychange', syncAnimation);
  syncAnimation();
}
