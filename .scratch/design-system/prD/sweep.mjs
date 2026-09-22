// Applies the classification in decisions.mjs to src/styles/, one line at a
// time. Every replacement is verified against the exact expression the ledger
// recorded, so a shifted line or an edited rule aborts the sweep rather than
// painting the wrong thing.
//   node .scratch/design-system/prD/sweep.mjs [--dry]
import fs from 'node:fs'
import { DECISIONS } from './decisions.mjs'

const DRY = process.argv.includes('--dry')
const rows = JSON.parse(fs.readFileSync('.scratch/design-system/prD/ledger.json', 'utf8'))

const byFile = new Map()
for (const r of rows) {
  const [dest, , from, to] = DECISIONS[`${r.file}:${r.line}`]
  if (dest === 'stays') continue
  if (!byFile.has(r.file)) byFile.set(r.file, [])
  byFile.get(r.file).push({ line: r.line, from, to, text: r.text })
}

const problems = []
let changed = 0

for (const [file, edits] of byFile) {
  const path = `src/styles/${file}`
  const lines = fs.readFileSync(path, 'utf8').split('\n')
  for (const e of edits) {
    const i = e.line - 1
    if (lines[i].trim() !== e.text) {
      problems.push(`${file}:${e.line} drifted — ledger saw "${e.text}", file has "${lines[i].trim()}"`)
      continue
    }
    const hits = lines[i].split(e.from).length - 1
    if (hits !== 1) {
      problems.push(`${file}:${e.line} has ${hits} copies of "${e.from}" — expected exactly 1`)
      continue
    }
    lines[i] = lines[i].replace(e.from, e.to)
    changed += 1
  }
  if (!DRY) fs.writeFileSync(path, lines.join('\n'))
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}
console.log(`${DRY ? 'would change' : 'changed'} ${changed} declarations across ${byFile.size} partials`)
