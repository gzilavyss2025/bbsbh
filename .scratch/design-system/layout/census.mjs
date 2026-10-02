// Layout census for issue #1180: how the CSS arranges things, before Stack,
// Cluster and Grid are built. Prints FACTS; the proposed gaps live in layout.md.
//
// A "rule" is one postcss Rule node (a selector list plus declarations), at any
// nesting depth, so a rule inside @media counts. Comments cannot match, because
// postcss does not return them as declarations.
//
// Run from the repo root:  node .scratch/design-system/layout/census.mjs [--json]
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import postcss from 'postcss'

const walk = (d, out = []) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    statSync(p).isDirectory() ? walk(p, out) : p.endsWith('.css') && out.push(p)
  }
  return out
}

// Token table, so var(--space-4) reads as 16px.
const tokens = {}
for (const f of walk('src/tokens')) {
  postcss.parse(readFileSync(f, 'utf8')).walkDecls(/^--/, (d) => { tokens[d.prop] = d.value.trim() })
}
const resolve = (v, depth = 0) => {
  v = v.trim()
  const m = v.match(/^var\((--[\w-]+)(?:\s*,\s*(.+))?\)$/)
  if (!m || depth > 6) return v
  return resolve(tokens[m[1]] ?? m[2] ?? v, depth + 1)
}
// "gap" value → a label: "16px" for a literal or token, keeps the token name.
const label = (raw) => {
  const r = resolve(raw)
  const tok = raw.trim().match(/^var\((--[\w-]+)/)
  return tok ? `${r} (${tok[1]})` : r
}

// Out of scope per the issue: the sheet you score on.
const BESPOKE = /(^|\/)(scorecard|box-score)\/|\/21-box-score|\/22-box-score|\/23-box-score|21a-|21b-/
const bespokeSel = /\.bs__grid|\.scorecard|\.sc-/

const rows = []   // { kind, file, line, selector, gap, cols, bespoke }
for (const file of walk('src/styles')) {
  const rel = relative('.', file)
  postcss.parse(readFileSync(file, 'utf8'), { from: file }).walkRules((rule) => {
    const d = {}
    rule.each((n) => { if (n.type === 'decl') d[n.prop] = n.value })
    const gap = d.gap ?? d['row-gap'] ?? null
    const colgap = d['column-gap'] ?? null
    const base = {
      file: rel, line: rule.source.start.line, selector: rule.selector.replace(/\s+/g, ' ').slice(0, 90),
      gap, colgap, cols: d['grid-template-columns'] ?? null,
      bespoke: BESPOKE.test(rel) || bespokeSel.test(rule.selector),
      media: rule.parent.type === 'atrule',
    }
    if (/^column(-reverse)?$/.test(d['flex-direction'] ?? '')) rows.push({ kind: 'column', ...base })
    if (/^(inline-)?grid$/.test(d.display ?? '')) rows.push({ kind: 'grid', ...base })
    if (/^wrap/.test(d['flex-wrap'] ?? '')) rows.push({ kind: 'wrap', ...base })
    // `flex-flow: column` / `row wrap` shorthand
    if (d['flex-flow']) {
      if (/column/.test(d['flex-flow'])) rows.push({ kind: 'column', ...base, shorthand: true })
      if (/\bwrap\b/.test(d['flex-flow'])) rows.push({ kind: 'wrap', ...base, shorthand: true })
    }
  })
}

const tally = (arr, key) => {
  const t = new Map()
  for (const r of arr) { const k = key(r); t.set(k, (t.get(k) || 0) + 1) }
  return [...t].sort((a, b) => b[1] - a[1])
}
const gapKey = (r) => (r.gap == null ? '(none)' : label(r.gap))
// A column's FIRST gap is the one between its children. Two-value gaps ("8px 12px") keep both.
const colKey = (r) => (r.colgap ? label(r.colgap) : '(from gap/none)')

const colAxis = (r) => {
  const c = r.cols
  if (!c) return '(no template-columns)'
  if (/auto-(fit|fill)/.test(c)) return 'auto-fit/auto-fill'
  if (/^repeat\(\s*\d+\s*,/.test(c)) return 'repeat(N, …) fixed count'
  if (/^(none|subgrid)$/.test(c.trim())) return c.trim()
  return 'explicit track list'
}

const out = {}
for (const kind of ['column', 'grid', 'wrap']) {
  const all = rows.filter((r) => r.kind === kind)
  const live = all.filter((r) => !r.bespoke)
  out[kind] = { all: all.length, bespoke: all.length - live.length, live: live.length,
    gaps: tally(live, gapKey), files: new Set(live.map((r) => r.file)).size }
  if (kind === 'grid') {
    out.gridCols = tally(live, colAxis)
    out.gridColGap = tally(live.filter((r) => r.colgap), colKey)
  }
}
out.tokensNamedSpace = Object.keys(tokens).filter((k) => /space|gap|section/.test(k))

if (process.argv.includes('--json')) console.log(JSON.stringify({ out, rows }, null, 1))
else {
  for (const kind of ['column', 'grid', 'wrap']) {
    const o = out[kind]
    console.log(`\n## ${kind}: ${o.all} rules (${o.bespoke} bespoke, ${o.live} in scope, ${o.files} partials)`)
    for (const [g, n] of o.gaps) console.log(`  ${String(n).padStart(4)}  ${g}`)
  }
  console.log('\n## grid columns'); for (const [g, n] of out.gridCols) console.log(`  ${String(n).padStart(4)}  ${g}`)
  console.log('\n## tokens'); console.log(out.tokensNamedSpace.join(' '))
}
