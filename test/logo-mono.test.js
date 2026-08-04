// The one-color knockout conversion behind the navy section mastheads
// (src/lib/logoMono.js, ADR-0031). Every case here is a shape real mlbstatic
// art actually takes — each was found by converting all ~150 clubs' marks and
// looking at the result, and the last two are live bugs the first pass shipped:
// a mark whose interior is a saturated cream turning into a solid blob, and a
// file that renders when inlined into HTML but fails to decode as its own
// image because a namespace prefix went undeclared.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyPaint,
  monoLogoFingerprint,
  monoLogoParts,
  monoLogoPickerSvg,
  monoLogoSvg,
} from '../src/lib/logoMono.js'

const wrap = (body, attrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg"${attrs} viewBox="0 0 100 100">${body}</svg>`

// --------------------------------------------------------------------------
// classifyPaint — which fills are the mark and which are the paper under it
// --------------------------------------------------------------------------
test('white and near-white fills are the paper the mark sits on', () => {
  assert.equal(classifyPaint('#fff'), 'knockout')
  assert.equal(classifyPaint('#FFFFFF'), 'knockout')
  assert.equal(classifyPaint('white'), 'knockout')
  assert.equal(classifyPaint('#d8d9da'), 'knockout') // Chattanooga's grey outline
})

test('a saturated CREAM is paper too, not ink', () => {
  // Asheville (#f0f7e8) and Greensboro (#f1e5c7) both draw their mascot on a
  // tinted off-white. Reading these as ink is what turned them into blobs.
  assert.equal(classifyPaint('#f0f7e8'), 'knockout')
  assert.equal(classifyPaint('#f1e5c7'), 'knockout')
})

test('a saturated BRAND color stays ink however light it is', () => {
  assert.equal(classifyPaint('#ffc52f'), 'ink') // Brewers gold
  assert.equal(classifyPaint('#f4d09b'), 'ink') // the tan in Biloxi's oyster
  assert.equal(classifyPaint('#0067b1'), 'ink')
  assert.equal(classifyPaint('#231f20'), 'ink')
})

test('a paint that names no color is left exactly as it is', () => {
  assert.equal(classifyPaint('none'), null)
  assert.equal(classifyPaint('transparent'), null)
  assert.equal(classifyPaint('currentColor'), null)
  assert.equal(classifyPaint(''), null)
  assert.equal(classifyPaint(undefined), null)
})

test('an unreadable paint errs toward ink rather than erasing the shape', () => {
  assert.equal(classifyPaint('url(#gradient)'), 'ink')
  assert.equal(classifyPaint('rebeccapurple'), 'ink')
})

// --------------------------------------------------------------------------
// monoLogoSvg — the rebuilt mark
// --------------------------------------------------------------------------
test('ink is kept and paper is punched out of the mask', () => {
  const out = monoLogoSvg(wrap('<path d="M0 0h10v10H0z" fill="#0067b1"/><circle cx="5" cy="5" r="2" fill="#fff"/>'))
  assert.match(out, /<mask id="ink"/)
  assert.match(out, /<path d="M0 0h10v10H0z" fill="#fff"\/>/) // the blue body -> opaque
  assert.match(out, /<circle cx="5" cy="5" r="2" fill="#000"\/>/) // the white hole -> punched
  assert.match(out, /<rect [^>]*mask="url\(#ink\)"/)
})

test('fills are rewritten wherever the art states them', () => {
  // Illustrator exports use all three forms, sometimes in one file.
  const out = monoLogoSvg(
    wrap(
      '<style>.a{fill:#fff}.b{fill:#12284b}</style>' +
        '<path class="a" d="M0 0h1v1H0z"/><path class="b" d="M1 1h1v1H1z"/>' +
        '<path style="fill:#fff" d="M2 2h1v1H2z"/><path fill="#12284b" d="M3 3h1v1H3z"/>',
    ),
  )
  assert.equal(out.match(/fill:#000/g).length, 2)
  assert.equal(out.match(/fill:#fff/g).length, 1)
  assert.match(out, /fill="#fff" d="M3 3h1v1H3z"/)
})

test('a shape that states no fill is inked, not silently punched out', () => {
  // SVG's own default fill is black, which in mask space means "erase" — the
  // White Sox mark is four unfilled paths plus one white knockout.
  const out = monoLogoSvg(wrap('<path d="M0 0h9v9H0z"/><path d="M1 1h2v2H1z" fill="#fff"/>'))
  assert.match(out, /<g fill="#fff">/)
  assert.match(out, /<path d="M0 0h9v9H0z"\/>/) // untouched: it inherits ink
})

test('stroke colors are re-inked, but stroke-width and fill-opacity are not', () => {
  const out = monoLogoSvg(
    wrap('<path d="M0 0h9v9H0z" fill="none" stroke="#12284b" stroke-width="2" fill-opacity=".5"/>'),
  )
  assert.match(out, /stroke="#fff"/)
  assert.match(out, /fill="none"/)
  assert.match(out, /stroke-width="2"/)
  assert.match(out, /fill-opacity="\.5"/)
})

test('namespace declarations carry over so the file decodes as its own image', () => {
  // Albuquerque and Everett both use xlink:href (a <use>, and a gradient
  // inheriting another's stops). An SVG loaded as an image is parsed as strict
  // XML, so dropping the declaration makes the whole file fail to render —
  // invisibly, because inlining it into HTML still works.
  const out = monoLogoSvg(
    wrap('<defs><path id="a" d="M0 0h9v9H0z" fill="#12284b"/></defs><use xlink:href="#a"/>', ' xmlns:xlink="http://www.w3.org/1999/xlink"'),
  )
  assert.match(out, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/)
})

test('art using a prefix nobody declared is skipped rather than written broken', () => {
  const out = monoLogoSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><use xlink:href="#a" fill="#12284b"/></svg>',
  )
  assert.equal(out, null)
})

test('the mask id is scopeable so several marks can share a document', () => {
  const out = monoLogoSvg(wrap('<path d="M0 0h9v9H0z" fill="#12284b"/>'), { maskId: 'ink-158' })
  assert.match(out, /<mask id="ink-158"/)
  assert.match(out, /mask="url\(#ink-158\)"/)
})

test('the viewBox is preserved so the mark keeps its own geometry', () => {
  const out = monoLogoSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60.764 71.998"><path d="M0 0h9v9H0z" fill="#12284b"/></svg>',
  )
  assert.match(out, /viewBox="0 0 60.764 71.998"/)
  assert.match(out, /<rect x="0" y="0" width="60.764" height="71.998"/)
})

test('a decorative <title> is dropped', () => {
  const out = monoLogoSvg(wrap('<title>Chicago Cubs hat dark logo</title><path d="M0 0h9v9H0z" fill="#0e3386"/>'))
  assert.doesNotMatch(out, /<title>/)
})

test('art that cannot be re-inked falls back instead of writing an empty mark', () => {
  // No viewBox to build the mask geometry from…
  assert.equal(monoLogoSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h9v9H0z"/></svg>'), null)
  // …an embedded raster, which carries no fills to classify…
  assert.equal(monoLogoSvg(wrap('<image href="logo.png" width="100" height="100"/>')), null)
  // …a mark that is nothing but paper…
  assert.equal(monoLogoSvg(wrap('<path d="M0 0h9v9H0z" fill="#fff"/>')), null)
  // …and the non-answers.
  assert.equal(monoLogoSvg(''), null)
  assert.equal(monoLogoSvg(null), null)
})

// --------------------------------------------------------------------------
// Per-shape pins — the hand correction picked in /identity-lab's Knockout mark
// editor and applied by the generator (src/lib/monoInk.js,
// scripts/lib/mono-logo-art.mjs). The classifier is a heuristic over art nobody
// controls, so the escape hatch has to be exact about WHICH shape it moves.
// --------------------------------------------------------------------------
const twoShapes = wrap(
  '<path d="M0 0h9v9H0z" fill="#12284b"/><circle cx="5" cy="5" r="3" fill="#ffc52f"/>',
)

test('parts report each shape\'s own fill and the verdict it gets automatically', () => {
  const parts = monoLogoParts(twoShapes)
  assert.deepEqual(
    parts.map((p) => [p.index, p.tag, p.fill, p.auto]),
    [
      [0, 'path', '#12284b', 'ink'],
      [1, 'circle', '#ffc52f', 'ink'],
    ],
  )
})

test('a fill stated only in a <style> rule still shows up as that shape\'s color', () => {
  const parts = monoLogoParts(
    wrap('<style>.cls-1{fill:#12284b}</style><path class="cls-1" d="M0 0h9v9H0z"/>'),
  )
  assert.equal(parts[0].fill, '#12284b')
  assert.equal(parts[0].auto, 'ink')
})

test('a shape that states no paint at all inherits ink, not an undecided verdict', () => {
  // The wrapper group monoLogoSvg builds makes the inherited default ink, so
  // the picker must not offer this as unclassified.
  const parts = monoLogoParts(wrap('<path d="M0 0h9v9H0z"/>'))
  assert.equal(parts[0].fill, null)
  assert.equal(parts[0].auto, 'ink')
})

test('pinning a shape to knockout punches it out of the mask', () => {
  const out = monoLogoSvg(twoShapes, { pins: { 1: 'knockout' } })
  // The pin lands as an inline style, which is the only paint that beats both
  // an attribute and a <style> rule.
  assert.match(out, /<circle[^>]*style="fill:#000"/)
  // …and the shape nobody pinned keeps the automatic answer.
  assert.match(out, /<path[^>]*fill="#fff"/)
})

test('pinning a shape to ink rescues art the automatic pass reads as all paper', () => {
  // A mark drawn entirely in a pale brand color converts to nothing today —
  // the bail that stops an empty file being written. One pin is enough to make
  // it convertible again.
  const allPaper = wrap('<path d="M0 0h9v9H0z" fill="#f4f1ea"/>')
  assert.equal(monoLogoSvg(allPaper), null)
  const out = monoLogoSvg(allPaper, { pins: { 0: 'ink' } })
  assert.match(out, /<path[^>]*style="fill:#fff"/)
})

test('a pin replaces a conflicting fill in an existing style attribute, keeping the rest', () => {
  const out = monoLogoSvg(
    wrap('<path d="M0 0h9v9H0z" style="opacity:.5;fill:#12284b"/>'),
    { pins: { 0: 'knockout' } },
  )
  assert.match(out, /style="opacity:\.5;fill:#000"/)
  assert.doesNotMatch(out, /fill:#12284b/)
})

test('a pin repaints a stroke only when the shape already draws one', () => {
  // Handing a stroke color to a shape that has none turns SVG's 1px default on
  // and outlines something that was never outlined.
  const stroked = monoLogoSvg(
    wrap('<path d="M0 0h9v9H0z" fill="#12284b" stroke="#ffc52f"/>'),
    { pins: { 0: 'ink' } },
  )
  assert.match(stroked, /style="fill:#fff;stroke:#fff"/)
  const plain = monoLogoSvg(twoShapes, { pins: { 0: 'ink' } })
  assert.doesNotMatch(plain, /stroke:/)
})

test('the picker stamps the same indices the pins use', () => {
  const picker = monoLogoPickerSvg(twoShapes)
  assert.match(picker, /<path[^>]*data-mono-part="0"/)
  assert.match(picker, /<circle[^>]*data-mono-part="1"/)
  // Same numbering monoLogoParts hands the list of buttons beside the art.
  assert.deepEqual(monoLogoParts(twoShapes).map((p) => p.index), [0, 1])
})

test('the picker does NOT make markup safe to inline — that is a parser\'s job', () => {
  // It stamps and nothing else. This used to strip <script> and on* handlers
  // with regex replaces, which cannot be made correct (a closing tag may carry
  // whitespace and attributes; one pass can re-form what it removes). Callers
  // sanitize at fetch with src/lib/svgSanitize.js and pass the result here, so
  // this asserts the narrowed contract rather than a filter that half-worked.
  const stamped = monoLogoPickerSvg(wrap('<path d="M0 0h9v9H0z" onclick="x()"/>'))
  assert.match(stamped, /onclick/)
  assert.match(stamped, /data-mono-part="0"/)
})

test('the fingerprint tracks the SHAPES, so pins survive a recolor but not a redraw', () => {
  const recolored = wrap('<path d="M0 0h9v9H0z" fill="#000"/><circle cx="5" cy="5" r="3" fill="#fff"/>')
  assert.equal(monoLogoFingerprint(twoShapes), monoLogoFingerprint(recolored))
  const redrawn = wrap('<path d="M1 1h8v8H1z" fill="#12284b"/><circle cx="5" cy="5" r="3" fill="#ffc52f"/>')
  assert.notEqual(monoLogoFingerprint(twoShapes), monoLogoFingerprint(redrawn))
  // A shape added or removed moves it too — that's the case that would slide
  // every pin onto the wrong shape.
  assert.notEqual(monoLogoFingerprint(twoShapes), monoLogoFingerprint(wrap('<path d="M0 0h9v9H0z" fill="#12284b"/>')))
})

// --------------------------------------------------------------------------
// Compound-path splitting — Illustrator's "one <path>, several disconnected
// pieces" shorthand (Chattanooga's octagon frame plus its letters' accent
// squiggles, all one path/one fill) would otherwise put several unrelated
// shapes behind a single pin.
// --------------------------------------------------------------------------
const compoundPath = wrap('<path d="M0 0h9v9H0zM20 20h9v9H20zM40 40h9v9H40z" fill="#12284b"/>')

test('a compound path with several subpaths splits into one part per subpath', () => {
  const parts = monoLogoParts(compoundPath)
  assert.deepEqual(
    parts.map((p) => [p.index, p.tag, p.fill]),
    [
      [0, 'path', '#12284b'],
      [1, 'path', '#12284b'],
      [2, 'path', '#12284b'],
    ],
  )
})

test('a single-subpath path is left as one part', () => {
  assert.equal(monoLogoParts(twoShapes).length, 2)
})

test('a subpath opening with a relative "m" stays merged with its predecessor', () => {
  // A relative moveto positions itself against the PREVIOUS subpath's end
  // point — a standalone element wouldn't know that point, so splitting here
  // would move the shape rather than just separate it.
  const parts = monoLogoParts(wrap('<path d="M0 0h9v9H0zm20 20h9v9h-9z" fill="#12284b"/>'))
  assert.equal(parts.length, 1)
})

// Attribute order within a split tag isn't a contract — just that a whole
// <path ... /> tag carrying this `d` also carries the expected paint.
function tagWithD(svg, d) {
  const escaped = d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`<path\\b[^>]*d="${escaped}"[^>]*/>`).exec(svg)?.[0] ?? ''
}

test('the picker stamps split subpaths with their own indices, and a pin addresses just one', () => {
  const picker = monoLogoPickerSvg(compoundPath)
  assert.match(tagWithD(picker, 'M0 0h9v9H0z'), /data-mono-part="0"/)
  assert.match(tagWithD(picker, 'M20 20h9v9H20z'), /data-mono-part="1"/)
  assert.match(tagWithD(picker, 'M40 40h9v9H40z'), /data-mono-part="2"/)

  const out = monoLogoSvg(compoundPath, { pins: { 1: 'knockout' } })
  assert.match(tagWithD(out, 'M20 20h9v9H20z'), /style="fill:#000"/)
  assert.match(tagWithD(out, 'M0 0h9v9H0z'), /fill="#fff"/)
  assert.match(tagWithD(out, 'M40 40h9v9H40z'), /fill="#fff"/)
})
