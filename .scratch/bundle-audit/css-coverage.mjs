// Entry-CSS breakdown for the #2875 audit.
// Needs `npx vite preview` running on :4173 and out/graph.json.
//   node .scratch/bundle-audit/css-coverage.mjs
// 1. Source side: every @import in src/index.css (recursively) and every CSS file
//    an entry-chunk JS module imports, with its source size on disk.
// 2. Browser side: Chromium CSS coverage of the entry stylesheet on / at 390 px
//    (?nointro, fresh context, SW blocked), each top-level rule classed used/unused
//    and grouped by the first class name's block (text before the first - or _).
import { chromium } from 'playwright'
import postcss from 'postcss'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname
const kb = (n) => (n / 1000).toFixed(1)
const g = JSON.parse(readFileSync(new URL('./out/graph.json', import.meta.url)))
const entry = g.chunks.find((c) => c.isEntry)

// 1. Source files.
const seen = new Map()
function walkCss(file, via) {
  if (seen.has(file) || !existsSync(ROOT + file)) return
  const text = readFileSync(ROOT + file, 'utf8')
  seen.set(file, { size: text.length, via })
  for (const m of text.matchAll(/@import\s+['"]([^'"]+)['"]/g)) walkCss(path.normalize(path.join(path.dirname(file), m[1])), file)
}
walkCss('src/index.css', 'src/main.jsx')
for (const m of entry.modules) if (m.id.endsWith('.css')) walkCss(m.id, 'entry JS import')
for (const id of Object.keys(g.importers)) if (id.endsWith('.css') && entry.modules.some((m) => m.id === id)) walkCss(id, 'entry JS import')
const bySrc = [...seen].sort((a, b) => b[1].size - a[1].size)
const total = bySrc.reduce((s, [, v]) => s + v.size, 0)
console.log(`ENTRY CSS SOURCES: ${seen.size} files, ${kb(total)} kB source (with comments)`)
const dir = {}
for (const [f, v] of bySrc) { const k = f.split('/').slice(0, 3).join('/'); dir[k] = (dir[k] ?? 0) + v.size }
for (const [k, v] of Object.entries(dir).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`${kb(v).padStart(7)}  ${k}`)
console.log('biggest files:')
for (const [f, v] of bySrc.slice(0, 15)) console.log(`${kb(v.size).padStart(7)}  ${f}  (via ${v.via})`)

// 2. Coverage.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
const page = await ctx.newPage()
await page.coverage.startCSSCoverage()
await page.goto('http://localhost:4173/?nointro', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
const cov = (await page.coverage.stopCSSCoverage()).find((c) => /\/assets\/index-.*\.css$/.test(c.url))
await browser.close()
const used = cov.ranges
const isUsed = (a, b) => used.some((r) => r.start < b && r.end > a)
const groups = {}
let u = 0, n = 0
postcss.parse(cov.text).each((node) => {
  const a = node.source.start.offset, b = node.source.end.offset + 1
  const len = b - a
  const sel = node.type === 'rule' ? node.selector : node.type === 'atrule' ? (node.nodes?.find((x) => x.selector)?.selector ?? '@' + node.name) : ''
  const block = (sel.match(/\.([a-zA-Z][a-zA-Z0-9]*)/)?.[1] ?? (sel.startsWith('@') ? sel : sel.split(/[\s,:[]/)[0] || '(other)'))
  const k = groups[block] ??= { used: 0, unused: 0 }
  // An at-rule counts as used when any part of it is.
  if (isUsed(a, b)) { k.used += len; u += len } else { k.unused += len; n += len }
})
console.log(`\nCOVERAGE on / at 390 px: ${kb(cov.ranges.reduce((s, r) => s + r.end - r.start, 0))} of ${kb(cov.text.length)} kB in used ranges; by top-level rule: ${kb(u)} kB in rules touched, ${kb(n)} kB in rules never used`)
console.log('largest UNUSED blocks (first class name before - or _):')
for (const [k, v] of Object.entries(groups).sort((a, b) => b[1].unused - a[1].unused).slice(0, 25)) console.log(`${kb(v.unused).padStart(7)} unused ${kb(v.used).padStart(6)} used  .${k}`)
writeFileSync(new URL('./out/css-coverage.json', import.meta.url), JSON.stringify({ sources: bySrc, groups }, null, 1))
