// Captura el personaje Cubex desde el lobby. Toma screenshot del
// logo-emblem que contiene el render 3D del goblin (lobby-mascot.js).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const URL_BASE = process.env.URL || 'http://127.0.0.1:8080';
const OUT      = 'artifacts/icon-source.png';
const SIZE     = 1024;

mkdirSync(dirname(OUT), { recursive: true });

const browser = await chromium.launch();
const ctx     = await browser.newContext({
  viewport: { width: SIZE, height: SIZE },
  deviceScaleFactor: 2,  // alta densidad para mejor calidad al recortar
});
const page = await ctx.newPage();
await page.goto(`${URL_BASE}/?v=20`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);  // que termine de animar el goblin
const emblem = await page.$('.logo-emblem');
if (emblem) {
  await emblem.screenshot({ path: OUT, type: 'png' });
  console.log('icon (emblem) →', OUT);
} else {
  await page.screenshot({ path: OUT, type: 'png', fullPage: false });
  console.log('icon (page) →', OUT);
}
await browser.close();
