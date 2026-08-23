// A/B the scroll sheen: 5173 = origin/main as-is, 5172 = this worktree.
// The band is scroll-DRIVEN, so both are captured at the same scrollY with the
// same card in the same place on screen — otherwise the two phases differ and
// the comparison says nothing.
import { chromium, devices } from '/Users/garyzilavy/bbsbh/node_modules/playwright-core/index.mjs'

const OUT = '/private/tmp/claude-501/-Users-garyzilavy-bbsbh/275509d8-188c-4591-8826-7795468455e6/scratchpad'
const b = await chromium.launch()
for (const [port, tag] of [[5173, 'before'], [5172, 'after']]) {
  const ctx = await b.newContext({ ...devices['iPhone 14 Pro'] })
  const p = await ctx.newPage()
  await p.goto(`http://localhost:${port}/?nointro`, { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForTimeout(2500)
  for (const y of [520, 900]) {
    await p.evaluate((yy) => window.scrollTo(0, yy), y)
    await p.waitForTimeout(700)
    await p.screenshot({ path: `${OUT}/sheen-${tag}-${y}.png` })
  }
  await ctx.close()
}
await b.close()
console.log('ab shots written')
