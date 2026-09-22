// A door's per-site residual must keep every declaration that PLACES it.
//
// THE BUG THIS EXISTS TO CLOSE. The door collapse (#1161) folded fourteen
// hand-drawn "there is more behind this" controls into one `.door` rule, and
// each per-site rule was cut back to "all it keeps is where it stands". For
// `.txcard__door` — the door at the end of the team-transactions scroll deck —
// that cut took three declarations and left `align-self: stretch` behind.
//
// It reads as dress. It is not. `.txcard__scroll` sets `align-items:
// flex-start` on purpose, so a three-line roster move does not print as a
// bordered box with 250px of nothing under it. Every child that wants to be
// full height therefore has to opt back out by hand: `.txday` does, in a
// comment that says why, and `.txcard__door` did too. Without it the door
// collapses to its own text height and stops being a full-height tap target
// beside the tallest card in the row.
//
// Nothing caught it. The rule still parsed, the page still rendered, lint was
// green, and the deck's own comment forty lines above went on claiming
// ".txcard__door keeps its own align-self: stretch" while it no longer did.
// A browser check would only have caught it on a club whose deck happens to be
// paging — `canRevealMore` is false whenever a day's moves already all fit.
//
// So this is asserted from the stylesheet text, where it is always true or
// always false, rather than from a render that depends on the data of the day.
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

const declares = (body, property, value) =>
  body
    .split(';')
    .map((d) => d.trim())
    .some((d) => d.startsWith(`${property}:`) && d.slice(d.indexOf(':') + 1).trim() === value)

test('the deck sizes its cards to their own story, which is what makes the rest of this matter', () => {
  const deck = ruleBody(read('29-team-transactions.css'), '.txcard__scroll')
  assert.ok(deck, '.txcard__scroll should have a base rule')
  assert.ok(
    declares(deck, 'align-items', 'flex-start'),
    'the deck must still pack its children to the top — if this ever changes to the flex ' +
      'default, the two assertions below are no longer load-bearing and should be retired ' +
      'rather than left to pass for the wrong reason',
  )
})

test('the deck door stays a full-height tap target, the same way its day tab does', () => {
  const css = read('29-team-transactions.css')
  for (const selector of ['.txcard__door', '.txday']) {
    const body = ruleBody(css, selector)
    assert.ok(body, `${selector} should have a base rule`)
    assert.ok(
      declares(body, 'align-self', 'stretch'),
      `${selector} must declare align-self: stretch — .txcard__scroll packs its children to ` +
        'flex-start, so a child that wants the deck\'s full height has to ask for it',
    )
  }
})

test('a door keeps only placement, never dress, beside the shared rule', () => {
  // The other half of the same rule: the residual may not re-draw what `.door`
  // already draws. A colour or a border here would be the collapse coming
  // undone one declaration at a time, which is how it looked before #1161.
  const DRESS = ['color', 'background', 'border', 'border-radius', 'font-size', 'font-weight']
  const cases = [
    ['29-team-transactions.css', '.txcard__door'],
    ['72-club-transactions.css', '.txpage__door'],
  ]
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
