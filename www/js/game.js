import { cfg, getDifficultyParams } from './config.js';
import { grid, generateMaze, bfsNextStepAndDistance, bfsDistance } from './maze.js';
import { renderer, scene, camera, canvas } from './renderer.js';
import { mat, applyTheme } from './materials.js';
import { buildGoblin, buildSlime, buildExit } from './builders.js';
import {
  world, cellToWorld, worldToCellInto, cellMeshes,
  buildMazeMeshes, clearWorld, updateFog,
} from './world.js';
import {
  playWin, playLose, playStep,
  playWallHit, playHeartbeat, playThudMini, heartbeatInterval,
  startTensionMusic, updateTensionMusic, stopTensionMusic,
} from './audio.js';
import { loadBestTime, saveBestTime, loadBestLevel, saveBestLevel, updateBestBadge } from './storage.js';
import {
  particles, spawnCondensation, spawnStepDust, spawnWallHitSparks,
  spawnConfetti, spawnLoseSplash, updateParticles, clearParticles,
} from './particles.js';
import {
  addTrauma, decayTrauma, applyShake, clearShake,
  hitStop, consumeHitStop,
  screenFlash, updateFlash,
} from './juicy.js';
import {
  tryConsumeAction, resetInput,
} from './input.js';
import {
  moveEntity,
  updateHop, resetHop, BASE_Y,
  updateFacing, resetFacing,
  updateKnockback, triggerKnockback, getKnockbackRemaining, resetKnockback,
  updateCameraFollow, setCameraTarget, setCameraLook, getCameraTarget,
} from './movement.js';

// ============================================================
// ESTADO DE JUEGO
// ============================================================
export const state = {
  phase: 'lobby',
  level: 1,
  startTime: 0,          // para medir tiempo transcurrido (win/lose screens)
  slime: null,
  slimeAlive: false,
  slimeAppearTime: 0,
  slimeSpawnAt: 0,       // timestamp (ms) en que el slime debe aparecer
  slimeDistToPlayer: Infinity,  // BFS cells, actualizado en cada repath
  enemyTarget: null,
  enemyTargetX: 0,
  enemyTargetZ: 0,
  lastRepath: 0,
  lastAudioUpdate: 0,
  nextHeartbeatAt: 0,
  slimeOpacity: 0,
  distToExit: 0,
  initialDistToExit: 0,
  activeEnemySpeed: 2.5,
  activeFadeInS: 1.2,
  activeSpawnDelayMs: 500,
};

export let player   = null;
export let exitMesh = null;

// Valores del hop calculados en tick() (accesibles para hooks)
export let hopY = BASE_Y;
export let hopScaleX = 1, hopScaleY = 1, hopScaleZ = 1;

// Dirección de movimiento del player (para cámara)
let playerDx = 0, playerDz = 0;
let playerSpeedNow = 0;
let exitWorldX = 0, exitWorldZ = 0;
let lastWallFeedbackAt = -Infinity;
let dangerVisualActive = false;
let lastHudText = '';
let lastHudStatus = '';
const playerCell = { r: 0, c: 0 };
const slimeCell = { r: 0, c: 0 };
const enemyCell = { r: 0, c: 0 };
const distBadgeEl = document.getElementById('distBadge');
const slimeDistEl = document.getElementById('slimeDist');
const runTimeEl       = document.getElementById('runTime');
const hudTimerEl      = document.getElementById('hudTimer');
const ringProgressEl  = document.getElementById('ringProgress');
const exitFillEl      = document.getElementById('exitFill');
const RING_CIRCUMFERENCE = 2 * Math.PI * 46;  // r=46 en el SVG, ≈ 289.03

// Formatea segundos como M:SS (1 dígito de minuto, 2 de segundos)
function formatRunTime(seconds) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

let lastHudTimerStatus = '';
let lastRunTimeText    = '';
let lastExitPct        = -1;

function updateSlimeHud(dist) {
  const text = isFinite(dist) ? String(dist) : (state.slimeAlive ? '…' : '—');
  let status = '';
  if (isFinite(dist)) {
    if (dist <= 2) status = 'critical';
    else if (dist <= 4) status = 'danger';
    else if (dist <= 7) status = 'warn';
  }
  if (text !== lastHudText) {
    slimeDistEl.textContent = text;
    lastHudText = text;
  }
  if (status !== lastHudStatus) {
    distBadgeEl.classList.remove('warn', 'danger', 'critical');
    if (status) distBadgeEl.classList.add(status);
    lastHudStatus = status;
  }
  // El timer central también reacciona: solo danger/critical (warn se ve igual)
  const tStatus = (status === 'critical' || status === 'danger') ? status : '';
  if (tStatus !== lastHudTimerStatus) {
    hudTimerEl.classList.remove('danger', 'critical');
    if (tStatus) hudTimerEl.classList.add(tStatus);
    lastHudTimerStatus = tStatus;
  }
}

// Actualiza el runTime en formato M:SS (sólo escribe si cambia el string)
function updateRunTime(now) {
  const seconds = (now - state.startTime) / 1000;
  const txt = formatRunTime(seconds);
  if (txt !== lastRunTimeText) {
    runTimeEl.textContent = txt;
    lastRunTimeText = txt;
  }
}

// Actualiza la barra de progreso a la salida.
// progress = 0 al spawn, 1 al llegar.
function updateExitProgress() {
  let pct = 0;
  if (state.initialDistToExit > 0) {
    worldToCellInto(player.position.x, player.position.z, playerCell);
    const current = bfsDistance(playerCell.r, playerCell.c, cfg.ROWS - 2, cfg.COLS - 2);
    if (isFinite(current)) {
      pct = (state.initialDistToExit - current) / state.initialDistToExit;
      pct = Math.max(0, Math.min(1, pct));
    }
  }
  // El anillo del timer también refleja el progreso
  if (ringProgressEl) {
    ringProgressEl.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - pct));
  }
  if (exitFillEl) {
    const pctInt = Math.round(pct * 100);
    if (pctInt !== lastExitPct) {
      exitFillEl.style.width = `${pctInt}%`;
      lastExitPct = pctInt;
    }
  }
}

function setDangerVisual(active) {
  if (dangerVisualActive === active) return;
  dangerVisualActive = active;
  canvas.classList.toggle('shake', active);
  mat.skin.color.setHex(active ? 0xc93a3a : 0x6fa83a);
  mat.skinDk.color.setHex(active ? 0x8a2222 : 0x4a7a22);
}

// ============================================================
// RESET / RETRY
// ============================================================
export function resetMaze() {
  clearWorld();
  clearParticles();

  const diff = getDifficultyParams(state.level);
  state.activeEnemySpeed   = diff.enemySpeed;
  state.activeFadeInS      = diff.fadeInS;
  state.activeSpawnDelayMs = diff.spawnDelayMs;

  generateMaze(diff.extraCarveCount);
  buildMazeMeshes();
  applyTheme(state.level);

  // Registrar nivel alcanzado
  saveBestLevel(state.level);
  updateBestBadge();
  const levelEl = document.getElementById('level');
  if (levelEl) levelEl.textContent = String(state.level);

  player = buildGoblin();
  const pStart = cellToWorld(1, 1);
  player.position.set(pStart.x, 0, pStart.z);
  world.add(player);

  state.slime      = null;
  state.slimeAlive = false;

  exitMesh = buildExit();
  const xPos = cellToWorld(cfg.ROWS - 2, cfg.COLS - 2);
  exitMesh.position.set(xPos.x, 0, xPos.z);
  exitWorldX = xPos.x;
  exitWorldZ = xPos.z;
  world.add(exitMesh);

  // Cámara: arrancar sobre el spawn del jugador
  setCameraTarget(pStart.x, pStart.z + 10);
  setCameraLook(pStart.x, pStart.z);
  const ct = getCameraTarget();
  camera.position.set(ct.x, cfg.CAM_BASE_Y, ct.z);
  camera.lookAt(pStart.x, 0, pStart.z);

  // Estado
  state.phase              = 'playing';
  state.startTime          = performance.now();
  state.slimeSpawnAt       = Infinity;   // activado por lobby.js o retrySameMaze
  state.slimeDistToPlayer  = Infinity;
  state.enemyTarget        = null;
  state.lastRepath         = 0;
  state.lastAudioUpdate    = 0;
  state.nextHeartbeatAt    = 0;
  state.slimeOpacity       = 0;
  state.distToExit         = 0;
  state.initialDistToExit  = bfsDistance(1, 1, cfg.ROWS - 2, cfg.COLS - 2);
  lastWallFeedbackAt       = -Infinity;
  lastRunTimeText          = '';
  lastExitPct              = -1;

  document.getElementById('lose').classList.remove('show');
  document.getElementById('win').classList.remove('show');

  // Reset materiales
  mat.slime.opacity     = 0;
  mat.slimeDk.opacity   = 0;
  mat.slimeEye.opacity  = 0;
  mat.slimeEyeB.opacity = 0;
  mat.skin.color.setHex(0x6fa83a);
  mat.skinDk.color.setHex(0x4a7a22);

  setDangerVisual(false);
  stopTensionMusic();
  resetHop();
  resetKnockback();
  resetFacing(player);
  updateSlimeHud(Infinity);
  if (hudTimerEl) hudTimerEl.classList.remove('danger', 'critical');
  startLoop();
}

export function retrySameMaze() {
  clearParticles();

  if (state.slime) {
    world.remove(state.slime);
    state.slime      = null;
    state.slimeAlive = false;
  }

  const diff = getDifficultyParams(state.level);
  state.activeEnemySpeed   = diff.enemySpeed;
  state.activeFadeInS      = diff.fadeInS;
  state.activeSpawnDelayMs = diff.spawnDelayMs;

  const pStart = cellToWorld(1, 1);
  player.position.set(pStart.x, 0, pStart.z);

  state.phase              = 'playing';
  state.startTime          = performance.now();
  state.slimeSpawnAt       = performance.now() + diff.spawnDelayMs;
  state.slimeDistToPlayer  = Infinity;
  state.enemyTarget        = null;
  state.lastRepath         = 0;
  state.lastAudioUpdate    = 0;
  state.nextHeartbeatAt    = 0;
  state.slimeOpacity       = 0;
  state.distToExit         = 0;
  state.initialDistToExit  = bfsDistance(1, 1, cfg.ROWS - 2, cfg.COLS - 2);
  lastWallFeedbackAt       = -Infinity;
  lastRunTimeText          = '';
  lastExitPct              = -1;

  mat.slime.opacity     = 0;
  mat.slimeDk.opacity   = 0;
  mat.slimeEye.opacity  = 0;
  mat.slimeEyeB.opacity = 0;
  mat.skin.color.setHex(0x6fa83a);
  mat.skinDk.color.setHex(0x4a7a22);

  setCameraTarget(pStart.x, pStart.z + 10);
  setCameraLook(pStart.x, pStart.z);
  const ct = getCameraTarget();
  camera.position.set(ct.x, cfg.CAM_BASE_Y, ct.z);
  camera.lookAt(pStart.x, 0, pStart.z);

  setDangerVisual(false);
  stopTensionMusic();
  resetHop();
  resetKnockback();
  resetFacing(player);
  updateSlimeHud(Infinity);
  if (hudTimerEl) hudTimerEl.classList.remove('danger', 'critical');

  document.getElementById('lose').classList.remove('show');
  document.getElementById('win').classList.remove('show');
  startLoop();
}

// ============================================================
// SPAWN SLIME
// ============================================================

// Constantes del spawn. MIN_BFS_DIST es la distancia BFS mínima deseable desde
// el spawn del player. Si el maze no permite esa distancia (laberintos muy
// estrechos), se aplica FALLBACK_DELAY_MS extra de head start al jugador.
const SLIME_MIN_BFS_DIST     = 7;
const SLIME_FALLBACK_DELAY_MS = 1500;

// Encuentra la celda walkable cuya distancia BFS desde el spawn del player (1,1)
// sea la mayor. BFS respeta paredes; Manhattan puede elegir celdas con pasillo
// corto y poner al slime casi encima del jugador. Se descartan también celdas a
// <5 Manhattan de la salida (la victoria no debe estar comprometida desde el
// spawn) y las celdas del propio player o de la salida.
export function pickSlimeSpawnCell() {
  const { ROWS, COLS } = cfg;
  const playerR = 1, playerC = 1;
  const exitR = ROWS - 2, exitC = COLS - 2;
  let bestR = 1, bestC = 1, bestD = -1;
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (r === playerR && c === playerC) continue;
      if (r === exitR && c === exitC) continue;
      if (grid[r][c] !== 0) continue;
      const dExit = Math.abs(r - exitR) + Math.abs(c - exitC);
      if (dExit < 5) continue;
      const { distance } = bfsNextStepAndDistance(playerR, playerC, r, c);
      if (!isFinite(distance) || distance < 1) continue;
      if (distance > bestD) { bestD = distance; bestR = r; bestC = c; }
    }
  }
  if (bestD < 0) { bestR = playerR; bestC = playerC; } // maze patológico
  return { r: bestR, c: bestC, bfs: bestD };
}

export function spawnSlime() {
  const { r, c } = pickSlimeSpawnCell();
  const slime = buildSlime();
  const w = cellToWorld(r, c);
  slime.position.set(w.x, 0, w.z);
  world.add(slime);
  state.slime           = slime;
  state.slimeAlive      = true;
  state.slimeAppearTime = performance.now();
  state.slimeOpacity    = 0;

  spawnCondensation(w.x, w.z);
  startTensionMusic();
}

// ============================================================
// PAUSE / RESUME / RETURN TO LOBBY
// ============================================================
// Solo tienen sentido durante 'playing'. Pausa el loop, oculta el HUD, y
// muestra un overlay. returnToLobby limpia el world y deja el canvas en
// estado "sin juego" para que el lobby se vea limpio.

export function pause() {
  if (state.phase !== 'playing') return false;
  state.phase = 'paused';
  // El loop termina solo en el próximo tick: la condición
  //   `state.phase === 'playing' || particles.length > 0 || ...`
  // ya no se cumple, así que no se agenda el siguiente frame.
  document.getElementById('pause')?.classList.add('show');
  return true;
}

export function resume() {
  if (state.phase !== 'paused') return false;
  state.phase = 'playing';
  document.getElementById('pause')?.classList.remove('show');
  // Reanuda el loop (lastT se reajusta en startLoop para evitar un dt gigante).
  startLoop();
  return true;
}

export function togglePause() {
  if (state.phase === 'playing') return pause();
  if (state.phase === 'paused')  return resume();
  return false;
}

export function returnToLobby() {
  // Reset duro: tira el mundo, el slime, el player, las partículas y el HUD de juego.
  // Resetea el level a 1 para evitar confusión: el siguiente "Iniciar" siempre
  // arranca desde el principio. "Nueva" durante juego sigue incrementando.
  state.phase = 'lobby';
  state.slimeAlive = false;
  state.enemyTarget = null;
  state.slimeDistToPlayer = Infinity;
  state.slimeSpawnAt = Infinity;
  state.level = 1;

  // Parar loop
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Ocultar overlays de juego
  document.getElementById('lose')?.classList.remove('show');
  document.getElementById('win')?.classList.remove('show');
  document.getElementById('pause')?.classList.remove('show');

  // Limpiar el mundo: InstancedMesh + player + slime + exit. El canvas queda
  // con el background (verde oscuro) que es lo que se ve detrás del lobby.
  clearWorld();
  clearParticles();
  state.slime = null;
  player = null;
  exitMesh = null;

  // Apagar música y resetear visuales
  stopTensionMusic();
  setDangerVisual(false);
  resetInput();

  // Refrescar HUD: el contador de nivel debe coincidir con state.level = 1.
  const levelEl = document.getElementById('level');
  if (levelEl) levelEl.textContent = '1';

  // Mostrar el lobby
  document.getElementById('lobby')?.classList.remove('hide');
}

// ============================================================
// LOOP PRINCIPAL
// ============================================================
let lastT = performance.now();
let animationFrameId = null;

function startLoop() {
  if (animationFrameId !== null || document.hidden || !player) return;
  lastT = performance.now();
  animationFrameId = requestAnimationFrame(tick);
}

function tick(now) {
  animationFrameId = null;
  try {
    return tickInner(now);
  } catch (err) {
    showGameError(err);
    // Reanotar el siguiente frame para que el juego intente seguir (y muestre más errores si los hay)
    if (state.phase === 'playing' || particles.length > 0 || getKnockbackRemaining() > 0) {
      animationFrameId = requestAnimationFrame(tick);
    }
  }
}

function tickInner(now) {
  const dt  = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  // Sistemas juicy (siempre activos)
  decayTrauma(dt);
  updateFlash(dt);
  if (state.phase === 'playing') {
    applyShake();
  } else {
    clearShake();
  }

  const stopped = consumeHitStop(dt);

  // Knockback corre siempre — incluye animación de muerte (fase lose)
  updateKnockback(dt, player);

  if (state.phase === 'playing' && !stopped) {

    // ---- Input ----
    let dx = 0, dz = 0;
    if (tryConsumeAction('moveUp', now))    dz -= 1;
    if (tryConsumeAction('moveDown', now))  dz += 1;
    if (tryConsumeAction('moveLeft', now))  dx -= 1;
    if (tryConsumeAction('moveRight', now)) dx += 1;
    playerDx = dx; playerDz = dz;

    const mv = moveEntity(player, dx, dz, dt, cfg.PLAYER_SPEED);
    playerSpeedNow = mv.moved ? cfg.PLAYER_SPEED : 0;

    // Choque contra pared
    if (mv.hit && (dx !== 0 || dz !== 0) && now - lastWallFeedbackAt >= 140) {
      lastWallFeedbackAt = now;
      playWallHit();
      spawnWallHitSparks(player.position.x, player.position.z, mv.dx, mv.dz);
      addTrauma(0.15);
    }

    // Hop
    const hop = updateHop(dt, playerSpeedNow);
    hopY = hop.y; hopScaleX = hop.scaleX; hopScaleY = hop.scaleY; hopScaleZ = hop.scaleZ;

    // Facing
    updateFacing(dt, dx, dz, player);

    // Land — pisada + polvo + thud
    if (hop.landed) {
      playStep();
      spawnStepDust(player.position.x, player.position.z, mv.dx || 1, mv.dz || 0);
      playThudMini();
    }

    // ---- Auto-spawn del slime (sin timer, aparece tras el delay inicial) ----
    // Si el maze es estrecho y la celda del slime queda demasiado cerca del
    // player, ampliar el head start para no regalarle la derrota.
    if (!state.slimeAlive && now >= state.slimeSpawnAt) {
      const { bfs } = pickSlimeSpawnCell();
      if (bfs < SLIME_MIN_BFS_DIST) {
        state.slimeSpawnAt = now + SLIME_FALLBACK_DELAY_MS;
      } else {
        spawnSlime();
      }
    }

    // ---- Slime fade-in + persecución ----
    if (state.slimeAlive && state.slime) {
      const fadeInS = state.activeFadeInS || cfg.FADE_IN_S;
      const tFade   = (now - state.slimeAppearTime) / (fadeInS * 1000);
      const op      = Math.min(1, Math.max(0, tFade));
      if (op !== state.slimeOpacity) {
        state.slimeOpacity = op;
        mat.slime.opacity     = op;
        mat.slimeDk.opacity   = op;
        mat.slimeEye.opacity  = op;
        mat.slimeEyeB.opacity = op;
      }

      if (op >= 1) {
        if (now - state.lastRepath > cfg.ENEMY_REPATH_MS) {
          state.lastRepath = now;
          worldToCellInto(state.slime.position.x, state.slime.position.z, enemyCell);
          worldToCellInto(player.position.x, player.position.z, playerCell);
          const path = bfsNextStepAndDistance(
            enemyCell.r, enemyCell.c, playerCell.r, playerCell.c
          );
          state.enemyTarget = path.step;
          state.slimeDistToPlayer = path.distance;
          if (path.step) {
            state.enemyTargetX = path.step[1] - (cfg.COLS - 1) / 2;
            state.enemyTargetZ = path.step[0] - (cfg.ROWS - 1) / 2;
          }
        }
        if (state.enemyTarget) {
          const tdx = state.enemyTargetX - state.slime.position.x;
          const tdz = state.enemyTargetZ - state.slime.position.z;
          const tlen = Math.hypot(tdx, tdz);
          const enemySpeed = state.activeEnemySpeed || cfg.ENEMY_SPEED;
          if (tlen > 0.05) moveEntity(state.slime, tdx / tlen, tdz / tlen, dt, enemySpeed);
        }
      }
    }

    // ---- Colisión player ↔ slime ----
    if (state.slimeAlive && state.slime) {
      worldToCellInto(player.position.x, player.position.z, playerCell);
      worldToCellInto(state.slime.position.x, state.slime.position.z, slimeCell);
      const sameCell = playerCell.r === slimeCell.r && playerCell.c === slimeCell.c;
      const dist = Math.hypot(
        player.position.x - state.slime.position.x,
        player.position.z - state.slime.position.z
      );
      if (dist < 0.75 || sameCell) {
        state.phase = 'lose';
        canvas.classList.remove('shake');
        state.distToExit = bfsDistance(
          playerCell.r, playerCell.c, cfg.ROWS - 2, cfg.COLS - 2
        );
        const distText   = isFinite(state.distToExit) ? state.distToExit : '?';
        const elapsed    = ((now - state.startTime) / 1000).toFixed(1) + 's';
        document.getElementById('loseLevel').textContent    = state.level;
        document.getElementById('loseDistance').textContent = distText;
        document.getElementById('loseElapsed').textContent  = elapsed;

        // Récord personal destacado en la pantalla de derrota
        const prevBestLevel = loadBestLevel();
        const isNewBestLevel = saveBestLevel(state.level);
        updateBestBadge(isNewBestLevel);
        const currentRecord = loadBestLevel() ?? state.level;

        const loseBestBadgeEl = document.getElementById('loseBestBadge');
        const loseBestTextEl  = document.getElementById('loseBestText');
        if (loseBestBadgeEl) {
          if (isNewBestLevel && (prevBestLevel == null || state.level > prevBestLevel)) {
            loseBestBadgeEl.classList.add('new-record');
            if (loseBestTextEl) loseBestTextEl.innerHTML = `🏆 <b>¡NUEVO RÉCORD!</b> Nivel <b id="loseBestLevel">${state.level}</b>`;
          } else {
            loseBestBadgeEl.classList.remove('new-record');
            if (loseBestTextEl) loseBestTextEl.innerHTML = `🏆 Récord personal: Nivel <b id="loseBestLevel">${currentRecord}</b>`;
          }
        }

        playLose();
        stopTensionMusic();
        spawnLoseSplash(player.position.x, player.position.z);
        screenFlash('#e84545', 0.22);
        addTrauma(0.7);
        hitStop(160);
        triggerKnockback(player, state.slime.position.x, state.slime.position.z);
        document.getElementById('lose').classList.add('show');
      }
    }

    // ---- Victoria ----
    if (state.phase === 'playing' &&
        Math.hypot(player.position.x - exitWorldX, player.position.z - exitWorldZ) < 0.6) {
      state.phase = 'win';
      const finalTime = (now - state.startTime) / 1000;
      const prevBest  = loadBestTime();
      const isNewBest = prevBest == null || finalTime < prevBest;
      if (isNewBest) saveBestTime(finalTime);
      
      // Al ganar el nivel actual, el nivel más alto alcanzado es al menos state.level + 1
      const isNewBestLevel = saveBestLevel(state.level + 1);
      updateBestBadge(isNewBestLevel);
      const currentBestLvl = loadBestLevel() ?? (state.level + 1);
      const lobbyBest = document.getElementById('lobbyBest');
      if (lobbyBest) lobbyBest.textContent = `Nivel ${currentBestLvl}`;
      
      document.getElementById('winTime').textContent = finalTime.toFixed(1) + 's';
      document.getElementById('winBest').textContent =
        (isNewBestLevel ? '⭐ ' : '') + 'Nivel ' + String(currentBestLvl);
      document.getElementById('winLevel').textContent = state.level;
      playWin();
      stopTensionMusic();
      spawnConfetti(player.position.x, player.position.z);
      screenFlash('#6fa83a', 0.25);
      addTrauma(0.35);
      hitStop(120);
      document.getElementById('win').classList.add('show');
    }

    // ---- HUD distancia al slime ----
    const sdist = state.slimeAlive ? state.slimeDistToPlayer : Infinity;
    updateSlimeHud(sdist);

    // ---- HUD: runTime + progreso de salida (anillo + barra) ----
    updateRunTime(now);
    updateExitProgress();

    // Heartbeat + música de tensión según distancia al slime
    const interval = heartbeatInterval(sdist);
    if (interval !== Infinity && now >= state.nextHeartbeatAt) {
      playHeartbeat();
      state.nextHeartbeatAt = now + interval * 1000;
    }
    if (now - state.lastAudioUpdate >= 100) {
      state.lastAudioUpdate = now;
      // Usa BFS cuando existe y distancia euclidiana durante el fade inicial.
      let audioDist = sdist;
      if (!isFinite(audioDist) && state.slimeAlive && state.slime) {
        audioDist = Math.hypot(
          player.position.x - state.slime.position.x,
          player.position.z - state.slime.position.z
        ) * 2.2;
      }
      updateTensionMusic(audioDist);
    }

    // Canvas shake + goblin rojo cuando el slime está muy cerca
    setDangerVisual(state.phase === 'playing' && state.slimeAlive && sdist <= 3);

  }  // fin phase === 'playing'

  // Fog of war (siempre, para que la celda bajo el player no se oscurezca)
  updateFog(player);

  // ---- Animaciones ----
  const t = now * 0.005;

  player.position.y = hopY;
  if (getKnockbackRemaining() <= 0) {
    player.scale.set(hopScaleX, hopScaleY, hopScaleZ);
  }

  if (state.slime) {
    const w = Math.sin(t * 2 + 1);
    state.slime.position.y = 0.32 + Math.abs(w) * 0.06;
    if (getKnockbackRemaining() <= 0) {
      state.slime.scale.set(1.0 + w * 0.06, 1.0 - w * 0.06, 1.0 + w * 0.06);
    }
  }

  exitMesh.position.y = Math.sin(t * 1.5) * 0.08;
  exitMesh.rotation.y = t * 0.6;

  // Cámara
  const moving = state.phase === 'playing' && playerSpeedNow > 0;
  updateCameraFollow(dt, player, moving, playerDx, playerDz, camera);

  updateParticles(dt);

  renderer.render(scene, camera);
  if (state.phase === 'playing' || particles.length > 0 || getKnockbackRemaining() > 0) {
    animationFrameId = requestAnimationFrame(tick);
  }
}

// --- DEBUG: muestra errores en pantalla para que no quede un canvas negro silencioso.
let _errorOverlay = null;
let _debugPanel   = null;
function showGameError(err) {
  try {
    if (!_errorOverlay) {
      _errorOverlay = document.createElement('div');
      _errorOverlay.id = 'gameErrorOverlay';
      _errorOverlay.style.cssText = 'position:absolute;left:8px;right:8px;top:60px;bottom:8px;background:rgba(120,20,20,0.92);color:#fff;font:12px/1.4 monospace;padding:12px;border-radius:6px;overflow:auto;z-index:99;white-space:pre-wrap;';
      document.getElementById('wrap')?.appendChild(_errorOverlay);
    }
    _errorOverlay.textContent = '⚠️ ' + (err?.stack || err?.message || String(err));
  } catch { /* noop */ }
  console.error(err);
}
function showDebugPanel() {
  try {
    if (_debugPanel) return;
    _debugPanel = document.createElement('div');
    _debugPanel.id = 'gameDebugPanel';
    _debugPanel.style.cssText = 'position:absolute;left:8px;top:50px;background:rgba(0,0,0,0.85);color:#0f0;font:11px/1.4 monospace;padding:8px;border-radius:4px;z-index:98;max-width:360px;';
    document.getElementById('wrap')?.appendChild(_debugPanel);
    setInterval(updateDebugPanel, 250);
  } catch (e) { showGameError(e); }
}
function updateDebugPanel() {
  try {
    const w = world;
    const inst = w.children.filter(o => o.isInstancedMesh).length;
    const other = w.children.length - inst;
    const cam = camera;
    _debugPanel.textContent = [
      'phase: ' + state.phase,
      'scene.children: ' + scene.children.length,
      'world.children: ' + w.children.length + ' (inst:' + inst + ' other:' + other + ')',
      'player: ' + (player ? `(${player.position.x.toFixed(2)}, ${player.position.z.toFixed(2)})` : 'null'),
      'cam: pos=(' + cam.position.x.toFixed(2) + ',' + cam.position.y.toFixed(2) + ',' + cam.position.z.toFixed(2) + ')',
      'fog r/c: ' + (window.__lastFog || '-'),
      'frames: ' + (window.__frameCount = (window.__frameCount || 0) + 1),
    ].join('\n');
  } catch (e) { /* noop */ }
}
window.addEventListener('error', e => showGameError(e.error || e.message));
window.addEventListener('unhandledrejection', e => showGameError(e.reason));
if (new URLSearchParams(location.search).get('debug') === '1') showDebugPanel();

// ============================================================
// LIFECYCLE — el loop empieza al pulsar jugar y se pausa en background
// ============================================================
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  } else {
    startLoop();
  }
});

renderer.render(scene, camera);
