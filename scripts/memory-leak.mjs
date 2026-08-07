#!/usr/bin/env node
// Valida la promesa del README §11: "20 regeneraciones no aumentan geometrías
// de forma continua". Cuenta InstancedMesh y material geometries en cada reset
// y verifica que el pico no se dispara.
//
// Salida:
//   artifacts/qa/memory-leak.json   — datos crudos + stats
//   artifacts/qa/memory-leak.md     — reporte markdown con veredicto

import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const args = { rounds: 20, url: 'http://127.0.0.1:8080/?debug=1&v=8', out: 'artifacts/qa' };
  for (let i = 0; i < argv.length; i += 1) {
    const v = argv[i];
    if (v === '--rounds') args.rounds = Number(argv[++i]);
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
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { min, max, mean: Number(mean.toFixed(2)) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.out, { recursive: true });

  const browser = await chromium.launch({ channel: 'chromium' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(args.url, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { state: 'visible' });
  await page.waitForFunction(() => window.__THREE_GAME_TEST_HOOKS__ !== undefined, { timeout: 10_000 });

  const samples = [];
  for (let i = 0; i < args.rounds; i += 1) {
    // Cada ronda: reset duro con seed distinta + spawn slime inmediato para
    // forzar el pico de geometrías del estado "playing".
    const sample = await page.evaluate((round) => {
      const hooks = window.__THREE_GAME_TEST_HOOKS__;
      hooks.setSeedAndRegenerate(round);
      // Llamamos a spawnSlime y forceSlimeFadeDone a través de window.__maze2
      // para que la ronda tenga slime en pantalla (más geometrías que solo el player).
      window.__maze2.forceSlimeSpawn();
      window.__maze2.forceSlimeFadeDone();
      // Un frame para que el renderer.info se actualice.
      return new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const d = window.__THREE_GAME_DIAGNOSTICS__;
            resolve({
              round,
              geometries: d.renderer.geometries,
              calls:      d.renderer.calls,
              triangles:  d.renderer.triangles,
              textures:   d.renderer.textures,
              world:      d.world.children,
              phase:      d.state.phase,
              slimeAlive: d.state.slimeAlive,
            });
          });
        });
      });
    }, i);
    samples.push(sample);
  }

  await browser.close();

  const geometries = samples.map((s) => s.geometries);
  const calls      = samples.map((s) => s.calls);
  const triangles  = samples.map((s) => s.triangles);
  const textures   = samples.map((s) => s.textures);
  const world      = samples.map((s) => s.world);

  // Detección de leak: si la diferencia entre la primera mitad y la segunda
  // mitad es > 30%, hay un leak sospechoso. Comparación robusta con mediana.
  const half = Math.floor(samples.length / 2);
  const firstHalfMax  = Math.max(...samples.slice(0, half).map((s) => s.geometries));
  const secondHalfMax = Math.max(...samples.slice(half).map((s) => s.geometries));
  const drift = secondHalfMax - firstHalfMax;
  const driftPct = (drift / firstHalfMax) * 100;

  const report = {
    args,
    samples,
    stats: {
      geometries: stats(geometries),
      calls:      stats(calls),
      triangles:  stats(triangles),
      textures:   stats(textures),
      world:      stats(world),
    },
    leakCheck: {
      firstHalfMaxGeometries: firstHalfMax,
      secondHalfMaxGeometries: secondHalfMax,
      drift,
      driftPct: Number(driftPct.toFixed(1)),
    },
    consoleErrors,
    pageErrors,
  };
  await writeFile(path.join(args.out, 'memory-leak.json'), `${JSON.stringify(report, null, 2)}\n`);

  const veredict =
    driftPct <= 30 && geometries[geometries.length - 1] <= 30
      ? 'PASS — geometrías estables; no se observa leak entre la primera y la segunda mitad.'
      : `FAIL — drift sospechoso entre la primera y la segunda mitad (${driftPct.toFixed(1)}%).`;

  const sampleRows = samples
    .map((s) => `| ${s.round} | ${s.geometries} | ${s.calls} | ${s.triangles.toLocaleString()} | ${s.textures} | ${s.world} | ${s.phase} |`)
    .join('\n');

  const md = [
    `# Memory Leak Test — ${args.rounds} regeneraciones`,
    ``,
    `Generado el ${new Date().toISOString()} desde \`scripts/memory-leak.mjs\`.`,
    `URL: \`${args.url}\`.`,
    ``,
    `## Stats`,
    ``,
    `| Métrica | Mín | Media | Máx |`,
    `| --- | ---: | ---: | ---: |`,
    `| Geometrías (Three.js) | ${report.stats.geometries.min} | ${report.stats.geometries.mean} | ${report.stats.geometries.max} |`,
    `| Draw calls | ${report.stats.calls.min} | ${report.stats.calls.mean} | ${report.stats.calls.max} |`,
    `| Triángulos | ${report.stats.triangles.min} | ${report.stats.triangles.mean} | ${report.stats.triangles.max} |`,
    `| Texturas | ${report.stats.textures.min} | ${report.stats.textures.mean} | ${report.stats.textures.max} |`,
    `| \`world.children\` | ${report.stats.world.min} | ${report.stats.world.mean} | ${report.stats.world.max} |`,
    ``,
    `## Leak check`,
    ``,
    `Comparación primera mitad vs segunda mitad del run, mirando el **máximo de geometrías** por mitad. Un drift > 30% es sospechoso.`,
    ``,
    `| Métrica | Valor |`,
    `| --- | ---: |`,
    `| Geometrías pico — 1ª mitad | ${firstHalfMax} |`,
    `| Geometrías pico — 2ª mitad | ${secondHalfMax} |`,
    `| Drift absoluto | ${drift} |`,
    `| Drift relativo | ${driftPct.toFixed(1)}% |`,
    `| Geometrías última ronda | ${geometries[geometries.length - 1]} |`,
    ``,
    `## Datos crudos`,
    ``,
    `| Ronda | Geom. | Calls | Triángulos | Texturas | world | Phase |`,
    `| ---: | ---: | ---: | ---: | ---: | ---: | --- |`,
    sampleRows,
    ``,
    `## Veredicto`,
    ``,
    `**${veredict}**`,
    ``,
    `Console errors: ${consoleErrors.length}. Page errors: ${pageErrors.length}.`,
    ``,
  ].join('\n');
  await writeFile(path.join(args.out, 'memory-leak.md'), md);

  console.log(JSON.stringify({
    n: samples.length,
    geometries: report.stats.geometries,
    calls: report.stats.calls,
    world: report.stats.world,
    leakDriftPct: report.leakCheck.driftPct,
    veredict: driftPct <= 30 && geometries[geometries.length - 1] <= 30 ? 'PASS' : 'FAIL',
    consoleErrors: consoleErrors.length,
    pageErrors: pageErrors.length,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
