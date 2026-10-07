// Dashed means ONE thing: provisional, pencilled in (#1132). A door is not
// provisional, so a door selector never draws a dashed rule. This guards the
// door NAMES below only; empties, row dividers and the rest are in the census.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const STYLES = join(import.meta.dirname, '..', 'src', 'styles')
const DOOR = /\.[\w-]*(__door|__more|__expand|-expand|__newtile|__addpage)\b/
// Doors still dashed, each owed a later slice (.scratch/design-system/dashed/census.md).
// scorecard/ is bespoke and out of scope. Shrink this list; never grow it.
const PENDING = new Set(['.sc-armnotice__more'])

const css = (d) => readdirSync(d, { recursive: true }).filter((f) => f.endsWith('.css')).map((f) => join(d, f))

test('no door selector draws a dashed rule', () => {
  const bad = []
  const seen = new Set()
  for (const f of css(STYLES)) {
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const [, sel, body] of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/dashed/.test(body)) continue
      for (const s of sel.split(',').map((x) => x.trim())) {
        if (PENDING.has(s)) seen.add(s)
        else if (DOOR.test(s)) bad.push(`${f.slice(STYLES.length + 1)}: ${s}`)
      }
    }
  }
  assert.deepEqual(bad, [])
  assert.deepEqual([...PENDING].filter((s) => !seen.has(s)), [], 'stale PENDING entry: remove it')
})
