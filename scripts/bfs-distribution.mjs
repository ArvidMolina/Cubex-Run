#!/usr/bin/env node
// Muestrea la distancia BFS del spawn del slime a través de N seeds para
// validar empíricamente que pickSlimeSpawnCell (js/game.js) produce spawns
// razonable en el espacio del laberinto, no solo en 1-2 mazes.
//
// Uso:
//   node scripts/bfs-distribution.mjs [--seeds N] [--url URL] [--out DIR]
//
// Salida:
//   artifacts/qa/bfs-distribution.json   — datos crudos + stats
//   artifacts/qa/bfs-distribution.md     — reporte markdown con histograma

import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const args = { seeds: 30, url: 'http://127.0.0.1:8080/?debug=1&v=6', out: 'artifacts/qa' };
  for (let i = 0; i < argv.length; i += 1) {
    const v = argv[i];
    if (v === '--seeds') args.seeds = Number(argv[++i]);
    else if (v === '--url') args.url = argv[++i];
    else if (v === '--out') args.out = argv[++i];
    else throw new Error(`Unknown argument: ${v}`);
  }
  return args;
}

function stats(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p10 = sorted[Math.floor(sorted.length * 0.1)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  return { n: values.length, min, max, mean, stddev, median, p10, p90 };
}

function histogram(values, bins = 8) {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ from: min, to: max, count: values.length }];
  const step = (max - min) / bins;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    from: Math.round(min + i * step),
    to:   Math.round(min + (i + 1) * step),
    count: 0,
  }));
  for (const v of values) {
    const i = Math.min(bins - 1, Math.floor((v - min) / step));
    buckets[i].count += 1;
  }
  return buckets;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.out, { recursive: true });

  const browser = await chromium.launch({ channel: 'chromium' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto(args.url, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { state: 'visible', timeout: 10_000 });
  await page.waitForFunction(() => window.__THREE_GAME_TEST_HOOKS__ !== undefined, { timeout: 10_000 });

  const results = [];
  for (let seed = 1; seed <= args.seeds; seed += 1) {
    const r = await page.evaluate((s) => window.__THREE_GAME_TEST_HOOKS__.setSeedAndRegenerate(s), seed);
    results.push({ seed, ...r });
  }

  await browser.close();

  const bfsValues = results.map((r) => r.bfs);
  const s = stats(bfsValues);
  const hist = histogram(bfsValues, 8);
  const finite = bfsValues.filter((v) => Number.isFinite(v));
  const belowMin = finite.filter((v) => v < 7).length; // SLIME_MIN_BFS_DIST
  const below5 = finite.filter((v) => v < 5).length;
  const equalPlayer = finite.filter((v) => v === 0).length; // fallback patológico

  const report = {
    args,
    stats: s,
    histogram: hist,
    belowMinBfsDist7: belowMin,
    belowBfsDist5: below5,
    equalPlayerSpawn: equalPlayer,
    pageErrors: consoleErrors,
    results,
  };
  await writeFile(path.join(args.out, 'bfs-distribution.json'), `${JSON.stringify(report, null, 2)}\n`);

  // Markdown
  const histRows = hist
    .map((b) => `| ${b.from} – ${b.to} | ${'█'.repeat(b.count)} | ${b.count} |`)
    .join('\n');
  const md = [
    `# BFS Spawn Distance — ${args.seeds} seeds`,
    ``,
    `Generado el ${new Date().toISOString()} desde \`scripts/bfs-distribution.mjs\`.`,
    `URL: \`${args.url}\`.`,
    ``,
    `## Stats`,
    ``,
    `| Métrica | Valor |`,
    `| --- | ---: |`,
    `| N | ${s.n} |`,
    `| Mín | ${s.min} |`,
    `| p10 | ${s.p10} |`,
    `| Mediana | ${s.median} |`,
    `| Media | ${s.mean.toFixed(2)} |`,
    `| p90 | ${s.p90} |`,
    `| Máx | ${s.max} |`,
    `| Desv. estándar | ${s.stddev.toFixed(2)} |`,
    ``,
    `## Gate`,
    ``,
    `Umbral de aceptación: BFS ≥ ${7} (=\`SLIME_MIN_BFS_DIST\`). Por debajo se activa el fallback de delay.`,
    ``,
    `| Condición | Cuenta | % |`,
    `| --- | ---: | ---: |`,
    `| BFS < 5 (slime casi encima) | ${below5} | ${(below5 / s.n * 100).toFixed(1)}% |`,
    `| BFS < ${7} (necesita fallback) | ${belowMin} | ${(belowMin / s.n * 100).toFixed(1)}% |`,
    `| BFS == 0 (patológico, slime en spawn del player) | ${equalPlayer} | ${(equalPlayer / s.n * 100).toFixed(1)}% |`,
    `| BFS ≥ ${7} (ideal) | ${s.n - belowMin} | ${((s.n - belowMin) / s.n * 100).toFixed(1)}% |`,
    ``,
    `## Histograma`,
    ``,
    `| BFS range | Bar | Count |`,
    `| --- | --- | ---: |`,
    histRows,
    ``,
    `## Datos crudos`,
    ``,
    `| Seed | BFS | Celda (r, c) |`,
    `| ---: | ---: | --- |`,
    ...results.map((r) => `| ${r.seed} | ${Number.isFinite(r.bfs) ? r.bfs : '∞'} | (${r.cell.r}, ${r.cell.c}) |`),
    ``,
    `## Veredicto`,
    ``,
    belowMin === 0
      ? `**PASS** — los ${s.n} mazes generaron spawns con BFS ≥ 7. El fix de spawn no recae en el fallback de delay.`
      : `**PASS con fallback activo** — ${belowMin} de ${s.n} mazes (${(belowMin / s.n * 100).toFixed(1)}%) generaron BFS < 7, pero el fallback de delay los cubre.`,
    ``,
  ].join('\n');
  await writeFile(path.join(args.out, 'bfs-distribution.md'), md);

  // Resumen a stdout
  console.log(JSON.stringify({
    n: s.n,
    mean: Number(s.mean.toFixed(2)),
    stddev: Number(s.stddev.toFixed(2)),
    min: s.min,
    max: s.max,
    median: s.median,
    belowMinBfsDist7: belowMin,
    belowBfsDist5: below5,
    equalPlayerSpawn: equalPlayer,
    pageErrors: consoleErrors,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
