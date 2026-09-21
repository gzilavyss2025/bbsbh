// WHAT EACH TEAM-HUB ROUTE ACTUALLY RENDERS, read off the live page rather
// than off the issue's inventory table. Prints, per route: the tab buttons the
// club gets, the level badge, the parent chip, every card/section heading in
// document order, and the page height at phone width.
//
// This is the instrument behind scope.md's per-club module lists. Reading a
// module list out of a tab component's JSX is not the same thing: half of
// these modules self-hide on empty data, and three of them self-fetch.
//
//   MSYS_NO_PATHCONV=1 node .scratch/team-one-scroll/page-shape.mjs "/team/158" ...
import { chromium, devices } from '@playwright/test'

const PORT = Number(process.env.PORT) || 5173
const BASE = `http://localhost:${PORT}`
const browser = await chromium.launch()

for (const route of process.argv.slice(2)) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], browserName: 'chromium' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}${route}${route.includes('?') ? '&' : '?'}nointro`)
  await page.waitForFunction(() => !document.querySelector('.loader--route'), null, { timeout: 30_000 })
  await page.waitForTimeout(6000)
  // Scroll the whole page so anything deferred behind an observer is drawn.
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.75))
    await page.waitForTimeout(150)
  }
  await page.waitForTimeout(3000)

  const shape = await page.evaluate(() => {
    const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
    const bar = document.querySelector('.teamtabs')
    const blocks = []
    for (let n = bar?.nextElementSibling; n; n = n.nextElementSibling) {
      if (n.classList.contains('asofbanner') || n.tagName === 'SCRIPT') continue
      const head = n.querySelector('h2, h3, .thub-card__head, .cardhead, .sectionhead, .ctr__tilelabel')
      blocks.push({
        cls: n.className || n.tagName.toLowerCase(),
        head: text(head).slice(0, 70),
        px: Math.round(n.getBoundingClientRect().height),
      })
    }
    return {
      tabs: [...document.querySelectorAll('.teamtabs__btn')].map((b) => text(b)),
      level: text(document.querySelector('.team-hub__level')) || null,
      parent: text(document.querySelector('.team-hub__parent')) || null,
      record: text(document.querySelector('.team-hub__rec')) || null,
      doors: [...document.querySelectorAll('.thub-door')].map((d) => text(d)),
      height: document.body.scrollHeight,
      blocks,
    }
  })

  console.log(`\n=============== ${route} ===============`)
  console.log(`tabs    : ${shape.tabs.join(' · ') || '(none)'}`)
  console.log(`level   : ${shape.level ?? '(none)'}    parent: ${shape.parent ?? '(none)'}`)
  console.log(`record  : ${shape.record ?? '(none)'}`)
  console.log(`height  : ${shape.height}px    blocks: ${shape.blocks.length}`)
  console.log(`doors   : ${shape.doors.join(' / ') || '(none)'}`)
  for (const b of shape.blocks) console.log(`   ${String(b.px).padStart(5)}px  ${b.head || '(no heading)'}   [${b.cls}]`)
  await ctx.close()
}
await browser.close()
