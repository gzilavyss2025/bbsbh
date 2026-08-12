// Throwaway: render the poster and write a whole-sheet JPEG plus enlarged
// crops of each band, small enough to open and study. Detail that is invisible
// at thumbnail size — tracking, alignment, rule weights — is the whole point of
// the crops. Run with: node e2e/shots/poster-crops.mjs [route] [outDir] [tag]
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'

const route = process.argv[2] ?? '/08122026/milsd/preview'
const outDir = process.argv[3] ?? '.'
const tag = process.argv[4] ?? 'poster'
const port = process.env.E2E_PORT ?? '5173'

const BANDS = [
  { name: 'head', y: 0, h: 600 },
  { name: 'arms', y: 590, h: 260 },
  { name: 'order', y: 840, h: 420 },
  { name: 'bottom', y: 1240, h: 360 },
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}${route}?nointro`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.posterstudio__canvas', { timeout: 60000 })
await page.waitForSelector('.posterstudio__loading', { state: 'detached', timeout: 60000 })
await page.waitForTimeout(1500)

const shots = await page.evaluate((bands) => {
  const src = document.querySelector('.posterstudio__canvas')
  const draw = (sx, sy, sw, sh, dw, dh, quality) => {
    const c = document.createElement('canvas')
    c.width = dw
    c.height = dh
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, dw, dh)
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh)
    return c.toDataURL('image/jpeg', quality)
  }
  const out = { whole: draw(0, 0, 1200, 1600, 690, 920, 0.8) }
  for (const b of bands) out[b.name] = draw(0, b.y, 1200, b.h, 1000, Math.round((b.h / 1200) * 1000), 0.82)
  return out
}, BANDS)

for (const [name, dataUrl] of Object.entries(shots)) {
  const path = `${outDir}/${tag}-${name}.jpg`
  writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'))
  console.log('wrote', path)
}
await browser.close()
