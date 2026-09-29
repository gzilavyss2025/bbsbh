import { chromium } from 'file:///C:/Users/gzilavy/bbsbh-card-c2-followup/node_modules/playwright/index.mjs'
const tag = process.argv[2] || 'before'
const OUT = 'C:/Users/gzilavy/AppData/Local/Temp/claude/C--Users-gzilavy-bbsbh/e72f352d-32e1-4257-8d84-6b3d71989118/scratchpad/shots/'
const base = 'http://localhost:5171'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const sels = ['.milestonewatch', '.awards', '.posinn__diamond', '.vsteam__last', '.simlike__link', '.simlike']
for (const tab of ['', '/stats', '/analytics', '/history']) {
  await p.goto(base + '/player/592885' + tab + '?nointro', { waitUntil: 'networkidle', timeout: 90000 })
  await p.waitForTimeout(2500)
  const rep = await p.evaluate((sels) => {
    const out = {}
    for (const s of sels) {
      const els = [...document.querySelectorAll(s)]
      if (!els.length) continue
      out[s] = els.map(el => {
        const r = el.getBoundingClientRect()
        const over = [...el.querySelectorAll('*')].filter(d => {
          const q = d.getBoundingClientRect(); if (!q.width && !q.height) return false
          return q.left < r.left - 0.5 || q.right > r.right + 0.5 || q.top < r.top - 0.5 || q.bottom > r.bottom + 0.5
        }).map(d => (d.className?.baseVal ?? d.className) + ' ' + d.textContent.slice(0, 10))
        return { cls: el.className, overflow: getComputedStyle(el).overflow, over: over.slice(0, 8) }
      })
    }
    return out
  }, sels)
  console.log(tab || '/overview', JSON.stringify(rep))
  for (const s of ['.posinn__diamond', '.awards', '.milestonewatch', '.vsteam__last']) {
    const el = await p.$(s)
    if (el) { await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: `${OUT}${tag}-${s.slice(1)}${tab.replace('/', '-')}.png` }) }
  }
  const tiles = await p.$$('.simlike__link')
  if (tiles.length) {
    const grid = await p.$('.simlike')
    for (let i = 0; i < Math.min(tiles.length, 4); i++) {
      await tiles[i].focus(); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab')
      await tiles[i].scrollIntoViewIfNeeded()
      const box = await tiles[i].boundingBox()
      await p.screenshot({ path: `${OUT}${tag}-simlike-focus${i}.png`, clip: { x: Math.max(0, box.x - 12), y: box.y - 12, width: Math.min(390 - Math.max(0, box.x - 12), box.width + 24), height: box.height + 24 } })
    }
  }
}
await b.close()
