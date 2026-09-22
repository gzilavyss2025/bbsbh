// Full-page screenshots at phone width, sliced into readable strips.
// page-shape.mjs prints the numbers; this is the instrument for LOOKING.
//
//   MSYS_NO_PATHCONV=1 PORT=5173 node .scratch/team-one-scroll/shoot.mjs out/ "/team/158" ...
import { chromium, devices } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const PORT = Number(process.env.PORT) || 5173
const BASE = `http://localhost:${PORT}`
const SLICE = Number(process.env.SLICE) || 1800
const outDir = process.argv[2]
mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()

for (const route of process.argv.slice(3)) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, browserName: 'chromium' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}${route}${route.includes('?') ? '&' : '?'}nointro`)
  await page.waitForFunction(() => !document.querySelector('.loader--route'), null, { timeout: 30_000 })
  await page.waitForTimeout(5000)
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.75))
    await page.waitForTimeout(120)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(2500)

  const h = await page.evaluate(() => document.body.scrollHeight)
  const slug = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  const n = Math.ceil(h / SLICE)
  for (let i = 0; i < n; i++) {
    const y = i * SLICE
    await page.screenshot({
      path: `${outDir}/${slug}-${String(i).padStart(2, '0')}.png`,
      clip: { x: 0, y, width: 390, height: Math.min(SLICE, h - y) },
      fullPage: true,
    })
  }
  console.log(`${route}  ${h}px -> ${n} slices`)
  await ctx.close()
}
await browser.close()
