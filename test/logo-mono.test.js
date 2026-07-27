// The one-color knockout conversion behind the navy section mastheads
// (src/lib/logoMono.js, ADR-0031). Every case here is a shape real mlbstatic
// art actually takes — each was found by converting all ~150 clubs' marks and
// looking at the result, and the last two are live bugs the first pass shipped:
// a mark whose interior is a saturated cream turning into a solid blob, and a
// file that renders when inlined into HTML but fails to decode as its own
// image because a namespace prefix went undeclared.
import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyPaint, monoLogoSvg } from '../src/lib/logoMono.js'

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
