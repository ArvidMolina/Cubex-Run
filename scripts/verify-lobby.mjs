// Verifica que el lobby se ve bien con los CSS modulares
import { chromium, devices } from 'playwright';
const URL = process.env.URL || 'http://127.0.0.1:8080';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 5'], deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(`${URL}/?v=21`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'artifacts/lobby-after-refactor.png', type: 'png' });
console.log('lobby -> artifacts/lobby-after-refactor.png');
await browser.close();
