// The COMPUTED card-head triad and type metrics, read off the running page,
// so the design canvas draws the colours the app actually paints rather than
// the ones a resolver is guessed to return.
//
//   MSYS_NO_PATHCONV=1 PORT=5173 node .scratch/team-one-scroll/computed.mjs "/team/158" ...
import { chromium, devices } from '@playwright/test'

const PORT = Number(process.env.PORT) || 5173
const browser = await chromium.launch()

for (const route of process.argv.slice(2)) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.goto(`http://localhost:${PORT}${route}${route.includes('?') ? '&' : '?'}nointro`)
  await page.waitForFunction(() => !document.querySelector('.loader--route'), null, { timeout: 30_000 })
  await page.waitForTimeout(4000)

  const out = await page.evaluate(() => {
    const pick = (el, props) => {
      if (!el) return null
      const c = getComputedStyle(el)
      return Object.fromEntries(props.map((p) => [p, c.getPropertyValue(p)]))
    }
    const box = ['background-color', 'color', 'border-bottom', 'padding', 'font-family', 'font-size', 'letter-spacing', 'font-weight']
    const head = document.querySelector('.thub-card__head')
    return {
      head: pick(head, box),
      headTitle: pick(head?.querySelector('span'), ['font-size', 'color']),
      headEm: pick(head?.querySelector('em'), ['font-size', 'color']),
      card: pick(document.querySelector('.thub-card'), ['background-color', 'border', 'border-radius', 'box-shadow', 'margin-top']),
      canvas: pick(document.querySelector('.team-hub') ?? document.body, ['background-color']),
      vars: Object.fromEntries(
        ['--bar-fill', '--bar-accent', '--bar-text', '--bg-canvas', '--surface-card']
          .map((v) => [v, getComputedStyle(document.querySelector('.team-hub') ?? document.documentElement).getPropertyValue(v).trim()]),
      ),
      themed: !!document.querySelector('.team-hub.is-themed'),
    }
  })
  console.log(`\n== ${route}`)
  console.log(JSON.stringify(out, null, 1))
  await ctx.close()
}
await browser.close()
