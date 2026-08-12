// Throwaway visual harness: render the preview poster and write the CANVAS
// bytes to disk, so what gets reviewed is the actual exported PNG rather than a
// screenshot of the page around it. Run with:
//   node e2e/shots/poster-shot.mjs [route] [outfile]
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'

const route = process.argv[2] ?? '/08122026/milsd/preview'
const out = process.argv[3] ?? 'poster.png'
const port = process.env.E2E_PORT ?? '5173'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } })
page.on('console', (m) => m.type() === 'error' && console.log('PAGE ERROR:', m.text()))
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message, '\n', e.stack))
await page.goto(`http://localhost:${port}${route}?nointro`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.posterstudio__canvas', { timeout: 30000 })
// The poster paints once art + fonts land; wait for the loading veil to go.
await page.waitForSelector('.posterstudio__loading', { state: 'detached', timeout: 30000 })
await page.waitForTimeout(1200)

const dataUrl = await page.evaluate(() => document.querySelector('.posterstudio__canvas').toDataURL('image/png'))
writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'))
// A downscaled JPEG beside it, small enough to open and eyeball quickly.
const preview = await page.evaluate(() => {
  const src = document.querySelector('.posterstudio__canvas')
  const c = document.createElement('canvas')
  c.width = 660
  c.height = 880
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.82)
})
writeFileSync(out.replace(/\.png$/, '-small.jpg'), Buffer.from(preview.split(',')[1], 'base64'))
console.log('wrote', out, 'from', route)
await browser.close()
