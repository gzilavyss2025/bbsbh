// Second pass for #1180: what the gap-less stacks do instead, and what spaces a
// page's top-level sections. Run: node .scratch/design-system/layout/census2.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import postcss from 'postcss'
const walk = (d, o = []) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p, o) : p.endsWith('.css') && o.push(p) } return o }

const sib = /(>\s*\*\s*\+\s*\*|\*\s*\+\s*\*|>\s*\*:not\(:first-child\)|:not\(:first-child\)|\+\s*\.|~)/
const noGapColumns = [], siblingMargin = [], pageSections = []
for (const file of walk('src/styles')) {
  const rel = relative('.', file)
  const root = postcss.parse(readFileSync(file, 'utf8'), { from: file })
  root.walkRules((r) => {
    const d = {}; r.walkDecls((n) => {
      d[n.prop] = n.value
    })
    const line = r.source.start.line, sel = r.selector.replace(/\s+/g, ' ').slice(0, 80)
    if (/^column/.test(d['flex-direction'] ?? '') && !d.gap && !d['row-gap']) noGapColumns.push({ rel, line, sel, margin: d['margin-top'] ?? d['margin-bottom'] ?? null })
    if (sib.test(r.selector) && (d['margin-top'] || d['margin-block-start'] || d['margin-left'] || d['margin-inline-start']))
      siblingMargin.push({ rel, line, sel, v: d['margin-top'] ?? d['margin-block-start'] ?? d['margin-left'] ?? d['margin-inline-start'] })
    if (/(^|[ ,])\.(team-hub|player|standings|page|app|screen|route)([\s.:,>_-]|$)/.test(r.selector) && /\b(section|__sec|\.section)/.test(r.selector) && (d['margin-top'] || d['margin-bottom'] || d.gap))
      pageSections.push({ rel, line, sel, v: d.gap ?? d['margin-top'] ?? d['margin-bottom'] })
  })
}
const tally = (a, k) => [...a.reduce((m, x) => m.set(k(x), (m.get(k(x)) || 0) + 1), new Map())].sort((x, y) => y[1] - x[1])
console.log('gap-less column rules:', noGapColumns.length)
console.log(' of which a sibling-margin rule exists in same partial:',
  noGapColumns.filter((c) => siblingMargin.some((s) => s.rel === c.rel)).length)
console.log('\nsibling-margin spacing rules:', siblingMargin.length)
for (const [v, n] of tally(siblingMargin, (s) => s.v).slice(0, 14)) console.log(' ', String(n).padStart(4), v)
console.log('\nsection-spacing-looking rules on page roots:', pageSections.length)
for (const [v, n] of tally(pageSections, (s) => s.v).slice(0, 14)) console.log(' ', String(n).padStart(4), v)
const sectionish = []
for (const file of walk('src/styles')) postcss.parse(readFileSync(file, 'utf8')).walkRules((r) => {
  if (/^\.(section|player__section|thub-section|page__section)(\s|,|$|\.|:)/.test(r.selector.trim())) {
    const d = {}; r.walkDecls((n) => {
      d[n.prop] = n.value
    })
    if (d['margin-top'] || d['margin-bottom'] || d.margin) sectionish.push(`${relative('.', file)} ${r.selector}  ${d['margin-top'] ?? ''} ${d['margin-bottom'] ?? ''} ${d.margin ?? ''}`)
  }
})
console.log('\n.section-style rules with margins:'); sectionish.slice(0, 25).forEach((s) => console.log(' ', s))
