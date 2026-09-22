// Proves the sweep moved no rendered pixel: for every padding/gap declaration
// in every changed partial, resolve --space-* back to px on BOTH sides and
// assert the two value strings are identical.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

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

const decls = (css) =>
  [...blank(css).matchAll(PROPS)].map((m) => `${m[1]}: ${resolve(m[2])}`)

const changed = execSync('git diff --name-only -- src/styles', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

let checked = 0
let bad = 0
const unresolved = new Set()
for (const file of changed) {
  const before = decls(execSync(`git show HEAD:${file}`, { encoding: 'utf8', maxBuffer: 1 << 28 }))
  const after = decls(readFileSync(file, 'utf8'))
  if (before.length !== after.length) {
    console.log(`✗ ${file}: declaration COUNT changed ${before.length} -> ${after.length}`)
    bad += 1
    continue
  }
  for (let i = 0; i < before.length; i += 1) {
    checked += 1
    if (before[i] !== after[i]) {
      bad += 1
      console.log(`✗ ${file}: "${before[i]}"  ->  "${after[i]}"`)
    }
    for (const m of after[i].matchAll(/var\((--[\w-]+)\)/g)) {
      if (m[1].startsWith('--space-')) unresolved.add(m[1])
    }
  }
}
console.log(`\nchanged partials : ${changed.length}`)
console.log(`declarations compared (resolved back to px) : ${checked}`)
console.log(`mismatches : ${bad}`)
if (unresolved.size) console.log(`unresolved --space-* tokens seen: ${[...unresolved].join(', ')}`)
process.exit(bad ? 1 : 0)
