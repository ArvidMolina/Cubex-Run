const canvas = document.getElementById('game');

// ============================================================
// JUICY — trauma, hit-stop, screen flash + estado de accesibilidad
// ============================================================

// -- Accesibilidad --
export let reducedEffects = false;
export function setReducedEffects(v) { reducedEffects = v; }

// -- Trauma (camera shake) --
let trauma = 0;
let shakeApplied = false;

export function addTrauma(amount) {
  const a = reducedEffects ? amount * 0.5 : amount;
  trauma = Math.min(1, trauma + Math.max(0, a));
}
export function getTrauma() { return trauma; }
export function resetTrauma() {
  trauma = 0;
  clearShake();
}
export function decayTrauma(dt) {
  if (trauma > 0) trauma = Math.max(0, trauma - 1.5 * dt);
}
export function applyShake() {
  if (trauma <= 0) {
    clearShake();
    return;
  }
  const s = trauma * trauma;
  const t = performance.now() * 0.05;
  const dx = Math.sin(t * 1.7) * 5 * s;
  const dy = Math.cos(t * 2.3) * 5 * s;
  canvas.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
  shakeApplied = true;
}

export function clearShake() {
  if (!shakeApplied && !canvas.style.transform) return;
  canvas.style.transform = '';
  shakeApplied = false;
}

// -- Hit-stop --
let hitStopRemaining = 0;

export function hitStop(ms) {
  hitStopRemaining = Math.max(hitStopRemaining, ms / 1000);
}
export function consumeHitStop(dt) {
  if (hitStopRemaining > 0) {
    hitStopRemaining = Math.max(0, hitStopRemaining - dt);
    return true;
  }
  return false;
}
export function getHitStopRemaining() { return hitStopRemaining; }
export function resetHitStop() { hitStopRemaining = 0; }

// -- Screen flash --
const flashEl = document.getElementById('flash');
let flashTimer = 0;
let flashColor = '';

export function screenFlash(color, duration = 0.18) {
  if (!flashEl) return;
  const dur = reducedEffects ? duration * 0.5 : duration;
  flashEl.style.background = color;
  flashEl.classList.remove('fire');
  void flashEl.offsetWidth;
  flashEl.classList.add('fire');
  flashColor = color;
  flashTimer = dur;
}
export function updateFlash(dt) {
  if (flashTimer > 0) {
    flashTimer = Math.max(0, flashTimer - dt);
    if (flashTimer <= 0) {
      flashEl.classList.remove('fire');
      flashColor = '';
    }
  }
}
export function resetFlash() {
  flashColor = '';
  flashTimer = 0;
  if (flashEl) flashEl.classList.remove('fire');
}
export function isFlashFiring() { return !!(flashEl && flashEl.classList.contains('fire')); }
export function getFlashColor() { return flashColor; }
