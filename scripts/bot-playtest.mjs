#!/usr/bin/env node
// Bot playtest mínimo: driver BFS-greedy que siempre va hacia la salida
// sin esquivar al slime. Mide completion rate, tiempo medio y pasos medios.
//
// Estrategia:
//   1. Set seed, start game con slime inmediato
//   2. Bucle: getPlayerCell → bfsStep hacia exit → presiona la tecla de la
//      dirección calculada. Espera ~250ms. Lee phase. Si win/lose, registra
//      resultado y termina la partida.
//   3. Timeout duro de 60s por partida (anti-loop).
//
// Limitaciones:
//   - El bot NO esquiva al slime; el "best case" es "ir recto a la salida".
//   - El BFS de dirección puede atascar al bot contra paredes por unas
//     iteraciones; el bucle las resuelve con un número máximo de pasos.
//
// Salida:
//   artifacts/qa/bot-playtest.json
//   artifacts/qa/bot-playtest.md

import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const URL_BASE = 'http://127.0.0.1:8080/?debug=1&v=8';
const KEY_BY_DR = { '-1': 'w', '1': 's' };  // row delta → vertical
const KEY_BY_DC = { '-1': 'a', '1': 'd' };  // col delta → horizontal

function parseArgs(argv) {
  const args = { games: 10, url: URL_BASE, out: 'artifacts/qa', maxSteps: 200, stepMs: 250, timeoutMs: 60_000 };
  for (let i = 0; i < argv.length; i += 1) {
    const v = argv[i];
    if (v === '--games') args.games = Number(argv[++i]);
    else if (v === '--url') args.url = argv[++i];
    else if (v === '--out') args.out = argv[++i];
    else if (v === '--max-steps') args.maxSteps = Number(argv[++i]);
    else if (v === '--step-ms') args.stepMs = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${v}`);
  }
  return args;
}

// Compute the next direction key from a BFS step (next cell − current cell).
// Returns one of 'w','a','s','d' or null if no direction.
function directionFor(curr, next) {
  if (!next) return null;
  const dr = next[0] - curr[0];
  const dc = next[1] - curr[1];
  // BFS step returns one cell, so the delta is exactly 1 in one axis.
  if (dr === -1) return KEY_BY_DR['-1'];
  if (dr ===  1) return KEY_BY_DR['1'];
  if (dc === -1) return KEY_BY_DC['-1'];
  if (dc ===  1) return KEY_BY_DC['1'];
  return null;
}

async function playOneGame(page, args, seed) {
  const start = Date.now();
  // Reset duro: nueva seed, slime inmediato, fase playing
  await page.evaluate((s) => {
    window.__THREE_GAME_TEST_HOOKS__.setSeedAndRegenerate(s);
    window.__maze2.forceSlimeSpawn();
    window.__maze2.forceSlimeFadeDone();
    state => state; // noop para que el linter no proteste
  }, seed);

  let moves = 0;
  let lastPhase = 'playing';
  let result = 'timeout';
  let stepsPath = [];

  while (moves < args.maxSteps && (Date.now() - start) < args.timeoutMs) {
    const { phase, nextKey, cell } = await page.evaluate(() => {
      const m = window.__maze2;
      const phase = m.getPhase();
      if (phase !== 'playing') return { phase, nextKey: null, cell: null };
      const player = m.getPlayerCell();
      const exit   = m.getExitCell();
      const step   = m.bfsStep(player.r, player.c, exit.r, exit.c);
      if (!step) return { phase, nextKey: null, cell: player };
      const dr = step[0] - player.r;
      const dc = step[1] - player.c;
      let key = null;
      if (dr === -1) key = 'w';
      else if (dr ===  1) key = 's';
      else if (dc === -1) key = 'a';
      else if (dc ===  1) key = 'd';
      return { phase, nextKey: key, cell: player };
    });
    lastPhase = phase;
    if (phase !== 'playing') {
      result = phase === 'win' ? 'win' : phase === 'lose' ? 'lose' : 'aborted';
      break;
    }
    if (!nextKey) {
      // No BFS step (player is at exit? or stuck?). Wait and try again.
      await page.waitForTimeout(args.stepMs);
      moves += 1;
      continue;
    }
    stepsPath.push(`${cell.r},${cell.c}→${nextKey}`);
    // keyboard.press no funciona bien con el buffer de 200ms del juego (el
    // keyup se procesa antes de que el tick consuma la acción). Usamos
    // down + wait + up para que el juego vea el key held.
    await page.keyboard.down(nextKey);
    await page.waitForTimeout(args.stepMs);
    await page.keyboard.up(nextKey);
    await page.waitForTimeout(Math.max(50, Math.floor(args.stepMs * 0.2)));
    moves += 1;
  }

  const elapsedMs = Date.now() - start;
  return {
    seed,
    result,
    moves,
    elapsedMs,
    finalPhase: lastPhase,
    stepsPath: stepsPath.slice(0, 30),
  };
}

function stats(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    n: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Number(mean.toFixed(2)),
    median: sorted[Math.floor(sorted.length / 2)],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.out, { recursive: true });

  const browser = await chromium.launch({ channel: 'chromium' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto(args.url, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { state: 'visible' });
  await page.waitForFunction(() => window.__THREE_GAME_TEST_HOOKS__ !== undefined, { timeout: 10_000 });

  const games = [];
  for (let seed = 1; seed <= args.games; seed += 1) {
    const g = await playOneGame(page, args, seed);
    games.push(g);
    console.error(`[playtest] seed=${seed} result=${g.result} moves=${g.moves} elapsed=${g.elapsedMs}ms`);
  }
  await browser.close();

  const wins   = games.filter((g) => g.result === 'win');
  const losses = games.filter((g) => g.result === 'lose');
  const other  = games.filter((g) => g.result !== 'win' && g.result !== 'lose');

  const report = {
    args,
    games,
    summary: {
      total:        games.length,
      wins:         wins.length,
      losses:       losses.length,
      other:        other.length,
      completionRate: games.length ? Number((wins.length / games.length * 100).toFixed(1)) : 0,
      winTimeMs:    stats(wins.map((g) => g.elapsedMs)),
      winMoves:     stats(wins.map((g) => g.moves)),
      loseTimeMs:   stats(losses.map((g) => g.elapsedMs)),
      loseMoves:    stats(losses.map((g) => g.moves)),
    },
    consoleErrors,
    pageErrors,
  };
  await writeFile(path.join(args.out, 'bot-playtest.json'), `${JSON.stringify(report, null, 2)}\n`);

  const tableRows = games
    .map((g) => `| ${g.seed} | ${g.result} | ${g.moves} | ${g.elapsedMs} |`)
    .join('\n');

  const md = [
    `# Bot Playtest — ${args.games} partidas BFS-greedy`,
    ``,
    `Generado el ${new Date().toISOString()} desde \`scripts/bot-playtest.mjs\`.`,
    `URL: \`${args.url}\`.`,
    `Estrategia: cada step, \`bfsStep\` hacia la salida + tecla de la dirección.`,
    `El bot NO esquiva al slime. Es el "best case" del jugador.`,
    ``,
    `## Resumen`,
    ``,
    `| Métrica | Valor |`,
    `| --- | ---: |`,
    `| Partidas | ${report.summary.total} |`,
    `| Wins | ${report.summary.wins} |`,
    `| Losses | ${report.summary.losses} |`,
    `| Otros (timeout/abort) | ${report.summary.other} |`,
    `| **Completion rate** | **${report.summary.completionRate}%** |`,
    ``,
    `### Wins`,
    ``,
    `| Métrica | N | Mín | Media | Mediana | Máx |`,
    `| --- | ---: | ---: | ---: | ---: | ---: |`,
    `| Tiempo (ms) | ${report.summary.winTimeMs?.n ?? 0} | ${report.summary.winTimeMs?.min ?? '—'} | ${report.summary.winTimeMs?.mean ?? '—'} | ${report.summary.winTimeMs?.median ?? '—'} | ${report.summary.winTimeMs?.max ?? '—'} |`,
    `| Movimientos | ${report.summary.winMoves?.n ?? 0} | ${report.summary.winMoves?.min ?? '—'} | ${report.summary.winMoves?.mean ?? '—'} | ${report.summary.winMoves?.median ?? '—'} | ${report.summary.winMoves?.max ?? '—'} |`,
    ``,
    `### Losses`,
    ``,
    `| Métrica | N | Mín | Media | Mediana | Máx |`,
    `| --- | ---: | ---: | ---: | ---: | ---: |`,
    `| Tiempo (ms) | ${report.summary.loseTimeMs?.n ?? 0} | ${report.summary.loseTimeMs?.min ?? '—'} | ${report.summary.loseTimeMs?.mean ?? '—'} | ${report.summary.loseTimeMs?.median ?? '—'} | ${report.summary.loseTimeMs?.max ?? '—'} |`,
    `| Movimientos | ${report.summary.loseMoves?.n ?? 0} | ${report.summary.loseMoves?.min ?? '—'} | ${report.summary.loseMoves?.mean ?? '—'} | ${report.summary.loseMoves?.median ?? '—'} | ${report.summary.loseMoves?.max ?? '—'} |`,
    ``,
    `## Datos crudos`,
    ``,
    `| Seed | Result | Moves | Tiempo (ms) |`,
    `| ---: | --- | ---: | ---: |`,
    tableRows,
    ``,
    `Console errors: ${consoleErrors.length}. Page errors: ${pageErrors.length}.`,
    ``,
  ].join('\n');
  await writeFile(path.join(args.out, 'bot-playtest.md'), md);

  console.log(JSON.stringify({
    total: report.summary.total,
    wins: report.summary.wins,
    losses: report.summary.losses,
    completionRate: report.summary.completionRate,
    consoleErrors: consoleErrors.length,
    pageErrors: pageErrors.length,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
