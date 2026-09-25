// Slice 5 probe (#1131): which club hubs are themed, the bar colour behind the
// Standings card head, and where the two slice 5 controls render.
//   node .scratch/design-system/pill-collapse/s5/probe.mjs http://localhost:5173 [ids...]
import { chromium } from '@playwright/test'

const base = process.argv[2] || 'http://localhost:5171'
const ids = process.argv.slice(3).length ? process.argv.slice(3) : ['158', '138', '135', '147', '119', '109', '112', '133', '121', '556']
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })).newPage()
for (const id of ids) {
  await page.goto(`${base}/team/${id}${process.env.SUB || ""}?nointro`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(600)
  const r = await page.evaluate(() => {
    const hub = document.querySelector('.team-hub')
    const pills = [...document.querySelectorAll('.psodds-pill')].map((p) => {
      const head = p.closest('.thub-card__head')
      const cs = getComputedStyle(p)
      return {
        text: p.textContent.trim(),
        h: Math.round(p.getBoundingClientRect().height * 10) / 10,
        headH: head ? Math.round(head.getBoundingClientRect().height * 10) / 10 : null,
        headBg: head ? getComputedStyle(head).backgroundColor : null,
        fill: cs.backgroundColor,
        ink: cs.color,
        edge: cs.borderTopColor,
      }
    })
    return { cls: hub?.className, pills }
  })
  console.log(id, JSON.stringify(r))
}
await browser.close()
