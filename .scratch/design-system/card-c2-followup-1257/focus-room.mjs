import { chromium } from 'file:///C:/Users/gzilavy/bbsbh-card-c2-followup/node_modules/playwright/index.mjs'
const b = await chromium.launch()
for (const w of [320, 390]) {
const p = await b.newPage({ viewport: { width: w, height: 844 } })
for (const tab of ['', '/stats', '/analytics', '/history']) {
  await p.goto('http://localhost:5171/player/592885' + tab + '?nointro', { waitUntil: 'networkidle', timeout: 90000 })
  await p.waitForTimeout(2000)
  // open the awards index so its controls exist too
  const more = p.locator('.awards__expand'); if (await more.count()) await more.click()
  const els = await p.$$('.milestonewatch a, .milestonewatch button, .awards a, .awards button, .posinn__diamond a, .posinn__diamond button, .vsteam__last a, .vsteam__last button, .simlike__link a, .simlike__link button')
  for (const el of els) {
    await el.focus(); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab')
    const r = await el.evaluate(e => {
      const host = e.closest('.card'); const a = e.getBoundingClientRect(), h = host.getBoundingClientRect()
      const cs = getComputedStyle(e); const ext = cs.outlineStyle === 'none' ? 0 : parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset)
      const room = Math.min(a.left - h.left, h.right - a.right, a.top - h.top, h.bottom - a.bottom)
      return { host: host.className, el: e.className || e.tagName, focused: document.activeElement === e, ext, room: Math.round(room * 10) / 10 }
    })
    if (r.ext > r.room) console.log(w, tab, 'CLIPPED', JSON.stringify(r))
    else console.log(w, tab, 'ok', r.el, r.ext, r.room)
  }
}
await p.close()
}
await b.close()
