// node pageshot.mjs <url#tab> <out.png> [w] [h] [full]
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const [url, out, w = '1440', h = '900', full = ''] = process.argv.slice(2)
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: +w, height: +h } })
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.type() + ': ' + m.text()))
await p.goto(url); await p.waitForTimeout(1500)
const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
await p.screenshot({ path: out, fullPage: !!full })
console.log('scrollWidth/innerWidth', sw.join('/'))
if (errs.length) console.log('ERRORS\n' + errs.slice(0, 12).join('\n'))
await b.close()
