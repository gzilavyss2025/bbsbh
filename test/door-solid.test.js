// Dashed means ONE thing: provisional, pencilled in (#1132). A door is not
// provisional, so a door selector never draws a dashed rule. Empty states keep
// their dashed inset, but they live in `EmptyState`, not under these names.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const STYLES = join(import.meta.dirname, '..', 'src', 'styles')
const DOOR = /\.[\w-]*(__door|__more|__expand|-expand|__newtile|__addpage)\b/
// Doors still dashed, each owed a later slice (.scratch/design-system/dashed/census.md).
// scorecard/ is bespoke and out of scope. Shrink this list; never grow it.
const PENDING = new Set(['.shelf__newtile', '.vsteam__door', '.sc-armnotice__more'])

const css = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? css(join(d, e.name)) : e.name.endsWith('.css') ? [join(d, e.name)] : [],
  )

test('no door selector draws a dashed rule', () => {
  const bad = []
  for (const f of css(STYLES)) {
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const [, sel, body] of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/dashed/.test(body)) continue
      for (const s of sel.split(',').map((x) => x.trim())) {
        if (DOOR.test(s) && !PENDING.has(s)) bad.push(`${f.slice(STYLES.length + 1)}: ${s}`)
      }
    }
  }
  assert.deepEqual(bad, [])
})
