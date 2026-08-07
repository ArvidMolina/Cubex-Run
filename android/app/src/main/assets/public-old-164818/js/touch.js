// ============================================================
// TOUCH — joystick virtual para móvil
// ============================================================
import { setVirtualAction } from './input.js';

const DEAD = 18;  // px — radio mínimo para activar dirección
const MAX  = 56;  // px — radio máximo del knob

// Crear elementos del joystick y añadirlos al #wrap
const wrap = document.getElementById('wrap');

const base = document.createElement('div');
base.id = 'joy-base';
base.innerHTML = '<div id="joy-knob"></div>';
wrap.appendChild(base);

const knob = document.getElementById('joy-knob');

let active  = false;
let trackId = null;
let centerX = 0, centerY = 0;
let wrapLeft = 0, wrapTop = 0;

function clearDirs() {
  setVirtualAction('moveUp',    false);
  setVirtualAction('moveDown',  false);
  setVirtualAction('moveLeft',  false);
  setVirtualAction('moveRight', false);
}

function applyDir(dx, dy) {
  const dist = Math.hypot(dx, dy);
  if (dist < DEAD) { clearDirs(); return; }
  // Eje dominante: sin diagonales (mejor para mazmorras)
  if (Math.abs(dx) >= Math.abs(dy)) {
    setVirtualAction('moveLeft',  dx < 0);
    setVirtualAction('moveRight', dx > 0);
    setVirtualAction('moveUp',    false);
    setVirtualAction('moveDown',  false);
  } else {
    setVirtualAction('moveUp',    dy < 0);
    setVirtualAction('moveDown',  dy > 0);
    setVirtualAction('moveLeft',  false);
    setVirtualAction('moveRight', false);
  }
}

function moveKnob(dx, dy) {
  const dist = Math.hypot(dx, dy);
  const s    = Math.min(1, MAX / Math.max(1, dist));
  knob.style.transform = `translate(${(dx * s).toFixed(1)}px,${(dy * s).toFixed(1)}px)`;
}

function isGameUI(el) {
  return el.tagName === 'BUTTON' || !!el.closest('.overlay, .lobby');
}

wrap.addEventListener('touchstart', e => {
  if (active) return;
  const t = e.changedTouches[0];
  if (isGameUI(e.target)) return;   // dejar que botones de UI funcionen
  trackId = t.identifier;
  const rect = wrap.getBoundingClientRect();
  wrapLeft = rect.left;
  wrapTop = rect.top;
  centerX = t.clientX - rect.left;
  centerY = t.clientY - rect.top;
  // Centrar el joystick donde toca el usuario
  base.style.left    = (centerX - 56) + 'px';
  base.style.top     = (centerY - 56) + 'px';
  base.style.display = 'block';
  knob.style.transform = '';
  active = true;
  e.preventDefault();
}, { passive: false });

wrap.addEventListener('touchmove', e => {
  if (!active) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== trackId) continue;
    const dx = (t.clientX - wrapLeft) - centerX;
    const dy = (t.clientY - wrapTop) - centerY;
    moveKnob(dx, dy);
    applyDir(dx, dy);
    break;
  }
  e.preventDefault();
}, { passive: false });

function endTouch(e) {
  if (!active) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== trackId) continue;
    active    = false;
    trackId   = null;
    base.style.display   = 'none';
    knob.style.transform = '';
    clearDirs();
    break;
  }
}

wrap.addEventListener('touchend',    endTouch, { passive: false });
wrap.addEventListener('touchcancel', endTouch, { passive: false });
