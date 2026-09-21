// Does a WINTER-BALL club's team page have a door into it from the app? Walks
// the real path a reader takes — slate, WINTER tab, a game, its result face —
// and clicks the club's own name, rather than reasoning about affiliates.json.
// TeamLink renders a <button class="plink">, not an <a>, so this clicks.
import { chromium, devices } from '@playwright/test'

const PORT = Number(process.env.PORT) || 5173
const BASE = `http://localhost:${PORT}`
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], browserName: 'chromium' })
const page = await ctx.newPage()

await page.goto(`${BASE}/${process.env.SLATE ?? '11152025'}?nointro`)
await page.waitForFunction(() => !document.querySelector('.loader--route'), null, { timeout: 30_000 })
await page.waitForTimeout(3000)

const levels = await page.evaluate(() =>
  [...document.querySelectorAll('.levelnav button, .levelnav a')].map((b) => b.textContent.trim()),
)
console.log('level rail:', JSON.stringify(levels))

const winterBtn = page.locator('.levelnav button, .levelnav a').filter({ hasText: /winter/i })
if (await winterBtn.count()) { await winterBtn.first().click(); await page.waitForTimeout(3500) }
console.log('winter game cards:', await page.locator('.gamecard').count())

// Reveal the day so the result face (and its TeamLinks) exist at all.
const revealAll = page.getByRole('button', { name: /Reveal all results/i })
if (await revealAll.count()) { await revealAll.first().click(); await page.waitForTimeout(3000) }
await page.locator('.gamecard').first().scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
await page.locator('.gamecard').first().click({ force: true })
await page.waitForTimeout(2500)

const link = page.locator('.plink').first()
const plinks = await page.evaluate(() =>
  [...document.querySelectorAll('.plink')].map((b) => b.textContent.trim()).filter(Boolean),
)
console.log('club-name buttons on the result face:', JSON.stringify(plinks.slice(0, 8)))

if (plinks.length) {
  await link.scrollIntoViewIfNeeded()
  await link.click({ force: true })
  await page.waitForTimeout(4000)
  console.log('LANDED AT:', page.url())
  console.log('tabs:', JSON.stringify(await page.evaluate(() =>
    [...document.querySelectorAll('.teamtabs__btn')].map((b) => b.textContent.trim()))))
  console.log('level badge:', JSON.stringify(await page.locator('.team-hub__level').textContent().catch(() => null)))
  console.log('parent chip:', JSON.stringify(await page.locator('.team-hub__parent').textContent().catch(() => null)))
  console.log('page height:', await page.evaluate(() => document.body.scrollHeight))
  console.log('body text under the tab bar:', JSON.stringify(await page.evaluate(() => {
    const bar = document.querySelector('.teamtabs')
    let t = ''
    for (let n = bar?.nextElementSibling; n; n = n.nextElementSibling) t += n.textContent.trim() + ' | '
    return t.slice(0, 400)
  })))
}
await browser.close()
