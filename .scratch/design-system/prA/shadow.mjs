// Verify --shadow-raised on the surfaces that actually WEAR it, and locate the
// paper fold's one visible sliver on the slate.
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
const PORT = process.env.E2E_PORT || 5173
const OUT = '.scratch/design-system/prA/shots/'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

// --- 1. Where on the slate does the paper fold show? ---
await page.goto(`http://localhost:${PORT}/?nointro`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const a = await page.screenshot()
const h = await page.addStyleTag({ content: ':root { --paper-1: #F3ECD8; }' })
await page.waitForTimeout(300)
const b = await page.screenshot()
await h.evaluate((n) => n.remove())
const box = await page.evaluate(async ([aSrc, bSrc]) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s })
  const [ia, ib] = await Promise.all([load(aSrc), load(bSrc)])
  const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height
  const x = c.getContext('2d', { willReadFrequently: true })
  x.drawImage(ia, 0, 0); const A = x.getImageData(0,0,c.width,c.height).data
  x.clearRect(0,0,c.width,c.height); x.drawImage(ib, 0, 0); const B = x.getImageData(0,0,c.width,c.height).data
  let x0=1e9,y0=1e9,x1=-1,y1=-1
  for (let p=0;p<A.length;p+=4){ const d=Math.max(Math.abs(A[p]-B[p]),Math.abs(A[p+1]-B[p+1]),Math.abs(A[p+2]-B[p+2]))
    if(d>0){ const i=p/4, px=i%c.width, py=(i/c.width)|0; if(px<x0)x0=px; if(px>x1)x1=px; if(py<y0)y0=py; if(py>y1)y1=py } }
  return x1<0 ? null : { x0, y0, x1, y1, dpr: c.width/390 }
}, ['data:image/png;base64,'+a.toString('base64'), 'data:image/png;base64,'+b.toString('base64')])
console.log('paper fold, slate — changed-pixel bounding box (CSS px):',
  box ? { x: Math.round(box.x0/box.dpr), y: Math.round(box.y0/box.dpr), w: Math.round((box.x1-box.x0)/box.dpr), h: Math.round((box.y1-box.y0)/box.dpr) } : 'none')
if (box) {
  const el = await page.evaluate(([cx, cy]) => {
    const e = document.elementFromPoint(cx, cy)
    return e ? `${e.tagName.toLowerCase()}.${(e.className||'').toString().split(' ').filter(Boolean).join('.')}` : null
  }, [Math.round((box.x0+box.x1)/2/box.dpr), Math.round((box.y0+box.y1)/2/box.dpr)])
  console.log('  element at its centre:', el)
}

// --- 2. --shadow-raised, on things that wear it ---
const OLD_SHADOW = '0 2px 4px rgba(22,34,47,0.10), 0 8px 24px rgba(22,34,47,0.10)'
async function shot(name, url, prep) {
  await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  if (prep) { try { await prep() } catch (e) { console.log(`  (${name}: prep failed — ${e.message.split('\n')[0]})`) } }
  await page.waitForTimeout(600)
  writeFileSync(`${OUT}shadow-${name}-new.png`, await page.screenshot())
  const hh = await page.addStyleTag({ content: `:root { --shadow-raised: ${OLD_SHADOW}; }` })
  await page.waitForTimeout(350)
  writeFileSync(`${OUT}shadow-${name}-old.png`, await page.screenshot())
  await hh.evaluate((n) => n.remove())
  const n = await page.evaluate(() => {
    const out = []
    for (const e of document.querySelectorAll('*')) {
      const s = getComputedStyle(e)
      if (s.boxShadow && s.boxShadow.includes('12px 28px')) out.push(e.className || e.tagName)
    }
    return out.slice(0, 6)
  })
  console.log(`  ${name}: elements now carrying the raised shadow ->`, n.length ? n : 'NONE VISIBLE')
}
console.log('\n--shadow-raised surfaces:')
await shot('logbook', '/logbook?nointro')
await shot('gamehud', '/?nointro', async () => { await page.locator('.gamecard, .slatecard, a[href^="/game/"]').first().click(); await page.waitForTimeout(2500) })
await shot('search', '/?nointro', async () => { await page.locator('button[aria-label*="earch" i], .sitebar__search, [class*="search"]').first().click(); await page.waitForTimeout(900) })
await browser.close()
