// The REAL content of the Standing band's cards, off the running page, so the
// design canvas draws real values rather than placeholder rows. Placeholders
// hide the crowding that is the whole problem in this band.
//
//   MSYS_NO_PATHCONV=1 PORT=5173 node .scratch/team-one-scroll/scrape-standing.mjs "/team/158/numbers"
import { chromium, devices } from '@playwright/test'

const PORT = Number(process.env.PORT) || 5173
const BASE = `http://localhost:${PORT}`
const browser = await chromium.launch()

for (const route of process.argv.slice(2)) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.goto(`${BASE}${route}${route.includes('?') ? '&' : '?'}nointro`)
  await page.waitForFunction(() => !document.querySelector('.loader--route'), null, { timeout: 30_000 })
  await page.waitForTimeout(5000)
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.75))
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(2500)

  const out = await page.evaluate(() => {
    const t = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
    const res = {}

    // Standings table
    const st = document.querySelector('.thub-card table, .standings table, table')
    res.standings = st
      ? [...st.querySelectorAll('tr')].map((r) => [...r.children].map((c) => t(c)))
      : null

    // Records card — every group label and every row, in document order
    const rec = document.querySelector('.trec')
    if (rec) {
      const walk = []
      const seen = new Set()
      rec.querySelectorAll('*').forEach((el) => {
        const cls = el.className?.baseVal ?? el.className ?? ''
        if (typeof cls !== 'string') return
        if (/__grouplabel|__group-label|__sectionlabel|__ghead/.test(cls) && !seen.has(el)) {
          seen.add(el); walk.push({ kind: 'group', text: t(el) })
        }
      })
      res.recGroupsByClass = walk
      // Fallback: every direct text node structure
      res.recText = t(rec).slice(0, 8000)
      res.recClasses = [...new Set([...rec.querySelectorAll('*')]
        .map((e) => (typeof e.className === 'string' ? e.className : ''))
        .filter(Boolean))].slice(0, 60)
      res.recHeight = Math.round(rec.getBoundingClientRect().height)
    }

    // Day of week + comebacks raw text
    const cards = [...document.querySelectorAll('.tstats-card')]
    res.tstats = cards.map((c) => ({
      cls: c.className,
      px: Math.round(c.getBoundingClientRect().height),
      text: t(c).slice(0, 1200),
    }))
    const g = (sel) => { const e = document.querySelector(sel); return e ? { px: Math.round(e.getBoundingClientRect().height), text: t(e).slice(0, 900) } : null }
    res.teamScore = g('.team-score')
    res.cbk = g('.cbk')
    return res
  })

  console.log(`\n=========== ${route} ===========`)
  console.log(JSON.stringify(out, null, 1).slice(0, 14000))
  await ctx.close()
}
await browser.close()
