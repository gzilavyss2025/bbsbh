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
