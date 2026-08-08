// scripts/check-www-depth.mjs
// Verificación rápida post-cap-copy. Aborta con exit 1 si www/ tiene
// subcarpetas www/ anidadas (señal de bucle de copia).

import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const WWW = resolve(ROOT, 'www');

if (!existsSync(WWW)) {
  console.log('OK: www/ no existe aún (nada que verificar)');
  process.exit(0);
}

function findNestedWWW(p, depth = 0, maxDepth = 15) {
  if (depth > maxDepth) {
    console.error('ERROR: www/ excede', maxDepth, 'niveles de profundidad. ABORTANDO.');
    process.exit(1);
  }
  let entries;
  try { entries = readdirSync(p, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name === 'www' && depth > 0) {
      console.error('ERROR: detectada carpeta www/ anidada en', join(p, e.name));
      console.error('  Profundidad:', depth, 'niveles. Probable bucle de cap copy.');
      process.exit(1);
    }
    if (e.name === 'node_modules' || e.name === '.gradle' || e.name === 'build') continue;
    findNestedWWW(join(p, e.name), depth + 1, maxDepth);
  }
}

findNestedWWW(WWW, 0);

// Cuantificar el top-level
const top = readdirSync(WWW, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
console.log('OK: www/ top-level dirs:', top.join(', '));
console.log('OK: ninguna carpeta www/ anidada. Estructura sana.');
