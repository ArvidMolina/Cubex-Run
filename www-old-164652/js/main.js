import { cfg } from './config.js';
import { updateBestBadge } from './storage.js';
import { loadGame } from './game-loader.js';
import './lobby.js';
import './touch.js';

if (new URLSearchParams(location.search).get('debug') === '1') {
  import('./hooks.js');
}

// ---- Modo captura de icono: ?icon=1 ----
// Solo se usa en /scripts/capture-icon.mjs para tomar el screenshot del
// personaje. NO se usa en producción.
if (new URLSearchParams(location.search).get('icon') === '1') {
  // nada — la captura se hace desde el lobby normal
}

// Mostrar el best time persistido al arrancar
updateBestBadge();

// ---- Botones del HUD ----
async function regen() {
  const { state, resetMaze } = await loadGame();
  state.level++;
  document.getElementById('level').textContent = state.level;
  resetMaze();
  // resetMaze siempre pone slimeSpawnAt=Infinity; activarlo aquí al avanzar nivel
  state.slimeSpawnAt = performance.now() + cfg.SLIME_SPAWN_DELAY_MS;
  state.startTime    = performance.now();
}

document.getElementById('regen').addEventListener('click', regen);
document.getElementById('loseBtn').addEventListener('click', regen);
document.getElementById('winBtn').addEventListener('click', regen);

document.getElementById('retryBtn').addEventListener('click', async () => {
  const { retrySameMaze } = await loadGame();
  retrySameMaze();
});

// ---- Pause / Return to lobby ----
async function returnToLobby() {
  const { returnToLobby: goLobby } = await loadGame();
  goLobby();
}
document.getElementById('resumeBtn').addEventListener('click', async () => {
  const { resume } = await loadGame();
  resume();
});
document.getElementById('pauseLobbyBtn').addEventListener('click', returnToLobby);
document.getElementById('loseLobbyBtn').addEventListener('click', returnToLobby);
document.getElementById('winLobbyBtn').addEventListener('click', returnToLobby);

// Teclado: Esc o P para alternar pausa
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' && e.key !== 'p' && e.key !== 'P') return;
  loadGame().then(({ togglePause }) => togglePause());
});

// ---- Compartir ----
function doShare(text, btn) {
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).then(() => {
      btn.textContent = '✅';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = '📋'; btn.classList.remove('copied'); }, 1500);
    }).catch(() => {
      btn.textContent = '❌';
      setTimeout(() => { btn.textContent = '📋'; }, 1500);
    });
  }
}

document.getElementById('shareLoseBtn').addEventListener('click', async (e) => {
  const { state } = await loadGame();
  const dist   = document.getElementById('loseDistance').textContent;
  const elapsed = document.getElementById('loseElapsed').textContent;
  const text = `💀 Cubex Run\nNivel ${state.level} — ¡Morí a ${dist} pasos de la salida!\n⏱ ${elapsed} sobrevivido\njuega en: ${window.location.href}`;
  doShare(text, e.currentTarget);
});

document.getElementById('shareWinBtn').addEventListener('click', async (e) => {
  const { state } = await loadGame();
  const time = document.getElementById('winTime').textContent;
  const best = document.getElementById('winBest').textContent;
  const text = `🏆 Cubex Run\nNivel ${state.level} — ¡Escapé en ${time}!\n⭐ Mejor: ${best}\njuega en: ${window.location.href}`;
  doShare(text, e.currentTarget);
});
