// Sweeps padding/gap px literals in src/styles/ onto the spacing scale, and
// writes out what it could not sweep.
//
// No value moves. A literal is rewritten only when a --space-* token carries
// EXACTLY it; anything else is left alone and recorded in residue.json, which
// is what SPACING_RESIDUE in scripts/check-typography.mjs was generated from.
//
// Run from the repo root. Default is a DRY RUN; pass --write to apply.
//   node .scratch/design-system/prC/sweep.mjs            # dry run
//   node .scratch/design-system/prC/sweep.mjs --write    # apply
// Set OUT to choose where residue.json lands.
//
// The next slice re-runs this with the odd 5/7/9/11/13px band added to MAP —
// but only after the rounding decision is made, because adding a value to MAP
// that no token carries exactly IS a spacing change.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

const WRITE = process.argv.includes('--write')

const MAP = {
  0: '--space-0', 4: '--space-1', 6: '--space-1h', 8: '--space-2',
  10: '--space-2h', 12: '--space-3', 14: '--space-3h', 16: '--space-4',
  20: '--space-5', 24: '--space-6', 32: '--space-8', 40: '--space-10',
  48: '--space-12', 64: '--space-16',
}

const PROPS =
  /(^|[;{\s])(padding-inline-start|padding-inline-end|padding-block-start|padding-block-end|padding-inline|padding-block|padding-top|padding-right|padding-bottom|padding-left|padding|row-gap|column-gap|gap)\s*:\s*([^;}]+)/g

const files = []
;(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (f.endsWith('.css')) files.push(p.split(sep).join('/'))
  }
})('src/styles')

let converted = 0 // literals rewritten
let convertedDecls = 0 // declarations touched
const residue = [] // { file, line, prop, value, values[] }
const perFile = {}

for (const file of files) {
  const css = readFileSync(file, 'utf8')
  const comments = [...css.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => [m.index, m.index + m[0].length])
  const inComment = (i) => comments.some(([a, b]) => i >= a && i < b)

  let fileConv = 0
  const out = css.replace(PROPS, (full, pre, prop, value, offset) => {
    if (inComment(offset)) return full
    const colon = full.indexOf(':')
    const head = full.slice(0, colon + 1)
    let tail = full.slice(colon + 1)
    let n = 0
    tail = tail.replace(/(-?\d+(?:\.\d+)?)px/g, (lit, num) => {
      const token = MAP[Number(num)]
      if (!token) return lit
      n += 1
      return `var(${token})`
    })
    if (n) {
      converted += n
      convertedDecls += 1
      fileConv += n
    }
    // whatever px is left over is residue
    const left = [...tail.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((x) => Number(x[1]))
    if (left.length) {
      const line = css.slice(0, offset + pre.length).split('\n').length
      residue.push({ file, line, prop, value: (head + tail).trim(), values: left })
    }
    return head + tail
  })
  if (fileConv) perFile[file] = fileConv
  if (WRITE && out !== css) writeFileSync(file, out)
}

console.log(`literals converted      : ${converted}`)
console.log(`declarations touched    : ${convertedDecls}`)
console.log(`residue declarations    : ${residue.length}`)
console.log(`residue literals        : ${residue.reduce((n, r) => n + r.values.length, 0)}`)
const tally = {}
for (const r of residue) for (const v of r.values) tally[Math.abs(v)] = (tally[Math.abs(v)] || 0) + 1
console.log('\nresidue by value:')
for (const [v, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}px  ${n}`)

writeFileSync(
  process.env.OUT || 'residue.json',
  JSON.stringify({ converted, convertedDecls, residue, perFile }, null, 2),
)
console.log(`\nwrote ${process.env.OUT || 'residue.json'}  (${WRITE ? 'FILES WRITTEN' : 'dry run'})`)
