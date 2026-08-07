// ============================================================
// STORAGE — localStorage: best time + reduced effects
// ============================================================
const STORAGE_KEY_TIME   = 'voxelgobblin_bestTime';
const STORAGE_KEY_LEVEL  = 'voxelgobblin_bestLevel';
const STORAGE_KEY_ACCESS = 'voxelgobblin_reducedEffects';

export function loadBestTime() {
  try {
    const v = localStorage.getItem(STORAGE_KEY_TIME);
    return v ? parseFloat(v) : null;
  } catch (e) { return null; }
}

export function saveBestTime(t) {
  try { localStorage.setItem(STORAGE_KEY_TIME, String(t)); } catch (e) {}
}

export function clearBestTime() {
  try { localStorage.removeItem(STORAGE_KEY_TIME); } catch (e) {}
}

export function loadBestLevel() {
  try {
    const v = localStorage.getItem(STORAGE_KEY_LEVEL);
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  } catch (e) { return null; }
}

export function saveBestLevel(level) {
  try {
    const curr = loadBestLevel();
    if (curr == null || level > curr) localStorage.setItem(STORAGE_KEY_LEVEL, String(level));
  } catch (e) {}
}

export function updateBestBadge(bump = false) {
  const t = loadBestLevel();
  document.getElementById('bestTime').textContent =
    t == null ? '—' : String(t);
  if (bump) {
    const badge = document.getElementById('bestBadge');
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
    setTimeout(() => badge.classList.remove('bump'), 600);
  }
}

export function loadReducedEffects() {
  try { return localStorage.getItem(STORAGE_KEY_ACCESS) === '1'; } catch (e) { return false; }
}

export function saveReducedEffects(v) {
  try { localStorage.setItem(STORAGE_KEY_ACCESS, v ? '1' : '0'); } catch (e) {}
}
