import { chromium } from 'file:///C:/Users/gzilavy/bbsbh-card-c2-followup/node_modules/playwright/index.mjs'
const tag = process.argv[2] || 'before'
const OUT = 'C:/Users/gzilavy/AppData/Local/Temp/claude/C--Users-gzilavy-bbsbh/e72f352d-32e1-4257-8d84-6b3d71989118/scratchpad/shots/'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 2 })
await p.goto('http://localhost:5171/favicon.ico')
for (const w of [739, 739.5, 740, 741]) {
  await p.setContent(`<body style="margin:0"><iframe id=f style="border:0;width:${w}px;height:1000px" src="http://localhost:5171/player/592885/history?nointro"></iframe></body>`)
  const fr = await (await p.$('#f')).contentFrame()
  await fr.waitForLoadState('networkidle', { timeout: 90000 }); await p.waitForTimeout(3000)
  const r = await fr.evaluate(() => {
    const blks = [...document.querySelectorAll('.awardblk')]
    return { iw: window.innerWidth, vw: document.documentElement.getBoundingClientRect().width, wide: matchMedia('(min-width: 740px)').matches, narrow: matchMedia('(max-width: 739.98px)').matches,
      awardsIsCard: document.querySelector('.awards')?.classList.contains('card'), blkCards: blks.filter(x => x.classList.contains('card')).length,
      dividers: blks.map(x => getComputedStyle(x).borderTopStyle) }
  })
  console.log(w, JSON.stringify(r))
  const el = await fr.$('.awards')
  if (el) { await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: `${OUT}${tag}-awards-${w}.png` }) }
}
// zoom: a 814px window at 110% is 740.0 CSS px; 925 at 125% is 740
for (const [win, z] of [[739, 1.1], [740, 1.1], [741, 1.1], [739, 1.25], [740, 1.25], [741, 1.25]]) {
  const c = await b.newContext({ viewport: { width: win, height: 1000 }, deviceScaleFactor: z })
  const q = await c.newPage()
  await q.goto('http://localhost:5171/player/592885/history?nointro', { waitUntil: 'networkidle', timeout: 90000 }); await q.waitForTimeout(2000)
  console.log('win', win, 'zoom', z, JSON.stringify(await q.evaluate(() => { const blks=[...document.querySelectorAll('.awardblk')]; return { iw: innerWidth, wide: matchMedia('(min-width: 740px)').matches, oneCard: document.querySelector('.awards')?.classList.contains('card'), tableCards: blks.filter(x=>x.classList.contains('card')).length, dividers: blks.map(x=>getComputedStyle(x).borderTopStyle).join(',') } })))
  const el = await q.$('.awards'); if (el) { await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: `${OUT}${tag}-awards-${win}-z${z}.png` }) }
  await c.close()
}
await b.close()
