// Measures the SHIPPED Records card piece by piece, so the proposal's numbers
// are a comparison rather than an assertion. Prints the card total, the two
// control rows, and every group's own height with its row count.
//
//   MSYS_NO_PATHCONV=1 PORT=5173 node .scratch/team-one-scroll/canvas/records/measure-shipped.mjs 158 249
import { chromium, devices } from '@playwright/test'

const PORT = Number(process.env.PORT) || 5173
const BASE = `http://localhost:${PORT}`
const browser = await chromium.launch()

for (const id of process.argv.slice(2)) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], browserName: 'chromium' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/team/${id}/numbers?nointro`)
  await page.waitForFunction(() => !document.querySelector('.loader--route'), null, { timeout: 30_000 })
  await page.waitForTimeout(4000)
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.75))
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(2000)

  const out = await page.evaluate(() => {
    const h = (el) => (el ? Math.round(el.getBoundingClientRect().height) : null)
    const t = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
    const card = document.querySelector('.trec')
    if (!card) return { missing: true }
    const groups = [...card.querySelectorAll('.trec__group')].map((g) => ({
      name: t(g.querySelector('.trec__grouphead')),
      px: h(g),
      rows: g.querySelectorAll('.tstatrow').length,
      counts: g.querySelectorAll('.trec__count').length,
      cells: g.querySelectorAll('.trecinn__cell').length,
    }))
    return {
      total: h(card),
      head: h(card.querySelector('.tstats-card__head')),
      halves: h(card.querySelector('.trec__halves:not(.trec__months)')),
      months: h(card.querySelector('.trec__months')),
      body: h(card.querySelector('.tstats-card__body')),
      rowPx: h(card.querySelector('.tstatrow')),
      groups,
    }
  })
  console.log(`\n===== /team/${id}/numbers  Records =====`)
  if (out.missing) { console.log('  no .trec on the page'); await ctx.close(); continue }
  console.log(`  card total   ${out.total}px`)
  console.log(`  head         ${out.head}px   halves ${out.halves}px   months ${out.months}px   body ${out.body}px`)
  console.log(`  one row      ${out.rowPx}px`)
  let sum = 0
  for (const g of out.groups) {
    sum += g.px
    const what = g.cells ? `${g.cells} inning cells` : g.counts ? `${g.counts} counts` : `${g.rows} rows`
    console.log(`   ${String(g.px).padStart(5)}px  ${g.name.padEnd(22)} ${what}`)
  }
  console.log(`  groups sum   ${sum}px`)
  await ctx.close()
}
await browser.close()
