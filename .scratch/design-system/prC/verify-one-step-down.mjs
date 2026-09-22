// Proves the C2 rounding did exactly what it claims AND NOTHING ELSE.
//
// Its sibling verify-no-pixel-moved.mjs asserts that a diff changed no value.
// This slice moves values on purpose, so the assertion inverts: for every
// padding/gap declaration in every changed partial, resolve --space-* back to
// px on both sides of the diff, and require each difference to be a single
// value stepping DOWN by exactly 1px from one of 5, 7, 9, 11 or 13.
//
// That is the stronger check of the two. "Nothing moved" only has to compare
// strings; this has to know what a legal move looks like, so a stray edit --
// a property swapped, a shorthand losing an axis, a value rounded the wrong
// way -- fails here rather than passing as "well, something changed".
//
// Run from the repo root, naming the base to compare against:
//   node .scratch/design-system/prC/verify-one-step-down.mjs HEAD~1
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'HEAD~1'
const VALUES = {
  '--space-0': '0', '--space-1': '4px', '--space-1h': '6px', '--space-2': '8px',
  '--space-2h': '10px', '--space-3': '12px', '--space-3h': '14px', '--space-4': '16px',
  '--space-5': '20px', '--space-6': '24px', '--space-8': '32px', '--space-10': '40px',
  '--space-12': '48px', '--space-16': '64px',
}
const PROPS =
  /(?<![\w-])(padding(?:-top|-right|-bottom|-left|-inline-start|-inline-end|-block-start|-block-end|-inline|-block)?|(?:row-|column-)?gap)\s*:\s*([^;}]+)/g

const blank = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
const resolve = (v) =>
  v.replace(/var\((--space-[0-9]+h?)\)/g, (m, t) => VALUES[t] ?? m).replace(/\s+/g, ' ').trim()
const decls = (css) => [...blank(css).matchAll(PROPS)].map((m) => `${m[1]}: ${resolve(m[2])}`)

const changed = execSync(`git diff --name-only ${BASE} HEAD -- src/styles`, { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

const EXPECTED = { 5: 4, 7: 6, 9: 8, 11: 10, 13: 12 }
let compared = 0
let moved = 0
const bad = []

for (const file of changed) {
  const before = decls(execSync(`git show ${BASE}:${file}`, { encoding: 'utf8', maxBuffer: 1 << 28 }))
  const after = decls(readFileSync(file, 'utf8'))
  if (before.length !== after.length) {
    bad.push(`${file}: declaration COUNT changed ${before.length} -> ${after.length}`)
    continue
  }
  for (let i = 0; i < before.length; i += 1) {
    compared += 1
    if (before[i] === after[i]) continue
    // same property, same token count, values differ only at the rounded slots
    const [pb, vb] = [before[i].slice(0, before[i].indexOf(':')), before[i].slice(before[i].indexOf(':') + 1).trim()]
    const [pa, va] = [after[i].slice(0, after[i].indexOf(':')), after[i].slice(after[i].indexOf(':') + 1).trim()]
    if (pb !== pa) {
      bad.push(`${file}: property changed "${before[i]}" -> "${after[i]}"`)
      continue
    }
    const nb = vb.split(/\s+/)
    const na = va.split(/\s+/)
    if (nb.length !== na.length) {
      bad.push(`${file}: value arity changed "${before[i]}" -> "${after[i]}"`)
      continue
    }
    for (let j = 0; j < nb.length; j += 1) {
      if (nb[j] === na[j]) continue
      const b = Number(String(nb[j]).replace('px', ''))
      const a = Number(String(na[j]).replace('px', ''))
      if (EXPECTED[b] === a) moved += 1
      else bad.push(`${file}: "${before[i]}" -> "${after[i]}"  (${nb[j]} -> ${na[j]} is not a 1px step down from the odd band)`)
    }
  }
}

console.log(`changed partials                      : ${changed.length}`)
console.log(`padding/gap declarations compared     : ${compared}`)
console.log(`values moved down one step            : ${moved}`)
console.log(`unexpected differences                : ${bad.length}`)
for (const b of bad.slice(0, 20)) console.log(`  ! ${b}`)
process.exit(bad.length ? 1 : 0)
