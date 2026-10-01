// Synthetic before/after for rules that no real route reaches in a test game.
// For each class it builds a host with the same children, once with the OLD
// markup (just the class) and once with the NEW (Stack classes first, then the
// class), and prints every element's rect and the layout-relevant computed
// style. Run it with MODE=old before a migration and MODE=new after, then diff
// the two files with diffgeom.mjs.
// usage: MODE=old|new node synth.mjs <out.json> <class=gap[:list]> ...
//   e.g. MODE=new node synth.mjs out.json abs__detail=tight:list upnext__col=tight
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'
const [out, ...specs] = process.argv.slice(2)
const mode = process.env.MODE
if (!['old', 'new'].includes(mode)) throw new Error('MODE must be old or new')
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' })
const res = {}
for (const w of [390, 760]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } })
  await p.goto(`${process.env.BASE || 'http://localhost:5173'}/design-lab?nointro`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)
  res[`synth@${w}`] = await p.evaluate(([specs, mode]) => {
    const els = []
    for (const spec of specs) {
      const [cls, rest] = spec.split('=')
      const [gap, kind] = rest.split(':')
      const list = kind === 'list'
      const outer = document.createElement('div')
      outer.style.cssText = 'width:300px;position:absolute;left:0;top:0'
      const host = document.createElement(list ? 'ol' : 'div')
      host.className = mode === 'old' ? cls : `stack stack--${gap}${list ? ' stack--list' : ''} ${cls}`
      for (const h of [10, 24, 17]) {
        const kid = document.createElement(list ? 'li' : 'span')
        kid.textContent = 'x'
        kid.style.cssText = `display:block;height:${h}px`
        host.appendChild(kid)
      }
      outer.appendChild(host)
      document.body.appendChild(outer)
      for (const e of [host, ...host.children]) {
        const r = e.getBoundingClientRect(), cs = getComputedStyle(e)
        els.push([cls + (e === host ? '' : '>kid'), r.left, r.top, r.width, r.height, cs.display, cs.flexDirection, cs.rowGap, cs.columnGap,
          cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft, cs.marginTop, cs.marginBottom, cs.listStyleType, cs.alignItems, cs.minWidth, cs.textAlign, cs.background.slice(0, 40)])
      }
      outer.remove()
    }
    return { count: els.length, h: 0, els }
  }, [specs, mode])
  await p.close()
}
writeFileSync(out, JSON.stringify(res))
for (const [k, v] of Object.entries(res)) console.log(k, 'elements', v.count)
await b.close()
