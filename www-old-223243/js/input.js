// ============================================================
// INPUT — action mapping + input buffering
// ============================================================
// Acción abstracta: el gameplay lee acciones, NUNCA teclas directas.
// Buffering: pulsaciones guardadas 200ms para tolerar hit-stops.
export const ACTIONS = {
  moveUp:    { keys: ['w', 'ArrowUp'] },
  moveDown:  { keys: ['s', 'ArrowDown'] },
  moveLeft:  { keys: ['a', 'ArrowLeft'] },
  moveRight: { keys: ['d', 'ArrowRight'] },
};
export const BUFFER_MS = 200;

export const _pressedAt = {
  moveUp:    -Infinity,
  moveDown:  -Infinity,
  moveLeft:  -Infinity,
  moveRight: -Infinity,
};

export const keys = {
  w: false, a: false, s: false, d: false,
  ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
};

// Acciones virtuales (joystick táctil)
export const virtualKeys = { moveUp: false, moveDown: false, moveLeft: false, moveRight: false };

export function setVirtualAction(action, value) {
  if (!(action in virtualKeys)) return;
  if (value && !virtualKeys[action]) _pressedAt[action] = performance.now();
  virtualKeys[action] = value;
}

export function isActionHeld(action) {
  const def = ACTIONS[action];
  if (!def) return false;
  return def.keys.some(k => keys[k]) || !!virtualKeys[action];
}

export function wasActionPressedRecently(action, windowMs = BUFFER_MS, now = performance.now()) {
  return (now - _pressedAt[action]) < windowMs;
}

// Retorna true si la acción está activa (held o en buffer) y consume el buffer.
export function tryConsumeAction(action, now = performance.now()) {
  if (!ACTIONS[action]) return false;
  if (isActionHeld(action)) return true;
  if (wasActionPressedRecently(action, BUFFER_MS, now)) {
    _pressedAt[action] = -Infinity;
    return true;
  }
  return false;
}

export function resetInput() {
  for (const k in keys) keys[k] = false;
  for (const a in _pressedAt) _pressedAt[a] = -Infinity;
  for (const a in virtualKeys) virtualKeys[a] = false;
}

window.addEventListener('keydown', e => {
  if (e.key in keys) {
    if (!keys[e.key]) {
      for (const [action, def] of Object.entries(ACTIONS)) {
        if (def.keys.includes(e.key)) _pressedAt[action] = performance.now();
      }
    }
    keys[e.key] = true;
    e.preventDefault();
  }
});

window.addEventListener('keyup', e => {
  if (e.key in keys) { keys[e.key] = false; e.preventDefault(); }
});
