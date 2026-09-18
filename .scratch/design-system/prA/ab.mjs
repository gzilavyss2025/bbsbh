// A/B the three PR A token calls IN the live page: override each token back to
// its pre-#1128 value, shoot, drop the override, shoot, diff the pixels.
// Isolates one token at a time with no rebuild in between. The diff runs in a
// canvas inside the browser, so this needs no image dependency.
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'

const PORT = process.env.E2E_PORT || 5173
const OUT = process.env.OUT_DIR || '.scratch/design-system/prA/shots/'
mkdirSync(OUT, { recursive: true })

const OLD = {
  paper: '--paper-1: #F3ECD8;',
  ink: '--ink-0: #16222F;',
  shadow: '--shadow-raised: 0 2px 4px rgba(22,34,47,0.10), 0 8px 24px rgba(22,34,47,0.10);',
}
const ROUTES = [
  { name: 'slate', url: '/?nointro' },
  { name: 'standings', url: '/standings?nointro' },
  { name: 'team-hub', url: '/team/158?nointro' },
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

const diffInPage = (a, b) => page.evaluate(async ([aSrc, bSrc]) => {
  const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src })
  const [ia, ib] = await Promise.all([load(aSrc), load(bSrc)])
  if (ia.width !== ib.width || ia.height !== ib.height) return { changed: -1, total: -1, maxDelta: -1 }
  const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height
  const x = c.getContext('2d', { willReadFrequently: true })
  x.drawImage(ia, 0, 0); const A = x.getImageData(0, 0, c.width, c.height).data
  x.clearRect(0, 0, c.width, c.height)
  x.drawImage(ib, 0, 0); const B = x.getImageData(0, 0, c.width, c.height).data
  let changed = 0, maxDelta = 0
  for (let i = 0; i < A.length; i += 4) {
    const d = Math.max(Math.abs(A[i]-B[i]), Math.abs(A[i+1]-B[i+1]), Math.abs(A[i+2]-B[i+2]))
    if (d > 0) changed++
    if (d > maxDelta) maxDelta = d
  }
  return { changed, total: c.width * c.height, maxDelta }
}, [a, b])

for (const r of ROUTES) {
  await page.goto(`http://localhost:${PORT}${r.url}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const neu = await page.screenshot()
  writeFileSync(`${OUT}${r.name}-new.png`, neu)
  const neuSrc = 'data:image/png;base64,' + neu.toString('base64')

  for (const [key, decl] of Object.entries(OLD)) {
    const handle = await page.addStyleTag({ content: `:root { ${decl} }` })
    await page.waitForTimeout(350)
    const old = await page.screenshot()
    writeFileSync(`${OUT}${r.name}-old-${key}.png`, old)
    const d = await diffInPage(neuSrc, 'data:image/png;base64,' + old.toString('base64'))
    const pct = d.total > 0 ? (100 * d.changed / d.total).toFixed(2) : '?'
    console.log(`${r.name.padEnd(10)} ${key.padEnd(7)} changed ${pct.padStart(6)}%  max channel delta ${d.maxDelta}`)
    await handle.evaluate((n) => n.remove())
    await page.waitForTimeout(250)
  }
  console.log('')
}
await browser.close()
