// Render named cases: CASES='[[...]]' node .scratch/contact-replay/shoot-cases.mjs  (dev server on :5173). Phone, rest frame of one pitch.
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const OUT = new URL('./shots/', import.meta.url).pathname
// [name, gamePk, date MMDDYYYY, matchup, half, batter regex, pitch no (or 0 = last)]
const CASES = JSON.parse(process.env.CASES)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [name, pk, date, matchup, half, batter, pitch] of CASES) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  await page.addInitScript((k) => localStorage.setItem(`bbsbh:reveal:${k}`, '40'), pk)
  await page.goto(`http://localhost:5173/${date}/${matchup}/${half}?nointro`)
  await page.getByRole('button', { name: /Replay the pitches|next at-bat/i }).first().waitFor({ timeout: 30000 })
  const mine = page.getByRole('button', { name: new RegExp(`Replay the pitches to ${batter}`, 'i') })
  let n = 0
  for (; n < 14 && !(await mine.count()); n++) { await page.getByRole('button', { name: /next at-bat/i }).first().click(); await page.waitForTimeout(1200) }
  if (!(await mine.count())) { console.log(name, 'NOT FOUND'); await page.close(); continue }
  await mine.first().click()
  await page.getByRole('group', { name: 'Play a pitch' }).waitFor()
  if (pitch) { await page.getByRole('group', { name: 'Play a pitch' }).getByRole('button', { name: String(pitch), exact: true }).click(); await page.waitForTimeout(5000) } else await page.waitForTimeout(4500)
  const q = (await page.locator('.pqual').first().innerText()).replace(/\n/g, ' | ')
  const sv = await page.locator('.pside__title').first().textContent()
  await page.screenshot({ path: `${OUT}${name}.png` })
  console.log(name, '::', q, '::', sv)
  await page.close()
}
await browser.close()
