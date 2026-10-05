import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } })
for (const u of ['http://localhost:5172/?nointro', 'http://localhost:5172/10152026?nointro']) {
  await p.goto(u, { waitUntil: 'load' }); await p.waitForTimeout(5000)
  const r = await p.evaluate(() => { const n = document.querySelector('button[aria-label="Next day"]'); return { url: location.pathname, disabled: n?.disabled, banner: document.body.innerText.includes('GAMES RESUME') || document.body.innerText.toUpperCase().includes('GAMES RESUME'), noGames: document.body.innerText.toUpperCase().includes('NO GAMES SCHEDULED') } })
  console.log(u, JSON.stringify(r))
}
await b.close()
