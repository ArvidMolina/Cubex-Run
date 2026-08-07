import { cfg } from './config.js';

export let grid = [];

const DR4 = [-1, 1, 0, 0];
const DC4 = [0, 0, -1, 1];
let bfsVisited = new Uint32Array(0);
let bfsParent = new Int32Array(0);
let bfsDistanceBuffer = new Int16Array(0);
let bfsQueue = new Int32Array(0);
let bfsVisitToken = 0;
const sharedStep = [0, 0];
const sharedPathResult = { step: null, distance: Infinity };

// ---- Seedable RNG (mulberry32) ---------------------------------------------
// Por defecto usa Math.random; tests pueden llamar seedRng(n) para que la
// maze sea determinista. El estado se reemplaza, no se acumula entre seeds.
let _rand = Math.random;
let _currentSeed = null;

export function seedRng(seed) {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) return;
  let s = (seed >>> 0) || 1;
  _currentSeed = seed;
  _rand = function mulberry32() {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function resetRng() {
  _rand = Math.random;
  _currentSeed = null;
}

export function getCurrentSeed() {
  return _currentSeed;
}
// ----------------------------------------------------------------------------

function ensureBfsBuffers(size) {
  if (bfsVisited.length === size) return;
  bfsVisited = new Uint32Array(size);
  bfsParent = new Int32Array(size);
  bfsDistanceBuffer = new Int16Array(size);
  bfsQueue = new Int32Array(size);
  bfsVisitToken = 0;
}

function nextVisitToken() {
  bfsVisitToken++;
  if (bfsVisitToken === 0xffffffff) {
    bfsVisited.fill(0);
    bfsVisitToken = 1;
  }
  return bfsVisitToken;
}

export function generateMaze(extraCarveCount = 0) {
  const { COLS, ROWS } = cfg;
  grid = [];
  for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(1));
  const stack = [[1, 1]];
  grid[1][1] = 0;
  const dirs = [[0,-2],[0,2],[-2,0],[2,0]];
  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];
    const order = [0, 1, 2, 3];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(_rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let carved = false;
    for (const idx of order) {
      const [dr, dc] = dirs[idx];
      const nr = r + dr, nc = c + dc;
      if (nr > 0 && nr < ROWS - 1 && nc > 0 && nc < COLS - 1 && grid[nr][nc] === 1) {
        grid[r + dr/2][c + dc/2] = 0;
        grid[nr][nc] = 0;
        stack.push([nr, nc]);
        carved = true;
        break;
      }
    }
    if (!carved) stack.pop();
  }
  // Garantizar entrada y salida
  grid[1][1] = 0;
  grid[ROWS - 2][COLS - 2] = 0;
  // Forzar al menos 2 direcciones disponibles en entrada y salida
  if (grid[1][2] === 1) grid[1][2] = 0;
  if (grid[2][1] === 1) grid[2][1] = 0;
  if (grid[ROWS - 2][COLS - 3] === 1) grid[ROWS - 2][COLS - 3] = 0;
  if (grid[ROWS - 3][COLS - 2] === 1) grid[ROWS - 3][COLS - 2] = 0;

  // Si se solicita extraCarveCount (niveles iniciales), remueve paredes interiores para abrir el laberinto
  if (extraCarveCount > 0) {
    let removed = 0;
    let attempts = 0;
    while (removed < extraCarveCount && attempts < 100) {
      attempts++;
      const r = 2 + Math.floor(_rand() * (ROWS - 4));
      const c = 2 + Math.floor(_rand() * (COLS - 4));
      if (grid[r][c] === 1) {
        const hOpen = grid[r][c - 1] === 0 && grid[r][c + 1] === 0;
        const vOpen = grid[r - 1][c] === 0 && grid[r + 1][c] === 0;
        if (hOpen || vOpen) {
          grid[r][c] = 0;
          removed++;
        }
      }
    }
  }
}

export function isWall(r, c) {
  const { COLS, ROWS } = cfg;
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
  return grid[r][c] === 1;
}

// Un solo BFS devuelve el siguiente paso y la distancia, reutilizando buffers.
export function bfsNextStepAndDistance(sr, sc, tr, tc) {
  const { COLS, ROWS } = cfg;
  sharedPathResult.step = null;
  sharedPathResult.distance = Infinity;
  if (sr < 0 || sr >= ROWS || sc < 0 || sc >= COLS ||
      tr < 0 || tr >= ROWS || tc < 0 || tc >= COLS) {
    return sharedPathResult;
  }
  if (sr === tr && sc === tc) {
    sharedStep[0] = sr;
    sharedStep[1] = sc;
    sharedPathResult.step = sharedStep;
    sharedPathResult.distance = 0;
    return sharedPathResult;
  }

  const size = ROWS * COLS;
  ensureBfsBuffers(size);
  const token = nextVisitToken();
  const start = sr * COLS + sc;
  const target = tr * COLS + tc;
  let head = 0;
  let tail = 0;
  bfsQueue[tail++] = start;
  bfsVisited[start] = token;
  bfsParent[start] = -1;
  bfsDistanceBuffer[start] = 0;

  while (head < tail) {
    const current = bfsQueue[head++];
    if (current === target) break;
    const r = Math.floor(current / COLS);
    const c = current - r * COLS;
    for (let i = 0; i < 4; i++) {
      const nr = r + DR4[i];
      const nc = c + DC4[i];
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const next = nr * COLS + nc;
      if (bfsVisited[next] === token || grid[nr][nc] === 1) continue;
      bfsVisited[next] = token;
      bfsParent[next] = current;
      bfsDistanceBuffer[next] = bfsDistanceBuffer[current] + 1;
      bfsQueue[tail++] = next;
    }
  }

  if (bfsVisited[target] !== token) return sharedPathResult;
  let step = target;
  while (bfsParent[step] !== start && bfsParent[step] >= 0) {
    step = bfsParent[step];
  }
  sharedStep[0] = Math.floor(step / COLS);
  sharedStep[1] = step % COLS;
  sharedPathResult.step = sharedStep;
  sharedPathResult.distance = bfsDistanceBuffer[target];
  return sharedPathResult;
}

// API de compatibilidad para hooks y pruebas.
export function bfsStep(sr, sc, tr, tc) {
  const step = bfsNextStepAndDistance(sr, sc, tr, tc).step;
  return step ? [step[0], step[1]] : null;
}

// BFS: devuelve el número de pasos desde (sr,sc) hasta (tr,tc), o Infinity si no hay camino
export function bfsDistance(sr, sc, tr, tc) {
  return bfsNextStepAndDistance(sr, sc, tr, tc).distance;
}
