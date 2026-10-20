// Quality-line notes screenshots (#1771 later pass): node .scratch/contact-replay/shoot-b.mjs  (dev server on :5173). Replay at rest.
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const OUT = new URL('./shots/', import.meta.url).pathname
const CASES = [['notes3-blast-chourio', '/10152026/millad/top1', 'Chourio'], ['notes3-blast-ohtani', '/10152026/millad/bottom2', 'Ohtani']]
const VIEWS = { phone: { width: 390, height: 844 } }
const steps = {}
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [vname, viewport] of Object.entries(VIEWS)) {
  for (const [name, route, batter] of CASES) {
    const page = await (await browser.newContext({ viewport, deviceScaleFactor: vname === 'phone' ? 2 : 1 })).newPage()
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
    await page.addInitScript(() => localStorage.setItem('bbsbh:reveal:849810', '17'))
    await page.goto(`http://localhost:5173${route}?nointro`)
    await page.getByRole('button', { name: /Replay the pitches|next at-bat/i }).first().waitFor()
    const mine = page.getByRole('button', { name: new RegExp(`Replay the pitches to ${batter}`, 'i') })
    if (vname === 'phone') {
      let n = 0
      for (; n < 12 && !(await mine.count()); n++) { await page.getByRole('button', { name: /next at-bat/i }).first().click(); await page.waitForTimeout(1500) }
      steps[name] = n
      await mine.first().click()
      await page.getByRole('group', { name: 'Play a pitch' }).waitFor()
    } else {
      for (let n = 0; n < steps[name]; n++) { await page.getByRole('button', { name: /next at-bat/i }).first().click(); await page.waitForTimeout(1500) }
      await page.locator('.pitchlist__pick').first().waitFor()
    }
    await page.waitForTimeout(4000) // /gf lands
    const scene = page.locator('.pscene--replay').first()
    await scene.scrollIntoViewIfNeeded()
    const path = `${OUT}${name}-${vname}-rest.png`
    if (vname === 'phone') await page.screenshot({ path }); else { await page.locator('.pqual').first().evaluate((e) => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300); await page.screenshot({ path }) }
    if (process.env.CHAIN) console.log(await page.evaluate(() => { let el = [...document.querySelectorAll('.pqual__num')].find((e) => e.textContent.includes(' of ')); const c = []; for (; el; el = el.parentElement) c.push(el.tagName + '.' + el.className + ':' + getComputedStyle(el).textTransform); const el0 = [...document.querySelectorAll('.pqual__num')].find((e) => e.textContent.includes(' of ')); const r = []; const walk = (rules) => { for (const x of rules) { if (x.cssRules && !x.selectorText) walk(x.cssRules); else if (x.style?.textTransform && el0?.matches(x.selectorText)) r.push(x.selectorText + '=' + x.style.textTransform) } }; for (const sh of document.styleSheets) walk(sh.cssRules); return [c.slice(0, 2), r] }))
    console.log(name, vname, (await page.locator('.pqual').first().innerText()).replace(/\n/g, ' | '))
    await page.close()
  }
}
await browser.close()
