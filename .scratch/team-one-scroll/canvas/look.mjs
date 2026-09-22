// Renders an artboard at 390px and slices it, so the drawing is LOOKED AT
// rather than reasoned about. The .dc.html files are plain HTML apart from the
// <x-dc>/<helmet> wrapper and the support.js line, so they render as-is in a
// browser with those three tags treated as unknown elements — which is exactly
// what we want to judge: the markup inside them.
//
//   node .scratch/team-one-scroll/canvas/look.mjs <outDir> Main.dc.html ...
import { chromium } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const outDir = process.argv[2]
const SLICE = Number(process.env.SLICE) || 1700
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
for (const name of process.argv.slice(3)) {
  const src = readFileSync(join(HERE, 'project', name), 'utf8')
    // drop the runtime hook — nothing in these boards needs it to paint
    .replace('<script src="./support.js"></script>', '')
    .replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, '')
    .replace(/<\/?x-dc>/g, '')
    .replace(/<helmet>/, '')
    .replace(/<\/helmet>/, '')
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.setContent(src, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const h = await page.evaluate(() => document.body.scrollHeight)
  const slug = name.replace('.dc.html', '')
  const n = Math.ceil(h / SLICE)
  for (let i = 0; i < n; i++) {
    await page.screenshot({
      path: join(outDir, `${slug}-${String(i).padStart(2, '0')}.png`),
      clip: { x: 0, y: i * SLICE, width: 390, height: Math.min(SLICE, h - i * SLICE) },
      fullPage: true,
    })
  }
  console.log(`${name}  ${h}px -> ${n}`)
  await ctx.close()
}
await browser.close()
