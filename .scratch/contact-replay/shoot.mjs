// Screenshots for the scene slice (#1771): node .scratch/contact-replay/shoot.mjs  (dev server on :5173)
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const OUT = new URL('./shots/', import.meta.url).pathname
// [file, route, batter, pitch no, contactMs (SLOW 3), totalMs]
const CASES = [
  ['ab01-grounder', '/10152026/millad/top1', 'Chourio', 1, 1132, 3568, 0],
  ['ab02-foul', '/10152026/millad/top1', 'Turang', 6, 1119, 2977, 6],
  ['ab02-whiff', '/10152026/millad/top1', 'Turang', 7, 1133, 2369, 7],
  ['ab16-homer', '/10152026/millad/bottom2', 'Ohtani', 3, 1161, 5256, 2],
]
const VIEWS = { phone: { width: 390, height: 844 }, wide: { width: 1280, height: 800 } }
const only = process.argv[2]
const steps = {}
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [vname, viewport] of Object.entries(VIEWS)) {
  for (const [name, route, batter, no, contactMs, totalMs, pickIdx] of CASES) {
    if (only && !name.includes(only)) continue
    console.log('>>', vname, name)
    const page = await (await browser.newContext({ viewport, deviceScaleFactor: vname === 'phone' ? 2 : 1 })).newPage()
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
    await page.addInitScript(() => localStorage.setItem('bbsbh:reveal:849810', '17'))
    await page.goto(`http://localhost:5173${route}?nointro`)
    await page.getByRole('button', { name: /Replay the pitches|next at-bat/i }).first().waitFor()
    // the half opens one at-bat at a time: step to this batter's card (the phone finds it by its Replay button)
    const mine = page.getByRole('button', { name: new RegExp(`Replay the pitches to ${batter}`, 'i') })
    if (vname === 'phone') {
      let n = 0
      for (; n < 12 && !(await mine.count()); n++) {
        await page.getByRole('button', { name: /next at-bat/i }).first().click()
        await page.waitForTimeout(1500)
      }
      steps[name] = n
    } else {
      for (let n = 0; n < steps[name]; n++) {
        await page.getByRole('button', { name: /next at-bat/i }).first().click()
        await page.waitForTimeout(1500)
      }
    }
    if (vname === 'phone') {
      await page.getByRole('button', { name: new RegExp(`Replay the pitches to ${batter}`, 'i') }).first().click()
      await page.getByRole('group', { name: 'Play a pitch' }).waitFor({ timeout: 5000 }).catch(async (e) => { await page.screenshot({ path: OUT + 'debug.png' }); throw e })
    } else {
      // wide: the card's pitch list row picks the pitch; the scene plays in the rail
      await page.locator('.pitchlist__pick').first().waitFor()
    }
    // phone: the sheet in the page; wide: the replay card in the rail
    const shot = (path) => (vname === 'phone' ? page.screenshot({ path }) : page.locator('.pbp__replay').first().screenshot({ path }))
    await page.clock.install()
    if (vname === 'phone') await page.getByRole('group', { name: 'Play a pitch' }).getByRole('button', { name: String(no), exact: true }).click()
    else await page.locator('.pitchlist__pick', { hasText: new RegExp(`^${no}$`) }).click()
    await page.mouse.move(1, 1) // a scroll under a resting mouse would hover (and play) another row
    await page.clock.runFor(contactMs - 300)
    const scene = page.locator('.pscene--replay').first()
    await scene.scrollIntoViewIfNeeded()
    await shot(`${OUT}${name}-${vname}-midswing.png`)
    await page.clock.runFor(totalMs + 200)
    await shot(`${OUT}${name}-${vname}-rest.png`)
    console.log(await scene.getAttribute('aria-label'))
    await page.close()
  }
}
await browser.close()
