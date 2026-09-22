// Rounds the odd 5/7/9/11/13px band in src/styles/ to an adjacent step.
// `down` takes the step below, `up` the step above. Every odd-band value is an
// EXACT tie between two adjacent tokens, so these are the only two mechanical
// readings of "round to the nearest step".
//
// It was written to SHOOT the two candidates, and then it made the change: the
// decision went to `down`, and the same code path that produced the evidence
// produced the commit. That is deliberate — a preview that is not the change
// is a preview of something else.
//
// The band is closed now, so a further run has nothing to find. It is kept
// because it is the only record of how the two candidates were compared, and
// because reverting is `git checkout -- src/styles`, not a third mode.
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
