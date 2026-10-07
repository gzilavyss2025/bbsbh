import { chromium } from '/home/user/bbsbh/node_modules/playwright/index.mjs'
const PAGE = 'file:///home/user/bbsbh/node_modules/.cache/innings-console/onescreen.html'
const [OUT, lay, g, half, n, end, step, sel, name] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const p = await b.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 })
await p.addInitScript(([g, half, n]) => { const s = { view: 'H', g: +g, half: +half, n: +n }; for (const k in s) localStorage.setItem('ics2:' + k, JSON.stringify(s[k])) }, [g, half, n])
await p.goto(`${PAGE}#${lay}`)
let i = 0
for (let t = 0; t <= +end; t += +step, i++) { await p.evaluate((t) => window.osPlay(t), t); await p.locator(sel).first().screenshot({ path: `${OUT}/${name}-${String(i).padStart(3, '0')}.png` }) }
await b.close()
