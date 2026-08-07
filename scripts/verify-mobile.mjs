// Toma screenshot del juego tal como se ve en un móvil (9:20 aspect)
// para verificar que el HUD rediseñado se ve bien durante gameplay.
import { chromium, devices } from 'playwright';

const URL = process.env.URL || 'http://127.0.0.1:8080';
const OUT = 'artifacts/hud-mobile-preview.png';

const browser = await chromium.launch();
const pixel3 = devices['Pixel 5'];
const ctx     = await browser.newContext({
  ...pixel3,
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(`${URL}/?autoplay=1`, { waitUntil: 'networkidle' });
// Esperar a que el juego arranque y el HUD esté visible
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT, type: 'png' });
console.log('preview ->', OUT);
await browser.close();

