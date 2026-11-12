import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HIT_COORD_FT_PER_UNIT, HIT_COORD_ORIGIN } from '../src/lib/ballpark/hitProjection.js'
import { contactZones, fieldOrder, zoneLightness, zoneLabelOnLight } from '../src/screens/player/next/modules/contact/contactZones.js'

// A raw Gameday coordinate `deg` off dead centre (negative = left field), `ft` feet from the plate.
const at = (deg, ft) => {
  const r = (deg * Math.PI) / 180
  const u = ft / HIT_COORD_FT_PER_UNIT
  return { x: HIT_COORD_ORIGIN.x + u * Math.sin(r), y: HIT_COORD_ORIGIN.y - u * Math.cos(r) }
}
const ball = (deg, ft, la, side = 'R') => ({ ...at(deg, ft), launchAngle: la, side })
const cell = (z, dir, depth) => z.cells.find((c) => c.dir === dir && c.depth === depth)

test('nine zones by direction and depth: a righty pulls to left field', () => {
  const z = contactZones([ball(-30, 100, 5), ball(0, 200, 15), ball(30, 320, 35), ball(30, 300, 60)])
  assert.equal(z.cells.length, 9)
  assert.equal(z.n, 4)
  assert.equal(cell(z, 'pull', 'infield').n, 1)
  assert.equal(cell(z, 'center', 'shallow').n, 1)
  assert.equal(cell(z, 'oppo', 'deep').n, 2)
  assert.equal(cell(z, 'oppo', 'deep').share, 0.5)
})

test('a left-handed batter flips pull and oppo', () => {
  const z = contactZones([ball(30, 100, 5, 'L'), ball(-30, 100, 5, 'L')])
  assert.equal(cell(z, 'pull', 'infield').n, 1)
  assert.equal(cell(z, 'oppo', 'infield').n, 1)
})

test('the type filter keeps only that type; a pop-up counts as a fly ball', () => {
  const balls = [ball(0, 100, 5), ball(0, 120, 60), ball(0, 300, 35), ball(0, 220, 15)]
  const fly = contactZones(balls, 'fly')
  assert.equal(fly.n, 2)
  assert.equal(cell(fly, 'center', 'infield').n, 1) // the pop-up, caught on the infield
  assert.equal(cell(fly, 'center', 'deep').n, 1)
  assert.equal(contactZones(balls, 'line').n, 1)
})

test('All counts a ball with no launch angle; a type filter cannot place it', () => {
  const balls = [ball(0, 200, null), ball(0, 200, 15)]
  assert.equal(contactZones(balls).n, 2)
  assert.equal(contactZones(balls, 'line').n, 1)
})

test('a ball with no coordinate is not placed, and no balls gives null shares', () => {
  const z = contactZones([{ x: null, y: null, launchAngle: 20, side: 'R' }])
  assert.equal(z.n, 0)
  assert.ok(z.cells.every((c) => c.n === 0 && c.share === null))
})

test('fieldOrder runs left field to right field for the batter side', () => {
  assert.deepEqual(fieldOrder('R'), ['pull', 'center', 'oppo'])
  assert.deepEqual(fieldOrder('L'), ['oppo', 'center', 'pull'])
})

test('darker always means more: lightness falls as the share rises, on one fixed scale', () => {
  for (let v = 0; v < 0.4; v += 0.01) assert.ok(zoneLightness(v + 0.01) <= zoneLightness(v))
  assert.ok(zoneLightness(null) > 0.9)
})

// The fills are computed in the browser (CSS relative colour), so the token contrast lint never
// sees them. This repeats the browser's maths for every share and every hue, against the two label
// colours, so a retune of the ramp or a batted-ball token cannot drop a label under WCAG AA.
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
function toOklch([r, g, b]) {
  ;[r, g, b] = [r, g, b].map(lin)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [L, Math.hypot(a, bb), Math.atan2(bb, a)]
}
function fromOklch([L, C, h]) {
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, gam(Math.max(0, c)))))
}
const lum = (rgb) => { const [r, g, b] = rgb.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratio = (x, y) => { const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p); return (a + 0.05) / (b + 0.05) }

test('every zone label clears 4.5:1 on its fill, for every hue and share', async () => {
  const { readFileSync } = await import('node:fs')
  const css = readFileSync(new URL('../src/tokens/colors.css', import.meta.url), 'utf8')
  const tok = (name) => css.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))[1]
  const onLight = hex(tok('--zone-on-light'))
  const onDark = hex(tok('--zone-on-dark'))
  for (const name of ['--zone-all', '--batted-ground', '--batted-line', '--batted-fly']) {
    const [, c, h] = toOklch(hex(tok(name)))
    for (let v = 0; v <= 0.6; v += 0.005) {
      const fill = fromOklch([zoneLightness(v), c * 0.9, h])
      const r = ratio(fill, zoneLabelOnLight(v) ? onLight : onDark)
      assert.ok(r >= 4.5, `${name} at ${(v * 100).toFixed(1)}%: ${r.toFixed(2)}`)
    }
  }
})
