// Dump the geometry of every element under #root (or body) on a route, at two
// widths, so a markup/CSS migration that must change nothing can be diffed.
// usage: node .scratch/design-system/layout/geom.mjs <out.json> <route> [<route>...]
// env: BASE (default http://localhost:5173), CHROMIUM (default /opt/pw-browsers/chromium)
//      MOCK=1   serve the anchor game (823035) from e2e/fixtures/mock-api.js, offline
//      LS='{"bbsbh:reveal:823035":"99"}'   localStorage entries set before the page loads
//      STEPS='[{"tab":"Arms"},{"clickAll":".abs__rowbtn:not([disabled])"}]'   clicks to reach a state
//      a step can also be {"clickText":"Find a past"}: click the first button whose name matches
//      FREEZE=1 turns animations and transitions off in the captured page, for a route that animates
//      (two runs of /animation-lab differ without it); both runs of a pair must use it
//      BLOCKIMG=1 aborts every image request, so an <img> ends in the same state on every run
//      (a logo that races its fallback makes two runs of unchanged code differ)
//      CLASSES='a,b'   also print how many elements of each class the route drew
// Run it before and after a migration, then diff with diffgeom.mjs. It is the
// substitute for `npm run visual` (which runs only when Gary asks) for a change
// that must move nothing: every element's rect and layout style, at 390 and 760.
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'
const [out, ...routes] = process.argv.slice(2)
const mock = process.env.MOCK ? (await import(new URL('../../../e2e/fixtures/mock-api.js', import.meta.url))).installMockApi : null
const ls = process.env.LS ? JSON.parse(process.env.LS) : null
const steps = process.env.STEPS ? JSON.parse(process.env.STEPS) : []
const classes = (process.env.CLASSES || '').split(',').filter(Boolean)
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' })
const res = {}
for (const route of routes) {
  for (const w of [390, 760]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } })
    if (mock) await mock(p)
    if (process.env.BLOCKIMG) await p.route('**/*', (r) => (r.request().resourceType() === 'image' && !r.request().url().startsWith('data:') ? r.abort() : r.fallback()))
    if (ls) await p.addInitScript((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v) }, ls)
    await p.goto(`${process.env.BASE || 'http://localhost:5173'}${route}${route.includes('?') ? '&' : '?'}nointro`, { waitUntil: 'networkidle' })
    if (process.env.FREEZE) await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
    await p.waitForTimeout(800)
    if (process.env.BLOCKIMG) { await p.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(600) }
    for (const st of steps) {
      if (st.tab) await p.getByRole('tab', { name: new RegExp(st.tab, 'i') }).first().click().catch(() => {})
      if (st.clickText) await p.getByRole('button', { name: new RegExp(st.clickText, 'i') }).first().click().catch(() => {})
      if (st.clickAll) await p.evaluate((sel) => document.querySelectorAll(sel).forEach((e) => e.click()), st.clickAll)
      await p.waitForTimeout(400)
    }
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
    if (classes.length) console.log(`${route}@${w} classes`, JSON.stringify(await p.evaluate((cs) => Object.fromEntries(cs.map((c) => [c, document.querySelectorAll('.' + c).length])), classes)))
    await p.close()
  }
}
writeFileSync(out, JSON.stringify(res))
for (const [k, v] of Object.entries(res)) console.log(k, 'elements', v.count, 'height', v.h)
await b.close()
