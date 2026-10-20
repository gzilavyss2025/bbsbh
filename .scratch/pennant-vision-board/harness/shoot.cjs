// Usage: node shoot.cjs <out.png> <variants.json> [filterParams.json]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const [out, vfile, pfile] = process.argv.slice(2);
  const v = fs.readFileSync(vfile, 'utf8');
  const p = pfile ? fs.readFileSync(pfile, 'utf8') : '{}';
  const url = 'file://' + path.join(__dirname, 'harness.html') + '?v=' + encodeURIComponent(v) + '&p=' + encodeURIComponent(p);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: Number(process.env.DSF || 1) });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
})();
