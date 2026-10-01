// Dump the geometry of every element under #root (or body) on a route, at two
// widths, so a markup/CSS migration that must change nothing can be diffed.
// usage: node .scratch/design-system/layout/geom.mjs <out.json> <route> [<route>...]
// env: BASE (default http://localhost:5173), CHROMIUM (default /opt/pw-browsers/chromium)
// Run it before and after a migration, then diff with diffgeom.mjs. It is the
// substitute for `npm run visual` (which runs only when Gary asks) for a change
// that must move nothing: every element's rect and layout style, at 390 and 760.
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'
const [out, ...routes] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' })
const res = {}
for (const route of routes) {
  for (const w of [390, 760]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } })
    await p.goto(`${process.env.BASE || 'http://localhost:5173'}${route}${route.includes('?') ? '&' : '?'}nointro`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(800)
    // open every details/accordion-free page as is; just measure
    res[`${route}@${w}`] = await p.evaluate(() => {
      const root = document.querySelector('#root') || document.body
      const path = (e) => {
        const parts = []
        for (let n = e; n && n !== root; n = n.parentElement) {
          const i = [...n.parentElement.children].indexOf(n)
          parts.unshift(`${n.tagName.toLowerCase()}[${i}]`)
        }
        return parts.join('>')
      }
      const out = []
      for (const e of root.querySelectorAll('*')) {
        const r = e.getBoundingClientRect()
        const cs = getComputedStyle(e)
        out.push([path(e), Math.round(r.left * 10) / 10, Math.round((r.top + scrollY) * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10,
          cs.display, cs.flexDirection, cs.rowGap, cs.columnGap, cs.minWidth, cs.flexWrap])
      }
      return { count: out.length, h: document.documentElement.scrollHeight, els: out }
    })
    await p.close()
  }
}
writeFileSync(out, JSON.stringify(res))
for (const [k, v] of Object.entries(res)) console.log(k, 'elements', v.count, 'height', v.h)
await b.close()
