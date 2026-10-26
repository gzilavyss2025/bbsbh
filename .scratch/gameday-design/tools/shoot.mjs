// node shoot.mjs <harness url> <outprefix> <ab> <t1,t2,...> [w] [h]
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const [url, out, ab, ts, w = '390', h = '300'] = process.argv.slice(2)
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: +w, height: +h + 40 } })
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
await p.goto(url); await p.waitForFunction('window.ready === true', null, { timeout: 15000 })
for (const t of ts.split(',')) {
  const r = await p.evaluate(([a, t]) => window.renderAt(+a, +t), [ab, t])
  await p.waitForTimeout(50)
  await p.screenshot({ path: `${out}-${ab}-${t}.png`, clip: { x: 0, y: 0, width: +w, height: +h } })
  console.log(t, JSON.stringify(r))
}
if (errs.length) console.log('ERRORS', errs.join('\n'))
await b.close()
