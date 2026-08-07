import { cfg } from './config.js';
import { grid, isWall, bfsStep, seedRng, resetRng, getCurrentSeed } from './maze.js';
import { camera, renderer } from './renderer.js';
import { mat } from './materials.js';
import { cellMeshes, worldToCell, cellToWorld } from './world.js';
import { audioState, playWallHit, playWin, playLose, playStep } from './audio.js';
import { loadBestTime, saveBestTime, loadBestLevel, saveBestLevel, updateBestBadge, clearBestTime } from './storage.js';
import {
  PARTICLE_GEO, particles, getParticlePoolSize,
  spawnWallHitSparks, spawnStepDust, spawnConfetti, spawnLoseSplash,
} from './particles.js';
import {
  addTrauma, getTrauma, getHitStopRemaining, hitStop,
  isFlashFiring, getFlashColor, screenFlash,
  reducedEffects, setReducedEffects as _setReducedEffects,
  resetTrauma, resetHitStop, resetFlash,
} from './juicy.js';
import { ACTIONS, BUFFER_MS, isActionHeld, wasActionPressedRecently, tryConsumeAction, _pressedAt, resetInput } from './input.js';
import {
  getKnockbackRemaining, getKnockbackState, triggerKnockback,
  getCurrentYaw, getTargetYaw, forceFacing,
  getHopState, resetFacing,
  getCameraTarget,
} from './movement.js';
import { saveReducedEffects } from './storage.js';
import { applyReducedEffects, updateLobbyBest } from './lobby.js';
import {
  state, player, exitMesh,
  hopY, hopScaleX, hopScaleY, hopScaleZ,
  resetMaze, retrySameMaze, spawnSlime,
  pickSlimeSpawnCell,
  pause, resume, togglePause, returnToLobby,
} from './game.js';
import { world } from './world.js';

// ============================================================
// HOOK DE TESTS — window.__maze2
// ============================================================
window.__maze2 = {
  state,
  get player()   { return player; },
  get exitMesh() { return exitMesh; },
  get grid()     { return grid; },
  get COLS()     { return cfg.COLS; },
  get ROWS()     { return cfg.ROWS; },
  get FOG_RADIUS()    { return cfg.FOG_RADIUS; },
  get ENEMY_SPEED()   { return cfg.ENEMY_SPEED; },
  get FADE_IN_S()     { return cfg.FADE_IN_S; },
  getMode: () => cfg.currentMode,
  getSlime:      () => state.slime,
  getPlayerCell: () => worldToCell(player.position.x, player.position.z),
  getSlimeCell:  () => state.slime ? worldToCell(state.slime.position.x, state.slime.position.z) : null,
  getExitCell:   () => ({ r: cfg.ROWS - 2, c: cfg.COLS - 2 }),
  getPhase:      () => state.phase,
  isWall, bfsStep,

  forceSlimeSpawn() { if (!state.slimeAlive) spawnSlime(); },
  forceSlimeFadeDone() {
    if (state.slime) {
      mat.slime.opacity    = 1;
      mat.slimeDk.opacity  = 1;
      mat.slimeEye.opacity = 1;
      mat.slimeEyeB.opacity = 1;
      state.slimeAppearTime = performance.now() - cfg.FADE_IN_S * 1000 - 100;
    }
  },
  forceSlimeSpawnNow() { state.slimeSpawnAt = 0; },
  forceTimeAlmostUp()  { state.slimeSpawnAt = 0; },   // compat: fuerza spawn inmediato
  forceTimeUp()        { state.slimeSpawnAt = 0; },   // compat

  countVisibleCells() {
    let count = 0;
    for (let r = 0; r < cfg.ROWS; r++) {
      for (let c = 0; c < cfg.COLS; c++) {
        const cell = cellMeshes[r][c];
        if (!cell) continue;
        if (cell.floor && cell.floor.visible) count++;
        for (const w of cell.walls) if (w.visible) count++;
      }
    }
    return count;
  },

  reset() {
    state.level = 1;
    document.getElementById('level').textContent = 1;
    resetMaze();
    resetHitStop();
    resetTrauma();
    resetFlash();
    resetInput();
    resetFacing(player);
  },
  retry: () => retrySameMaze(),

  getBestTime:   loadBestTime,
  clearBestTime: () => { clearBestTime(); updateBestBadge(); },
  particlesCount: () => particles.length,

  getSlimeDist:    () => state.slimeDistToPlayer,
  isTimerCritical: () => isFinite(state.slimeDistToPlayer) && state.slimeDistToPlayer <= 2,

  // JUICY
  getTrauma,
  addTrauma,
  getHitStopRemaining,
  isFlashFiring,
  getFlashColor,
  isFlashWhite: () => isFlashFiring() && /255,\s*255,\s*255|#fff/i.test(getFlashColor()),
  isFlashRed:   () => isFlashFiring() && /e84545/i.test(getFlashColor()),
  isFlashGreen: () => isFlashFiring() && /6fa83a/i.test(getFlashColor()),

  getPlayerScale:    () => player ? { x: player.scale.x, y: player.scale.y, z: player.scale.z } : null,
  getCanvasTransform: () => document.getElementById('game').style.transform || '',

  forceScreenFlash: (color, dur) => screenFlash(color, dur),
  forceHitStop:     (ms) => hitStop(ms),

  simulateWallHit() {
    playWallHit();
    spawnWallHitSparks(player.position.x, player.position.z, 1, 0);
    addTrauma(0.15);
  },
  simulateStep() {
    playStep();
    spawnStepDust(player.position.x, player.position.z, 1, 0);
  },

  // HOP
  get hopY()      { return hopY; },
  get hopScaleX() { return hopScaleX; },
  get hopScaleY() { return hopScaleY; },
  get hopScaleZ() { return hopScaleZ; },
  getHop() {
    const s = getHopState();
    return { phase: s.phase, dist: s.dist, landSquash: s.landSquash, y: hopY, scaleX: hopScaleX, scaleY: hopScaleY, scaleZ: hopScaleZ };
  },

  // KNOCKBACK
  getKnockback:    () => getKnockbackState(),
  triggerKnockback: (fromX, fromZ) => triggerKnockback(player, fromX, fromZ),

  // CAMERA
  getCamera:       () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
  getCameraTarget: () => getCameraTarget(),

  // SLIME WOBBLE
  getSlimeScale: () => state.slime ? { x: state.slime.scale.x, y: state.slime.scale.y, z: state.slime.scale.z } : null,

  // POOLING
  getParticleGeoCount: () => PARTICLE_GEO ? 1 : 0,
  getParticlePoolSize,

  // BEST TIME POP
  isBestBadgeBumped: () => document.getElementById('bestBadge').classList.contains('bump'),
  triggerBestBump:   () => updateBestBadge(true),

  // ACCESSIBILITY
  isReducedEffects:    () => reducedEffects,
  setReducedEffects(v) { _setReducedEffects(v); saveReducedEffects(v); applyReducedEffects(); },
  isBodyReducedEffects: () => document.body.classList.contains('reduced-effects'),

  // INPUT
  ACTIONS,
  BUFFER_MS,
  isActionHeld,
  wasActionPressedRecently,
  tryConsumeAction,
  getPressedAt: () => ({ ..._pressedAt }),

  // FACING
  getPlayerYaw: () => player ? player.rotation.y : 0,
  getTargetYaw,
  forceFacing:  (yaw) => forceFacing(yaw, player),

  simulateWin() {
    state.phase = 'win';
    playWin();
    spawnConfetti(player.position.x, player.position.z);
    screenFlash('#6fa83a', 0.25);
    addTrauma(0.35);
    hitStop(120);
    const finalTime = (performance.now() - state.startTime) / 1000;
    const prevBest  = loadBestTime();
    const isNewBest = prevBest == null || finalTime < prevBest;
    if (isNewBest) saveBestTime(finalTime);
    const prevBestLevel = loadBestLevel();
    const isNewBestLevel = prevBestLevel == null || state.level > prevBestLevel;
    if (isNewBestLevel) saveBestLevel(state.level);
    updateBestBadge(isNewBestLevel);
    const lobbyBest = document.getElementById('lobbyBest');
    if (lobbyBest) lobbyBest.textContent = String(loadBestLevel() ?? state.level);
    document.getElementById('winTime').textContent = finalTime.toFixed(1) + 's';
    document.getElementById('winBest').textContent = (isNewBestLevel ? '⭐ ' : '') + 'Nivel ' + String(loadBestLevel() ?? state.level);
    document.getElementById('win').classList.add('show');
  },
  simulateLose() {
    state.phase = 'lose';
    playLose();
    spawnLoseSplash(player.position.x, player.position.z);
    screenFlash('#e84545', 0.22);
    addTrauma(0.7);
    hitStop(160);
    triggerKnockback(player, player.position.x + 1, player.position.z);
    document.getElementById('lose').classList.add('show');
  },

  // LOBBY
  isLobbyVisible: () => !document.getElementById('lobby').classList.contains('hide'),
  hideLobby:      () => { document.getElementById('lobby').classList.add('hide'); },
  showLobby:      () => { document.getElementById('lobby').classList.remove('hide'); },

  getAudioEnabled: () => audioState.enabled,
  setAudioEnabled(v) {
    audioState.enabled = v;
    document.getElementById('audioToggle').textContent = v ? '🔊 Audio' : '🔇 Mute';
    document.getElementById('audioToggle').classList.toggle('muted', !v);
  },
  getLobbyBest: () => loadBestLevel(),

  movePlayerToExit() {
    const w = cellToWorld(cfg.ROWS - 2, cfg.COLS - 2);
    player.position.x = w.x;
    player.position.z = w.z;
  },
};

// ============================================================
// TEST HOOKS — threejs-qa-release inspector contract
// (window.__THREE_GAME_TEST_HOOKS__ and __THREE_GAME_DIAGNOSTICS__)
// Solo se exponen en modo debug; ver js/main.js.
// ============================================================
window.__THREE_GAME_TEST_HOOKS__ = {
  setState(name) {
    // Helper: si el game world no existe (estamos en lobby), lo creamos primero
    // para que simulateLose/simulateWin tengan un player válido.
    const ensurePlaying = () => {
      if (!player) {
        resetMaze();
        state.slimeSpawnAt = 0;
        document.getElementById('lobby').classList.add('hide');
      }
    };
    switch (name) {
      case 'lobby':
        returnToLobby();
        break;
      case 'playing':
        // Reset + spawn inmediato del slime para captura en mid-play.
        resetMaze();
        state.slimeSpawnAt = 0;
        document.getElementById('lobby').classList.add('hide');
        break;
      case 'paused':
        ensurePlaying();
        // Para que la captura del harness sea representativa, forzamos slime
        // visible y fade-in completo antes de pausar.
        if (!state.slimeAlive) spawnSlime();
        window.__maze2.forceSlimeFadeDone();
        pause();
        break;
      case 'lose':
        ensurePlaying();
        window.__maze2.simulateLose();
        break;
      case 'win':
        ensurePlaying();
        window.__maze2.simulateWin();
        break;
      default:
        console.warn(`[test-hooks] unknown state: ${name}`);
    }
  },
  pause, resume, togglePause, returnToLobby,
  seed(_n) {
    // Seed: delega a setSeedAndRegenerate. El seed n solo surte efecto
    // si va seguido de un reset (lo aplican los scripts de Playwright).
    return this.setSeedAndRegenerate(_n);
  },
  setSeedAndRegenerate(seed) {
    // Fija la seed del RNG de la maze y regenera el laberinto. Devuelve la
    // distancia BFS del spawn del slime para que los scripts de QA puedan
    // muestrear la distribución sin necesidad de jugar.
    seedRng(seed);
    resetMaze();
    const { r, c, bfs } = pickSlimeSpawnCell();
    return { seed, bfs, cell: { r, c } };
  },
  getSeed: () => getCurrentSeed(),
  resetRng,
};

window.__THREE_GAME_DIAGNOSTICS__ = {
  get renderer() {
    // Three.js info: counters se resetean en cada renderer.render()
    const info = renderer.info;
    return {
      calls:      info.render.calls,
      triangles:  info.render.triangles,
      geometries: info.memory.geometries,
      textures:   info.memory.textures,
    };
  },
  get state() {
    return {
      phase:             state.phase,
      level:             state.level,
      slimeAlive:        state.slimeAlive,
      slimeDistToPlayer: state.slimeDistToPlayer,
    };
  },
  get world() {
    return { children: world.children.length };
  },
  get hooks() {
    return ['__maze2', '__THREE_GAME_TEST_HOOKS__', '__THREE_GAME_DIAGNOSTICS__'];
  },
};
