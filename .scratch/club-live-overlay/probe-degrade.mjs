// Each leg on its own: block the static file, then block the wire, and check
// the club page still says something in both cases.
import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const url = 'http://localhost:5173/team/milwaukee-brewers-158/transactions?nointro'

for (const [label, pattern] of [
  ['static file blocked (live only)', '**/data/team-transactions/**'],
  ['wire blocked (file only)', '**/statsapi.mlb.com/api/v1/transactions**'],
  ['both blocked', null],
]) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  if (pattern) await page.route(pattern, (r) => r.abort())
  else {
    await page.route('**/data/team-transactions/**', (r) => r.abort())
    await page.route('**/statsapi.mlb.com/api/v1/transactions**', (r) => r.abort())
  }
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  const days = await page.locator('.txpage__day').count()
  const cards = await page.locator('.txstory').count()
  const empty = await page.locator('.txpage__empty').count()
  const dates = (await page.locator('.txpage__dateline').allInnerTexts()).slice(0, 3).map((t) => t.replace(/\n/g, ' '))
  console.log(`${label}: ${days} days, ${cards} cards, empty-state=${empty > 0}`)
  if (dates.length) console.log('   newest:', dates.join(' | '))
  await page.close()
}
await browser.close()
