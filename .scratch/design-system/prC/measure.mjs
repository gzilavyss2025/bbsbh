// The spacing measurement PR C turns on: how many raw px literals are in
// `padding` and `gap` across src/styles/, how many are off the 4px scale, and
// how many the three proposed half-steps (6, 10, 14px) would actually cover.
//
// Margins are EXCLUDED on purpose. #1128 exempts their 1-3px optical nudges as
// real, so a count that folds them in measures a different question.
//
// Run: node .scratch/design-system/prC/measure.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const files = []
;(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (f.endsWith('.css')) files.push(p)
  }
})('src/styles')

const SCALE = new Set([0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64])
const HALF = new Set([6, 10, 14])
const PROPS = /(^|[;{\s])(padding|padding-top|padding-right|padding-bottom|padding-left|gap|row-gap|column-gap)\s*:\s*([^;}]+)/g

let declarations = 0, withLiteral = 0
const literals = []        // every px number seen in those declarations
const offScaleDecls = new Set()

for (const file of files) {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ')
  for (const m of css.matchAll(PROPS)) {
    const value = m[3].trim()
    declarations++
    const px = [...value.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((x) => parseFloat(x[1]))
    if (!px.length) continue
    withLiteral++
    let off = false
    for (const n of px) {
      literals.push(n)
      if (!SCALE.has(Math.abs(n))) off = true
    }
    const line = css.slice(0, m.index).split('\n').length
    if (off) offScaleDecls.add(`${file}:${line}`)
  }
}

const offScale = literals.filter((n) => !SCALE.has(Math.abs(n)))
const covered = offScale.filter((n) => HALF.has(Math.abs(n)))
const uncovered = offScale.filter((n) => !HALF.has(Math.abs(n)))

const tally = (arr) => {
  const t = {}
  for (const n of arr) t[Math.abs(n)] = (t[Math.abs(n)] || 0) + 1
  return Object.entries(t).sort((a, b) => b[1] - a[1])
}

console.log(`files scanned                : ${files.length}`)
console.log(`padding/gap declarations     : ${declarations}  (${withLiteral} carry a px literal)`)
console.log(`px literals in them          : ${literals.length}`)
console.log(`  on the 4px scale           : ${literals.length - offScale.length}`)
console.log(`  OFF the scale              : ${offScale.length}   in ${offScaleDecls.size} distinct declarations`)
console.log(`    covered by 6/10/14       : ${covered.length}`)
console.log(`    NOT covered              : ${uncovered.length}`)
console.log('\nthe uncovered, by value:')
for (const [v, n] of tally(uncovered)) console.log(`  ${String(v).padStart(5)}px  ${n}`)
const nudges = uncovered.filter((n) => Math.abs(n) <= 3)
const band = uncovered.filter((n) => Math.abs(n) >= 5 && Math.abs(n) <= 13 && Math.abs(n) % 2 === 1)
console.log(`\nif the 1-3px optical-nudge exemption extends to padding/gap : ${nudges.length} resolve`)
console.log(`leaving the odd 5/7/9/11/13px band                          : ${band.length}`)
console.log(`and everything else                                         : ${uncovered.length - nudges.length - band.length}`)
