// Repainting individual SHAPES of a club's mark in full color — the Logo art
// editor in /identity-lab (src/lib/logoRecolor.js, ADR-0031's amendment). Shares
// logoMono.js's shape numbering on purpose, which is what these first cases
// pin: a shape means the same thing in both editors or the two disagree about
// what you clicked.
import assert from 'node:assert/strict'
import test from 'node:test'
import { monoLogoParts } from '../src/lib/logoMono.js'
import {
  TRANSPARENT_PAINT,
  isRecolorHex,
  isRecolorPaint,
  markSlug,
  recolorSvg,
} from '../src/lib/logoRecolor.js'

const wrap = (body, attrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg"${attrs} viewBox="0 0 100 100">${body}</svg>`

const twoShapes = wrap(
  '<path d="M0 0h9v9H0z" fill="#12284b"/><circle cx="5" cy="5" r="3" fill="#ffc52f"/>',
)

test('a repaint hits the shape it names and leaves the others alone', () => {
  const out = recolorSvg(twoShapes, { 1: '#e03a3e' })
  assert.match(out, /<circle[^>]*style="fill:#e03a3e"/)
  assert.match(out, /<path[^>]*fill="#12284b"/)
})

test('shape numbering is the same one the knockout editor uses', () => {
  // Both editors index by monoLogoParts' ordinal, so this is the contract that
  // lets a shape be judged in one panel and repainted in the other.
  assert.deepEqual(monoLogoParts(twoShapes).map((p) => p.index), [0, 1])
  const out = recolorSvg(twoShapes, { 0: '#ffffff' })
  assert.match(out, /<path[^>]*style="fill:#ffffff"/)
  assert.doesNotMatch(out, /<circle[^>]*style=/)
})

test('a repaint beats a fill declared in a <style> rule, not just an attribute', () => {
  // A CSS rule outranks a presentation attribute, so anything less than an
  // inline style would silently not apply to Illustrator's class-based exports.
  const out = recolorSvg(
    wrap('<style>.cls-1{fill:#12284b}</style><path class="cls-1" d="M0 0h9v9H0z"/>'),
    { 0: '#e03a3e' },
  )
  assert.match(out, /<path[^>]*style="fill:#e03a3e"/)
})

test('no repaints returns the art untouched, and non-art returns null', () => {
  assert.equal(recolorSvg(twoShapes, {}), twoShapes)
  assert.equal(recolorSvg(twoShapes, null), twoShapes)
  assert.equal(recolorSvg('not markup', { 0: '#fff' }), null)
  assert.equal(recolorSvg(null, { 0: '#fff' }), null)
})

test('only a hex counts as a color', () => {
  assert.ok(isRecolorHex('#fff'))
  assert.ok(isRecolorHex('#FFC52F'))
  assert.ok(!isRecolorHex('white'))
  assert.ok(!isRecolorHex('rgb(0,0,0)'))
  assert.ok(!isRecolorHex('#ff'))
  assert.ok(!isRecolorHex(''))
  assert.ok(!isRecolorHex(null))
})

test('a mark name slugifies into something safe to put in a filename', () => {
  assert.equal(markSlug('Serpent Red'), 'serpent-red')
  assert.equal(markSlug('  City Connect (2024)  '), 'city-connect-2024')
  // The filename is built from this, so anything path-shaped has to come out
  // inert — the endpoint's own resolver re-checks, but this is the first gate.
  assert.equal(markSlug('../../etc/passwd'), 'etc-passwd')
  assert.equal(markSlug('!!!'), '')
  assert.equal(markSlug(''), '')
})

test('a shape can be repainted TRANSPARENT, which erases it in place', () => {
  // The shapes stacked above an erased one must stay exactly where they are —
  // this is how a mark's backing plate comes off so the art can sit on a
  // colored jersey tile, not an undo.
  const out = recolorSvg(twoShapes, { 0: TRANSPARENT_PAINT })
  assert.match(out, /<path[^>]*style="fill:none"/)
  assert.match(out, /<circle[^>]*fill="#ffc52f"/)
})

test('an erased shape drops its stroke too, but only if it had one', () => {
  // Left alone, a stroked shape would keep drawing its outline after its fill
  // went — a hollow ghost of the shape that was supposed to disappear.
  const stroked = recolorSvg(
    wrap('<path d="M0 0h9v9H0z" fill="#12284b" stroke="#ffc52f"/>'),
    { 0: TRANSPARENT_PAINT },
  )
  assert.match(stroked, /style="fill:none;stroke:none"/)
  assert.doesNotMatch(recolorSvg(twoShapes, { 0: TRANSPARENT_PAINT }), /stroke:/)
})

test('transparent counts as a paint, but never as a hex', () => {
  // The palette and the swatch previews render hexes; `none` is their own case,
  // which is why the two gates stay separate.
  assert.ok(isRecolorPaint(TRANSPARENT_PAINT))
  assert.ok(isRecolorPaint('#fff'))
  assert.ok(!isRecolorHex(TRANSPARENT_PAINT))
  assert.ok(!isRecolorPaint('transparent'))
})
