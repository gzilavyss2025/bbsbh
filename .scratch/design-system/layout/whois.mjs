// usage: node whois.mjs <route> '<path from a geom.mjs diff>'   prints the element's classes and ancestors' classes
import { chromium } from 'playwright-core'
const [route, path] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 390, height: 900 } })
await p.goto(`${process.env.BASE || 'http://localhost:5173'}${route}?nointro`, { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
console.log(await p.evaluate((path) => {
  let e = document.querySelector('#root')
  for (const seg of path.split('>')) { const [, t, i] = seg.match(/^(\w+)\[(\d+)\]$/); e = e.children[+i] }
  const out = []
  for (let n = e; n && n.id !== 'root'; n = n.parentElement) out.push(`${n.tagName.toLowerCase()}.${n.className || ''}`)
  return out.join('\n  < ') + '\ntext: ' + e.textContent.slice(0, 60)
}, path))
await b.close()
