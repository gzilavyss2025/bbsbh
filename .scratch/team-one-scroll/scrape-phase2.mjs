// THE REAL CONTENT OF THE PHASE 2 CARDS, off the running dev server, so the
// Ranks, About and full-page artboards draw real values rather than invented
// ones. Same discipline as scrape-standing.mjs: a placeholder hides the thing
// the board exists to judge.
//
//   MSYS_NO_PATHCONV=1 PORT=5173 node .scratch/team-one-scroll/scrape-phase2.mjs \
//     "/team/249/numbers::.tledg" "/team/249::.alum,.thub-card"
//
// Each argument is "<route>::<comma-separated selectors>" (:: so a ?d= query survives). For every match it
// prints the class, the measured height, the head, and a shallow structure
// dump — each descendant that is a real block, with its tag, class, height and
// its own text — which is enough to redraw the card at its true shape.
import { chromium, devices } from '@playwright/test'

const PORT = Number(process.env.PORT) || 5173
const BASE = `http://localhost:${PORT}`
const DEPTH = Number(process.env.DEPTH) || 3
const browser = await chromium.launch()

for (const arg of process.argv.slice(2)) {
  const i = arg.lastIndexOf("::"); const route = i < 0 ? arg : arg.slice(0, i); const sel = i < 0 ? ".thub-card" : arg.slice(i + 2)
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.goto(`${BASE}${route}${route.includes('?') ? '&' : '?'}nointro`)
  await page.waitForFunction(() => !document.querySelector('.loader--route'), null, { timeout: 30_000 })
  await page.waitForTimeout(5000)
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.75))
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(2500)

  const out = await page.evaluate(([selectors, depth]) => {
    const t = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
    const px = (el) => Math.round(el.getBoundingClientRect().height)
    const cls = (el) => (typeof el.className === 'string' ? el.className : el.tagName.toLowerCase())

    const walk = (el, d, acc) => {
      for (const c of el.children) {
        if (c.tagName === 'SCRIPT' || c.tagName === 'STYLE') continue
        const h = px(c)
        if (h < 4) continue
        acc.push({ d, tag: c.tagName.toLowerCase(), cls: cls(c).slice(0, 60), px: h, text: t(c).slice(0, 220) })
        if (d < depth) walk(c, d + 1, acc)
      }
      return acc
    }

    const res = []
    for (const s of selectors.split(',')) {
      for (const el of document.querySelectorAll(s.trim())) {
        res.push({
          sel: s.trim(),
          cls: cls(el),
          px: px(el),
          text: t(el).slice(0, 2500),
          tree: walk(el, 0, []),
        })
      }
    }
    return res
  }, [sel, DEPTH])

  console.log(`\n############### ${route}   [${sel}]`)
  for (const c of out) {
    console.log(`\n--- ${c.cls}   ${c.px}px`)
    console.log(`    TEXT: ${c.text}`)
    for (const n of c.tree) {
      console.log(`    ${'  '.repeat(n.d)}${String(n.px).padStart(5)}px ${n.tag}.${n.cls}  ${n.text.slice(0, 110)}`)
    }
  }
  await ctx.close()
}
await browser.close()
