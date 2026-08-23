// Renders every artboard to PNG + a downscaled JPEG you can actually Read.
// Standalone: <x-dc>/<helmet> are unknown inline elements and support.js 404s,
// but the markup and CSS inside are plain HTML, so this is faithful enough to
// judge layout, colour and type on.
//
//   node render-all.mjs [outDir]
//
// Writes <outDir>/r-<Name>.png and, for the Opening artboard, six frames
// sampled across its 5.4s loop (r-Opening-0 … r-Opening-5).
import { chromium } from '/Users/garyzilavy/bbsbh/node_modules/playwright-core/index.mjs'
import { createServer } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import { extname, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const OUT = process.argv[2] || DIR
const TYPES = { '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json' }

const server = createServer(async (req, res) => {
  try {
    const body = await readFile(join(DIR, decodeURIComponent(req.url.split('?')[0])))
    res.writeHead(200, { 'content-type': TYPES[extname(req.url)] || 'text/plain' })
    res.end(body)
  } catch { res.writeHead(404).end() }
})
await new Promise((r) => server.listen(4331, r))

const canvas = JSON.parse(await readFile(join(DIR, 'canvas.json'), 'utf8'))
const frames = Object.fromEntries(canvas.artboards.map((a) => [a.file, [a.w, a.h, a.page, a.title]]))
const files = (await readdir(DIR)).filter((f) => f.endsWith('.dc.html'))

const b = await chromium.launch()
for (const f of files) {
  const [w, h, page, title] = frames[f] || [390, 844, '?', '?']
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  // support.js is expected to 404 here — the editor swaps it for an inline
  // runtime at render time, so its absence standalone is not a finding.
  const errs = []
  p.on('requestfailed', () => {})
  p.on('response', (r) => {
    if (r.status() === 404 && !r.url().endsWith('support.js')) errs.push(`404 ${r.url()}`)
  })
  p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto(`http://localhost:4331/${f}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(900)
  const name = f.replace('.dc.html', '')
  // Content height vs frame height: over = clipped by the artboard frame,
  // under = dead space painting the artboard background.
  const ch = await p.evaluate(() => Math.round(document.querySelector('x-dc > div').getBoundingClientRect().height))
  console.log(`${name.padEnd(10)} page=${page} frame=${w}x${h} content=${ch}px ${ch > h ? `(CLIPS ${ch - h}px)` : ch < h - 8 ? `(${h - ch}px SPARE)` : '(fits)'} "${title}"${errs.length ? ' ERRORS: ' + errs.join(' | ') : ''}`)
  if (name === 'Opening') {
    for (const [i, t] of [120, 330, 430, 560, 760, 1800].entries()) {
      await p.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms }), t)
      await p.waitForTimeout(120)
      await p.screenshot({ path: join(OUT, `r-Opening-${i}.png`) })
    }
  } else {
    await p.screenshot({ path: join(OUT, `r-${name}.png`) })
  }
  await ctx.close()
}
await b.close()
server.close()
console.log('\nPNGs are 2x — downscale before reading them, e.g.:')
console.log(`  for f in ${OUT}/r-*.png; do sips -Z 800 --setProperty format jpeg "$f" --out "\${f%.png}.jpg"; done`)
