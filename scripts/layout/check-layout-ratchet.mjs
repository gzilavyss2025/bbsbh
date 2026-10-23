#!/usr/bin/env node
// Hand-written layout rules in src/styles/ may only ever SHRINK.
//
// Stack, Cluster and Grid (src/components/ui/layout/) are the layout parts. The
// migration of old rules onto them is frozen: it stopped paying back, and new code
// kept adding rules by hand (display: grid went 301 -> 328 in 8 days). So the count
// is a ratchet, per file, in layout-ratchet-budget.json beside this script.
//
// Counted, per rule (the census logic, .scratch/design-system/layout/census.mjs):
//   column  flex-direction: column | column-reverse, or flex-flow with column
//   wrap    flex-wrap: wrap | wrap-reverse, or flex-flow with wrap
//   grid    display: grid | inline-grid
// src/styles/system/ (the parts themselves) is skipped. A rule with a comment
// `layout-exempt: <reason>` right before it is not counted.
//
// Property names and keywords are read in any case. A rule inside @keyframes is a
// step of an animation, not a layout, and is skipped. The marker must sit on its
// own line right before the rule; a comment after the previous rule's `}` does not
// count. Files: src/styles/, src/index.css and src/tokens/.
//
// A count over its budget fails. A count under it fails too, until the same PR
// lowers the budget (copied from check-dir-size.mjs). `--write` rewrites the budget
// from today's counts, and refuses while any count is over. Run by `npm run lint`.
//
// Accepted (#1831, item 4): if two PRs each lower the same entry, Git merges the
// identical edit and the merged tree sits under budget. The stack run catches it
// before `main`; the two-sided ratchet matches check-dir-size.mjs on purpose.

import { readFileSync, writeFileSync } from 'node:fs'
import { relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import postcss from 'postcss'
import { ROOT, toPosix, walk } from '../lib/walk.mjs'

const BUDGET_FILE = new URL('./layout-ratchet-budget.json', import.meta.url)
const KINDS = ['column', 'wrap', 'grid']
const EXEMPT = /layout-exempt\s*:\s*\S/

const isKeyframes = (rule) => {
  for (let p = rule.parent; p; p = p.parent) if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return true
  return false
}

// A marker comment is "right before" a rule when it ends on the line above and
// starts its own line, so it cannot trail the previous rule. Exported for
// check-card-fill.mjs, which reads its own marker the same way.
export const markedBefore = (rule, marker) => {
  const c = rule.prev()
  if (c?.type !== 'comment' || !marker.test(c.text)) return false
  if (c.source.end.line < rule.source.start.line - 1) return false
  const before = c.prev()
  return !(before && before.source.end.line === c.source.start.line)
}
const exempt = (rule) => markedBefore(rule, EXEMPT)

export function countLayout(css) {
  const n = { column: 0, wrap: 0, grid: 0 }
  postcss.parse(css).walkRules((rule) => {
    if (isKeyframes(rule) || exempt(rule)) return
    const d = {}
    rule.each((x) => { if (x.type === 'decl') d[x.prop.toLowerCase()] = x.value.toLowerCase() })
    const flow = d['flex-flow'] ?? ''
    if (/^column(-reverse)?$/.test(d['flex-direction'] ?? '') || /column/.test(flow)) n.column++
    if (/^wrap/.test(d['flex-wrap'] ?? '') || /\bwrap\b/.test(flow)) n.wrap++
    if (/^(inline-)?grid$/.test(d.display ?? '')) n.grid++
  })
  return n
}

// `counts` and `budget` are { file: { column, wrap, grid } }; a missing kind is 0.
export function compare(counts, budget) {
  const problems = []
  for (const file of new Set([...Object.keys(counts), ...Object.keys(budget)])) {
    for (const kind of KINDS) {
      const now = counts[file]?.[kind] ?? 0
      const max = budget[file]?.[kind] ?? 0
      if (now > max) problems.push(`${file}: ${kind} rules grew to ${now}, budget ${max}`)
      else if (now < max) problems.push(`${file}: ${kind} rules fell to ${now}, under budget ${max}. Lower the budget`)
    }
  }
  return problems
}

// True when any count is over its budget. `--write` refuses on this.
export function grew(counts, budget) {
  return Object.keys(counts).some((file) => KINDS.some((k) => (counts[file][k] ?? 0) > (budget[file]?.[k] ?? 0)))
}

// Every file the ratchet reads, as repo-relative paths. src/styles/system/ holds
// the parts themselves and is skipped.
export function layoutFiles() {
  const files = [
    ...walk(`${ROOT}/src/styles`, { exts: ['.css'] }),
    ...walk(`${ROOT}/src/tokens`, { exts: ['.css'] }),
    `${ROOT}/src/index.css`,
  ]
  return files.map((f) => toPosix(relative(ROOT, f))).filter((rel) => !rel.startsWith('src/styles/system/'))
}

const HELP = `
  Use the layout parts for new layout:
    import Stack   from '../components/ui/layout/Stack.jsx'    (a column)
    import Cluster from '../components/ui/layout/Cluster.jsx'  (a wrapping row)
    import Grid    from '../components/ui/layout/Grid.jsx'     (auto-fit columns)
  Or, for a layout the parts cannot say (named areas, a fixed count), put
  \`/* layout-exempt: <reason> */\` on the line before the rule.
  Old rules move only when a PR already edits them; then lower the budget:
    node scripts/layout/check-layout-ratchet.mjs --write
`

function main() {
  const counts = {}
  for (const rel of layoutFiles()) {
    const n = countLayout(readFileSync(`${ROOT}/${rel}`, 'utf8'))
    if (KINDS.some((k) => n[k])) counts[rel] = Object.fromEntries(KINDS.filter((k) => n[k]).map((k) => [k, n[k]]))
  }
  const budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf8'))
  const problems = compare(counts, budget)
  if (process.argv.includes('--write')) {
    if (grew(counts, budget)) { console.error(problems.join('\n') + HELP); process.exit(1) }
    writeFileSync(BUDGET_FILE, JSON.stringify(counts, null, 2) + '\n')
    return console.log('✓ layout-ratchet-budget.json written.')
  }
  if (problems.length) {
    console.error(`\n✗ Layout ratchet: ${problems.length} problem(s).\n`)
    for (const p of problems) console.error(`  ${p}`)
    console.error(HELP)
    process.exit(1)
  }
  console.log(`✓ Layout ratchet holds — ${Object.keys(counts).length} files at budget.`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
