// Coverage for the team-mark background wash (src/lib/logoTint.js): picking
// the brand color out of raw SVG markup, then mixing it toward a pale tint.
import assert from 'node:assert/strict'
import test from 'node:test'
import { brandColorFromSvg, tintFromSvg } from '../src/lib/logoTint.js'

test('brandColorFromSvg picks the darkest reasonably-saturated fill', () => {
  const svg = '<svg><path fill="#12284b"/><path fill="#ffc52f"/><path fill="#eeeeee"/></svg>'
  // Navy (#12284b) is darker than gold (#ffc52f) and near-white gray, so it wins.
  assert.equal(brandColorFromSvg(svg), '12284b')
})

test('brandColorFromSvg skips near-white and near-black fills', () => {
  const svg = '<svg><path fill="#ffffff"/><path fill="#000000"/><path fill="#0067b1"/></svg>'
  assert.equal(brandColorFromSvg(svg), '0067b1')
})

test('brandColorFromSvg reads fill:#… inside a style attribute, and expands 3-digit hex', () => {
  const svg = '<svg><path style="fill:#abc"/></svg>'
  assert.equal(brandColorFromSvg(svg), 'aabbcc')
})

test('brandColorFromSvg prefers a darker, more saturated color over a lighter, less saturated one', () => {
  // A pale, low-saturation gray vs. a fully saturated mid-tone brand color —
  // the score formula should favor the real color even though it isn't darkest.
  const svg = '<svg><path fill="#cccccc"/><path fill="#c8102e"/></svg>'
  assert.equal(brandColorFromSvg(svg), 'c8102e')
})

test('brandColorFromSvg is null when the markup has no usable fills', () => {
  assert.equal(brandColorFromSvg('<svg><path fill="#ffffff"/></svg>'), null)
  assert.equal(brandColorFromSvg('<svg><path d="M0 0h1v1H0z"/></svg>'), null)
  assert.equal(brandColorFromSvg(''), null)
})

test('tintFromSvg mixes the brand color toward white at the default fraction', () => {
  // #101010 (l ≈ 0.063, just above the near-black cutoff) mixed 16% in lands
  // at round(16*0.16 + 255*0.84) = 217 (0xd9) per channel.
  const svg = '<svg><path fill="#101010"/></svg>'
  assert.equal(tintFromSvg(svg), '#d9d9d9')
})

test('tintFromSvg honors a custom mix fraction', () => {
  const svg = '<svg><path fill="#000000"/></svg>'
  // frac=1 keeps the color unchanged (fully saturated, so it survives the l<0.06 filter? no — pure black is filtered out)
  // use a dark-but-not-near-black color instead so it isn't skipped by brandColorFromSvg.
  const svgUsable = '<svg><path fill="#101010"/></svg>'
  assert.equal(tintFromSvg(svgUsable, 0), '#ffffff') // frac=0 -> pure white regardless of brand color
  assert.equal(tintFromSvg(svgUsable, 1), '#101010') // frac=1 -> the brand color itself, unmixed
})

test('tintFromSvg is null when no brand color can be found', () => {
  assert.equal(tintFromSvg('<svg><path fill="#ffffff"/></svg>'), null)
  assert.equal(tintFromSvg(''), null)
})
