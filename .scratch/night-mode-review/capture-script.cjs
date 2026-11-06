const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/home/user/bbsbh/.scratch/night-mode-review';
const BASE = 'http://127.0.0.1:5173';
const ROUTES = [
  ['slate', '/'],
  ['lineup', '/07072026/milstl-2/lineup1'],
  ['innings', '/07072026/milstl-2/top1'],
  ['boxscore', '/07072026/milstl-2/boxscore'],
  ['team', '/team/milwaukee-brewers-158'],
  ['player', '/player/christian-yelich-592885'],
  ['standings', '/standings'],
  ['profile', '/profile'],
  ['logbook', '/logbook'],
];
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const results = [];
  for (const [slug, path] of ROUTES) {
    for (const theme of ['light', 'dark']) {
      const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}nointro`;
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const row = { slug, theme, url, file: `${slug}-${theme}.png`, status: 'ok', note: '' };
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        row.http = resp ? resp.status() : 'none';
        await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { row.note += 'networkidle timeout; '; });
        await page.waitForTimeout(800);
        await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
        const text = (await page.innerText('body').catch(() => '')).trim();
        if (text.length < 20) { row.status = 'blank?'; row.note += 'little text rendered; '; }
        await page.screenshot({ path: `${OUT}/${row.file}`, fullPage: true });
      } catch (e) {
        row.status = 'FAILED'; row.note += String(e.message).split('\n')[0];
      }
      results.push(row);
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync('/tmp/shots-results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})();
