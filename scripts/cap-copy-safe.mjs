// scripts/cap-copy-safe.mjs
// Wrapper seguro sobre `npx cap copy android`.
// Antes de copiar, verifica:
//   1. que capacitor.config.json tenga webDir coherente (no recursivo)
//   2. que la profundidad de www/ sea razonable (< 10 niveles)
// Si algo huele mal, aborta ANTES de tocar nada.
//
// Por qué: en este proyecto ya tuvimos un bug donde webDir apuntaba dentro
// de sí mismo (o un script copy-on-build) y produjo un bucle de 3.825 niveles
// de www\www\www\... que mató el path de Windows. No queremos repetirlo.

import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');

function readCapConfig() {
  const p = resolve(ROOT, 'capacitor.config.json');
  if (!existsSync(p)) {
    console.error('ERROR: no existe capacitor.config.json en', ROOT);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    console.error('ERROR: capacitor.config.json no es JSON válido:', e.message);
    process.exit(1);
  }
}

function checkWebDir(webDir) {
  if (!webDir) {
    console.error('ERROR: capacitor.config.json no tiene webDir definido');
    process.exit(1);
  }
  if (webDir.includes('/') || webDir.includes('\\')) {
    // webDir tipo "www/www" o "www\\www" — es recursivo
    console.error('ERROR: webDir parece recursivo:', JSON.stringify(webDir));
    console.error('  ¿Apunta el webDir a una ruta que ya incluye su propio destino?');
    process.exit(1);
  }
  const abs = resolve(ROOT, webDir);
  if (!existsSync(abs)) {
    console.error('ERROR: webDir apunta a un directorio que no existe:', abs);
    process.exit(1);
  }
  if (!statSync(abs).isDirectory()) {
    console.error('ERROR: webDir no es un directorio:', abs);
    process.exit(1);
  }
  // El caso peligroso: webDir === "www" y la copia va a android/app/src/main/assets/public,
  // y por algún motivo el destino de la copia está DENTRO de webDir. Comprobamos que
  // el destino canónico de Capacitor NO esté dentro del webDir.
  const destCanonical = resolve(ROOT, 'android/app/src/main/assets/public');
  if (destCanonical.startsWith(abs + '/') || destCanonical === abs) {
    console.error('ERROR: el destino de cap copy (', destCanonical, ') cae DENTRO de webDir (', abs, ').');
    console.error('  Esto produciría un bucle de copia infinito. Revisa capacitor.config.json.');
    process.exit(1);
  }
  return abs;
}

function checkDepth(abs, maxDepth = 10) {
  // Sube desde abs y mide profundidad de subcarpetas anidadas.
  // No usamos recursión completa (que puede colgarse en árboles patológicos).
  function depth(p, d) {
    if (d > maxDepth) return d;
    let deepest = d;
    let entries;
    try { entries = readdirSync(p, { withFileTypes: true }); }
    catch { return deepest; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === 'node_modules' || e.name === '.gradle' || e.name === 'build') continue;
      const child = join(p, e.name);
      if (e.name === 'www' && d > 0) {
        // Encontramos un www/ anidado — bug histórico confirmado
        console.error('ERROR: detectada carpeta www/ anidada en', child);
        console.error('  El árbol tiene ' + d + ' niveles de profundidad — posible bucle de cap copy.');
        process.exit(1);
      }
      const sub = depth(child, d + 1);
      if (sub > deepest) deepest = sub;
      if (deepest > maxDepth) return deepest;
    }
    return deepest;
  }
  return depth(abs, 0);
}

const cfg = readCapConfig();
const webDir = checkWebDir(cfg.webDir);
const maxDepthAllowed = 10;
const depth = checkDepth(webDir, maxDepthAllowed);
if (depth > maxDepthAllowed) {
  console.error('ERROR: www/ tiene', depth, 'niveles de profundidad (máx', maxDepthAllowed + '). Posible bucle.');
  process.exit(1);
}
console.log('OK: webDir =', cfg.webDir, '· profundidad =', depth);

// Ejecutar `npx cap copy android`
console.log('Ejecutando: npx cap copy android');
const res = spawnSync('npx', ['cap', 'copy', 'android'], { cwd: ROOT, stdio: 'inherit', shell: true });
process.exit(res.status ?? 1);
