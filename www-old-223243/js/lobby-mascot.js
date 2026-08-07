import * as THREE from 'three';
import { buildGoblin, buildSlime } from './builders.js';

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
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  camera.position.set(0, 0.9, 4.2);
  camera.lookAt(0, 0.28, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xffefc2, 1.1);
  key.position.set(-1.8, 2.8, 2.6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x78c8ff, 0.7);
  rim.position.set(2.4, 1.8, -1.5);
  scene.add(rim);

  function isolateMaterials(group) {
    group.traverse((object) => {
      if (!object.isMesh) return;
      object.material = object.material.clone();
      object.material.transparent = true;
      object.material.opacity = 1;
    });
  }

  const goblin = buildGoblin();
  isolateMaterials(goblin);
  goblin.position.set(-0.58, -0.28, 0.3);
  goblin.scale.setScalar(1.45);
  scene.add(goblin);

  const slime = buildSlime();
  isolateMaterials(slime);
  slime.position.set(0.92, -0.25, -0.42);
  slime.scale.setScalar(1.12);
  scene.add(slime);

  const [, , , pupilL, pupilR, mouth] = goblin.children;
  const mouthBaseY = mouth ? mouth.position.y : 0.4;
  const mouthBaseScaleX = mouth ? mouth.scale.x : 1;
  const mouthBaseScaleY = mouth ? mouth.scale.y : 1;
  const goblinBaseScale = 1.45;
  const slimeBaseScale = 1.12;
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

    goblin.rotation.y = -0.1 + Math.sin(elapsed * 1.15) * 0.16 * ramp;
    goblin.position.y = -0.28 + Math.sin(elapsed * 2.7) * 0.045 * ramp;
    goblin.scale.setScalar(goblinBaseScale);

    const slimeWobble = Math.sin(elapsed * 3.2) * 0.055 * ramp;
    slime.position.x = 0.92 + Math.sin(elapsed * 1.1) * 0.045 * ramp;
    slime.position.y = -0.25 + Math.sin(elapsed * 2.25 + 1) * 0.035 * ramp;
    slime.rotation.y = 0.13 + Math.sin(elapsed * 0.9) * 0.1 * ramp;
    slime.scale.set(
      slimeBaseScale * (1 + slimeWobble),
      slimeBaseScale * (1 - slimeWobble * 0.7),
      slimeBaseScale * (1 + slimeWobble)
    );

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
