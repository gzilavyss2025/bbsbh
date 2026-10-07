// Captures the live app's own markup for the console chrome at one state, so the
// round-4 mocks draw the real blocks (header, section tabs, half nav, band, trail,
// running line, reference chips/tabs, bottom bar). Needs `npm run dev` on 5173.
// node tools/capture.mjs <route> <taps> <name>
import { chromium } from '/home/user/bbsbh/node_modules/playwright/index.mjs'
import fs from 'node:fs'
const [,, route, taps, name, pk, through] = process.argv
// Pieces lifted out of .innings__stage; the rest of .screen is kept whole.
const SEL = { trail: '.trailstrip', rolling: 'section.rolling', upnext: '.upnext', prepitch: '.prepitch', dueup: '.dueup', summary: '.trailstrip__summarybtn' }
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const out = {}
for (const [cls, w, h] of [['phone', 390, 844], ['wide', 1180, 820]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  await p.addInitScript(([pk, t]) => { if (!sessionStorage.seeded) { localStorage.setItem('bbsbh:reveal:' + pk, t); sessionStorage.seeded = 1 } }, [pk, through])
  await p.goto('http://localhost:5173' + route + '?nointro', { waitUntil: 'load' })
  await p.waitForSelector('.pagenav--innings', { timeout: 30000 })
  await p.waitForTimeout(2500)
  for (let i = 0; i < +taps; i++) {
    await p.getByRole('button', { name: /next at-bat/i }).first().click()
    await p.waitForTimeout(1000)
  }
  await p.waitForTimeout(1500)
  out[cls] = await p.evaluate((SEL) => {
    const o = {}
    const scr = document.querySelector('.screen').cloneNode(true)
    scr.querySelectorAll('canvas').forEach((x) => x.remove())
    const stage = scr.querySelector('.innings__stage')
    for (const [k, s] of Object.entries(SEL)) {
      const el = stage.querySelector(s)
      if (el) o[k] = el.outerHTML
    }
    o.text = stage.innerText.slice(0, 300)
    stage.innerHTML = ''
    stage.id = 'r4stage'
    o.screen = scr.outerHTML
    return o
  }, SEL)
  console.log(cls, Object.keys(out[cls]).join(' '), '|', out[cls].text?.replace(/\n/g, ' / ').slice(0, 200))
  await p.close()
}
fs.mkdirSync(new URL('../mock/frag/', import.meta.url), { recursive: true })
fs.writeFileSync(new URL(`../mock/frag/${name}.json`, import.meta.url), JSON.stringify(out))
await b.close()
