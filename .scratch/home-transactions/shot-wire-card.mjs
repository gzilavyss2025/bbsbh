// Screenshots the home slate's roster-move card against the running dev
// server, at a phone and a desktop viewport, plus the expanded state. Used to
// check that the fitted-row measurement really does end on a whole row and
// still leaves a game card showing.
//
// Run: node .scratch/home-transactions/shot-wire-card.mjs [port]
import { chromium } from 'playwright'

const port = process.argv[2] ?? '5170'
const url = `http://localhost:${port}/?nointro`
const out = '.scratch/home-transactions'

const browser = await chromium.launch()

async function shoot(name, viewport, after) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const card = page.locator('.wirecard')
  try {
    await card.waitFor({ state: 'visible', timeout: 25_000 })
  } catch {
    console.log(`${name}: no .wirecard rendered`)
    await page.screenshot({ path: `${out}/${name}-nocard.png` })
    await page.close()
    return
  }
  await page.waitForTimeout(2500)
  if (after) await after(page)
  await page.screenshot({ path: `${out}/${name}.png` })

  const facts = await page.evaluate(() => {
    const card = document.querySelector('.wirecard')
    const list = document.querySelector('.wirecard__list')
    const rows = [...document.querySelectorAll('.wire__row')]
    const door = document.querySelector('.wirecard__door')
    const firstGame = document.querySelector('.gamelist > li')
    const listBox = list.getBoundingClientRect()
    const last = rows[rows.length - 1]?.getBoundingClientRect()
    return {
      rows: rows.length,
      door: door?.textContent?.trim() ?? null,
      cardBottom: Math.round(card.getBoundingClientRect().bottom),
      viewportH: window.innerHeight,
      lastRowClipped: last ? Math.round(last.bottom - listBox.bottom) : null,
      firstGameVisibleTop: firstGame
        ? Math.round(window.innerHeight - firstGame.getBoundingClientRect().top)
        : null,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
  console.log(`${name}  ${JSON.stringify(facts)}`)
  if (errors.length) console.log(`  console errors: ${errors.slice(0, 4).join(' | ')}`)
  await page.close()
}

await shoot('wire-phone', { width: 390, height: 844 })
await shoot('wire-phone-small', { width: 375, height: 667 })
await shoot('wire-desktop', { width: 1280, height: 900 })
await shoot('wire-expanded', { width: 390, height: 844 }, async (page) => {
  await page.locator('.wirecard__door').click()
  await page.waitForTimeout(400)
})

await browser.close()
