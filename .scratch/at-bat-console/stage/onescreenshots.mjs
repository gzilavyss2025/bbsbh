import { chromium } from '/home/user/bbsbh/node_modules/playwright/index.mjs'
const PAGE = 'file:///home/user/bbsbh/node_modules/.cache/innings-console/onescreen.html'
const [OUT, ...specs] = process.argv.slice(2) // spec: layout:g:half:n:t
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
for (const sp of specs) {
  const [lay, g, half, n, t, name] = sp.split(':')
  const p = await b.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 })
  p.on('pageerror', (e) => console.log('ERR', e.message))
  await p.addInitScript(([g, half, n]) => { const s = { view: 'H', g: +g, half: +half, n: +n }; for (const k in s) localStorage.setItem('ics2:' + k, JSON.stringify(s[k])) }, [g, half, n])
  await p.goto(`${PAGE}#${lay}`)
  await p.evaluate((t) => window.osPlay(+t), t)
  await p.locator('.phone').first().screenshot({ path: `${OUT}/${name}.png` })
  const m = await p.evaluate(() => { const s = document.querySelector('.os .screen'), o = document.querySelector('.osbody'); return { screen: s.getBoundingClientRect().height, bodyScroll: o.scrollHeight, bodyClient: o.clientHeight, stage: document.querySelector('.osstage').getBoundingClientRect().height } })
  console.log(name, JSON.stringify(m))
  await p.close()
}
await b.close()
