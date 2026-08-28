import { chromium } from 'playwright'

const port = process.env.E2E_PORT ?? '5171'
const url = `http://localhost:${port}/abs-challenges?nointro`
const browser = await chromium.launch()

for (const [name, viewport] of [
  ['phone', { width: 390, height: 844 }],
  ['wide', { width: 1200, height: 1000 }],
]) {
  const page = await browser.newPage({ viewport })
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `.scratch/abs-challenges/${name}.png`, fullPage: true })
  const title = await page.textContent('.bcast__title').catch(() => null)
  const strand = await page.textContent('.bcast__strand').catch(() => null)
  const slabs = await page.$$eval('.slab__value', (n) => n.map((e) => e.textContent.trim()))
  const sections = await page.$$eval('.bcast-sec__title', (n) => n.map((e) => e.textContent.trim()))
  const rows = await page.$$eval('.rpt tbody tr', (n) => n.length)
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
  console.log(name, JSON.stringify({ title, strand, slabs, sections, rows, bodyWidth, viewport: viewport.width, errors }, null, 1))
  await page.close()
}
await browser.close()
