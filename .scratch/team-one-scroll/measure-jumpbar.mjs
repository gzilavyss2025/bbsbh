// HOW WIDE IS A JUMP BAR OF BAND NAMES, in the SHIPPED control?
//
// The band names go into real `.teamtabs__btn` buttons on the running page, so
// the widths are the ones the app's own font, padding, border and
// letter-spacing produce — not a per-character estimate. The first version of
// the Phase 2 jump-bar board printed an estimate under the heading "measured,
// not assumed", and the drawing clipped where the arithmetic said it fitted.
//
//   MSYS_NO_PATHCONV=1 PORT=5173 node .scratch/team-one-scroll/measure-jumpbar.mjs
import { chromium, devices } from '@playwright/test'

const PORT = Number(process.env.PORT) || 5173
const BANDS = {
  '/team/158': ['Standing', 'Ranks', 'Games', 'Roster', 'Farm', 'Money', 'About'],
  '/team/249': ['Standing', 'Ranks', 'Games', 'Roster', 'Farm', 'About'],
  '/team/675?d=2026-01-15': ['Standing', 'Ranks', 'Games', 'Roster', 'About'],
}

const b = await chromium.launch()
for (const [route, names] of Object.entries(BANDS)) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  await p.goto(`http://localhost:${PORT}${route}${route.includes('?') ? '&' : '?'}nointro`)
  await p.waitForFunction(() => !document.querySelector('.loader--route'), null, { timeout: 30_000 })
  await p.waitForTimeout(4000)
  const out = await p.evaluate((band) => {
    const bar = document.querySelector('.teamtabs')
    const row = document.querySelector('.teamtabs__row')
    const proto = document.querySelector('.teamtabs__btn')
    if (!bar || !row || !proto) return null
    const today = { room: bar.clientWidth, pills: bar.scrollWidth }
    // Swap the tab buttons for one per band, in the same control.
    const made = band.map((n) => { const c = proto.cloneNode(true); c.textContent = n; return c })
    row.replaceChildren(...made)
    // flex:1 0 auto stretches a bar that fits, so the natural width is read
    // with the stretch switched off.
    made.forEach((c) => { c.style.flex = '0 0 auto' })
    const each = made.map((c) => [c.textContent, Math.round(c.getBoundingClientRect().width)])
    return {
      today, room: bar.clientWidth, pills: bar.scrollWidth,
      each, fits: bar.scrollWidth <= bar.clientWidth + 1, height: Math.round(proto.getBoundingClientRect().height),
    }
  }, names)
  console.log(`\n== ${route}  (${names.length} bands)`)
  console.log(`   today : ${out.today.pills}px of tabs in ${out.today.room}px of room`)
  console.log(`   bands : ${out.pills}px of pills in ${out.room}px  ->  ${out.fits ? 'FITS' : `overflows by ${out.pills - out.room}px`}`)
  console.log(`   height: ${out.height}px     ${out.each.map(([n, w]) => `${n} ${w}`).join(' · ')}`)
  await ctx.close()
}
await b.close()
