import { cfg } from './config.js';
import { audioState, ensureAudio, playClick } from './audio.js';
import { reducedEffects, setReducedEffects } from './juicy.js';
import { loadBestLevel, loadReducedEffects, saveReducedEffects } from './storage.js';
import { loadGame } from './game-loader.js';

// ============================================================
// LOBBY — tap-to-start, sin selección de dificultad
// ============================================================
const lobbyEl      = document.getElementById('lobby');
const audioBtn     = document.getElementById('audioToggle');
const optionsPanel = document.getElementById('optionsPanel');
const optionsBtn   = document.getElementById('optionsToggle');

export function updateLobbyBest() {
  const t = loadBestLevel();
  const el = document.getElementById('lobbyBest');
  if (el) el.textContent = t == null ? 'Nivel 1' : `Nivel ${t}`;
}

export function applyReducedEffects() {
  document.body.classList.toggle('reduced-effects', reducedEffects);
  const btn = document.getElementById('accessToggle');
  btn.textContent = reducedEffects ? '♿ Reducido' : '♿ Efectos';
  btn.classList.toggle('muted', reducedEffects);
}

// Inicializar preferencias guardadas
setReducedEffects(loadReducedEffects());
updateLobbyBest();
applyReducedEffects();

// ---- Botón ⚙️ Opciones ----
optionsBtn.addEventListener('click', () => {
  const isOpen = optionsPanel.classList.toggle('open');
  optionsBtn.setAttribute('aria-expanded', String(isOpen));
  playClick();
});

async function startGame(withSound) {
  // Guard: si no estamos en lobby, no hacer nada. Usa state.phase (vía loadGame)
  // para que volver al lobby desde returnToLobby() habilite de nuevo el botón.
  const { state: currentState } = await loadGame();
  if (currentState.phase !== 'lobby') return;
  if (withSound) {
    ensureAudio();
    playClick();
  }
  try {
    const { resetMaze, state, getDifficultyParams } = await loadGame();
    resetMaze();
    const diff = getDifficultyParams(state.level);
    state.slimeSpawnAt = performance.now() + diff.spawnDelayMs;
    state.startTime = performance.now();
    optionsPanel.classList.remove('open');
    optionsBtn.setAttribute('aria-expanded', 'false');
    lobbyEl.classList.add('hide');
  } catch (error) {
    throw error;
  }
}

// ---- Botón TOCA PARA EMPEZAR ----
document.getElementById('playBtn').addEventListener('click', () => startGame(true));

// ---- Audio toggle ----
audioBtn.addEventListener('click', () => {
  audioState.enabled = !audioState.enabled;
  audioBtn.classList.toggle('muted', !audioState.enabled);
  audioBtn.textContent = audioState.enabled ? '🔊 Audio' : '🔇 Mute';
  if (audioState.enabled) playClick();
});

// ---- Accessibility toggle ----
document.getElementById('accessToggle').addEventListener('click', () => {
  setReducedEffects(!reducedEffects);
  saveReducedEffects(reducedEffects);
  applyReducedEffects();
  playClick();
});

// ---- URL param: ?autoplay=1 ----
if (new URLSearchParams(location.search).get('autoplay') === '1') {
  startGame(false);
}
