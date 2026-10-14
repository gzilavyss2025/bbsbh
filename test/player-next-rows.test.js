// Slice 20a (#2073): the game-log rows answer their door (hover, focus, the open game),
// and a loss on the open game's row keeps AA contrast.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = (rel) => stripComments(src(join('styles/player-next', rel)))
const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()

test('LogTable marks the open game\'s row with aria-current', () => {
  const s = src('screens/player/next/parts/LogTable.jsx')
  assert.match(s, /export function LogTable\(\{ columns, rows, caption, currentKey \}\)/)
  assert.match(s, /aria-current=\{currentKey != null && r\.key === currentKey \? 'true' : undefined\}/)
  assert.doesNotMatch(s, /<button|role="button"/, 'a row is never a button')
})

test('the pitcher log passes the open game as the current row', () => {
  assert.match(src('screens/player/next/modules/pitchlog/index.jsx'), /<LogTable [^>]*currentKey=\{open\}/)
})

test('logtable.css: hover tint, the selected row, and the focus ring', () => {
  const c = css('both/logtable.css')
  assert.match(
    c,
    /@media \(hover: hover\) \{\s*\.logtable__grid tbody tr:not\(\[aria-current='true'\]\):has\(:is\(a, button\):hover\) \{\s*background: var\(--surface-row-hover\);/,
  )
  const sel = ruleBody(c, ".logtable__grid tbody tr[aria-current='true']")
  assert.ok(sel)
  assert.equal(decl(sel, 'background'), 'var(--surface-row-selected)')
  assert.equal(decl(sel, 'outline'), 'var(--bw-heavy) solid var(--border-stamped)')
  const ring = ruleBody(c, '.logtable__grid tbody tr:has(:focus-visible)')
  assert.ok(ring)
  assert.equal(decl(ring, 'outline'), 'var(--bw-heavy) solid var(--focus-ring)')
  assert.ok(c.indexOf(':has(:focus-visible)') > c.indexOf("tr[aria-current='true'] {"), 'the ring rule comes after the selected rule')
})

test('logtable.css: a row with no control tints under the pointer, and a heading does not', () => {
  const c = css('both/logtable.css')
  const media = c.slice(c.indexOf('@media (hover: hover)'), c.indexOf("tr[aria-current='true'] {"))
  assert.match(
    media,
    /\.logtable__grid tbody tr:not\(\.logtable__div, :has\(a, button\)\):hover \{\s*background: var\(--surface-row-hover\);/,
  )
  assert.doesNotMatch(src('screens/player/next/modules/batlog/index.jsx'), /<button|<a |Door/, 'the batter rows hold no control')
})

test('pitchlog.css: a loss on the open row reads the deeper clay', () => {
  const body = ruleBody(css('pitcher/pitchlog.css'), ".pitchlog tr[aria-current='true'] :is(.pitchlog__score--L, .pitchlog__hi--er)")
  assert.ok(body)
  assert.equal(decl(body, 'color'), 'var(--clay-deep)')
})
