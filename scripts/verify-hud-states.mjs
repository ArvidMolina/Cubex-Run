// Captura el HUD en 3 estados: inicio, mid-game con slime cerca, y tras moverse varios pasos
import { chromium, devices } from 'playwright';

const URL = process.env.URL || 'http://127.0.0.1:8080';
const OUT_DIR = 'artifacts';

const browser = await chromium.launch();
const pixel3 = devices['Pixel 5'];
const ctx     = await browser.newContext({ ...pixel3, deviceScaleFactor: 2 });
const page    = await ctx.newPage();

await page.goto(`${URL}/?autoplay=1`, { waitUntil: 'networkidle' });

// Estado 1: recién arrancado (timer casi a 0, sin slime aún)
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT_DIR}/hud-state-1-start.png`, type: 'png' });
console.log('1/3 start -> hud-state-1-start.png');

// Estado 2: tras 5s con slime ya spawneado y cerca
await page.waitForTimeout(5000);
await page.screenshot({ path: `${OUT_DIR}/hud-state-2-danger.png`, type: 'png' });
console.log('2/3 danger -> hud-state-2-danger.png');

// Estado 3: tras 10s con slime persiguiendo
await page.waitForTimeout(5000);
await page.screenshot({ path: `${OUT_DIR}/hud-state-3-late.png`, type: 'png' });
console.log('3/3 late -> hud-state-3-late.png');

await browser.close();
