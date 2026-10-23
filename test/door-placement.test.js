// A door's per-site residual may not re-draw what the shared `.door` rule draws (#1161).
//
// The door collapse folded fourteen hand-drawn "there is more behind this"
// controls into one `.door` rule and cut each per-site rule back to "all it keeps
// is where it stands". Asserted from the stylesheet text, where it is always true
// or always false, rather than from a render that depends on the data of the day.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const STYLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles')

// Comments come out first. These files carry long prose blocks BETWEEN
// declarations, and a comment left in place glues itself to the declaration
// after it — `/* … */ align-items: flex-start` no longer starts with the
// property, so the rule reads as absent and the assertion passes for the
// wrong reason. That is the failure mode this whole file exists to catch.
function stripComments(css) {
  let out = ''
  let i = 0
  for (;;) {
    const open = css.indexOf('/*', i)
    if (open === -1) return out + css.slice(i)
    out += css.slice(i, open)
    const close = css.indexOf('*/', open + 2)
    if (close === -1) return out
    i = close + 2
  }
}

const read = (name) => stripComments(readFileSync(join(STYLES, name), 'utf8'))

// The declaration block of a base rule — the selector exactly, never a pseudo,
// a compound or a longer name that merely starts with it.
function ruleBody(css, selector) {
  let from = 0
  for (;;) {
    const at = css.indexOf(selector, from)
    if (at === -1) return null
    from = at + selector.length
    const before = at === 0 ? '\n' : css[at - 1]
    if (!'\n;}{,'.includes(before)) continue
    let i = from
    while (css[i] === ' ' || css[i] === '\n') i += 1
    if (css[i] !== '{') continue
    return css.slice(i + 1, css.indexOf('}', i))
  }
}

test('a door keeps only placement, never dress, beside the shared rule', () => {
  // The other half of the same rule: the residual may not re-draw what `.door`
  // already draws. A colour or a border here would be the collapse coming
  // undone one declaration at a time, which is how it looked before #1161.
  const DRESS = ['color', 'background', 'border', 'border-radius', 'font-size', 'font-weight']
  const cases = [['72-club-transactions.css', '.txpage__door']]
  for (const [file, selector] of cases) {
    const body = ruleBody(read(file), selector)
    assert.ok(body, `${selector} should have a base rule`)
    for (const property of DRESS) {
      const restated = body
        .split(';')
        .map((d) => d.trim())
        .some((d) => d.startsWith(`${property}:`))
      assert.ok(
        !restated,
        `${selector} restates ${property}, which styles/system/door.css already draws — ` +
          'a per-site residual carries placement only',
      )
    }
  }
})

// What the shared rule draws. A door is ink with a dotted rule, the same rule a
// player-name link shows on hover (`.plink`), so it still reads as a link on
// touch, where there is no hover. It was field green, the colour the app also
// uses for "positive" and for the focus ring, which made a "See all ›" read as
// a good number. This pins the decision from the stylesheet text.
test('an inline door is ink with a dotted rule, and reads no green', () => {
  const css = read('system/door.css')
  for (const selector of ['.door--inline', '.door__label']) {
    const body = ruleBody(css, selector)
    assert.ok(body, `${selector} should have a base rule`)
    assert.match(body, /color:\s*var\(--text-heading\)/, `${selector} draws in ink`)
    assert.doesNotMatch(body, /accent-hover|--field|accent-positive/, `${selector} reads no green`)
  }
  // The dotted rule itself is the one shared link rule (#2528); the inline door is named in it.
  const shared = ruleBody(css, '.gnotes__pdf a') // the last selector of the grouped rule
  assert.ok(shared, 'the shared link rule names the inline door')
  assert.match(shared, /text-decoration:\s*underline dotted/, 'the inline door carries a dotted rule')
})

// A door in a band takes the band's own ink. The band's ink is checked against its
// ground (`check-contrast`); the door's page ink is not, and it vanishes on a navy
// or club-coloured band. The team page's Games band had a one-off for this; the
// design lab shows the same door in a themed band without it.
test('a door in a band inherits the band ink', () => {
  const body = ruleBody(read('system/section-head.css'), '.sectionhead--band .door--inline')
  assert.ok(body, 'a band should have a door rule')
  assert.match(body, /color:\s*inherit/, 'the door draws in the band ink')
})
