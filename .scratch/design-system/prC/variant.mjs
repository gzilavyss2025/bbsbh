// Applies one of the two live C2 candidates to src/styles/, so the before/after
// can be shot. `down` rounds the odd band to the step below, `up` to the step
// above. Every odd-band value is an EXACT tie between two adjacent tokens, so
// these are the only two mechanical readings of "round to the nearest step".
// Revert with `git checkout -- src/styles`.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

const dir = process.argv[2] // 'up' | 'down'
const DOWN = { 5: '--space-1', 7: '--space-1h', 9: '--space-2', 11: '--space-2h', 13: '--space-3' }
const UP = { 5: '--space-1h', 7: '--space-2', 9: '--space-2h', 11: '--space-3', 13: '--space-3h' }
const MAP = dir === 'up' ? UP : DOWN

const PROPS =
  /(?<![\w-])(?:padding(?:-top|-right|-bottom|-left|-inline-start|-inline-end|-block-start|-block-end|-inline|-block)?|(?:row-|column-)?gap)\s*:\s*([^;}]+)/g

const files = []
;(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (f.endsWith('.css')) files.push(p.split(sep).join('/'))
  }
})('src/styles')

let n = 0
for (const file of files) {
  const css = readFileSync(file, 'utf8')
  const comments = [...css.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => [m.index, m.index + m[0].length])
  const out = css.replace(PROPS, (full, _v, offset) => {
    if (comments.some(([a, b]) => offset >= a && offset < b)) return full
    const colon = full.indexOf(':')
    return (
      full.slice(0, colon + 1) +
      full.slice(colon + 1).replace(/(?<![\w.-])(-?\d+(?:\.\d+)?)px(?![\w-])/g, (lit, num) => {
        const t = MAP[Math.abs(Number(num))]
        if (!t) return lit
        n += 1
        return `var(${t})`
      })
    )
  })
  if (out !== css) writeFileSync(file, out)
}
console.log(`variant ${dir}: rewrote ${n} odd-band literals`)
