import assert from 'node:assert/strict'
import test from 'node:test'
import { geoAlbersUsa } from 'd3-geo'
import { albersUsa } from '../scripts/lib/from/project.mjs'

// The nightly run cannot import d3-geo, so project.mjs ports geoAlbersUsa. This pins the
// port to the real thing (#1526).
const d3 = geoAlbersUsa().scale(1300).translate([487.5, 305])

test('albersUsa matches d3-geo on a grid over the lower 48, Alaska and Hawaii', () => {
  let checked = 0
  for (let lat = 18; lat <= 72; lat += 1.5) {
    for (let lon = -180; lon <= -64; lon += 1.5) {
      const want = d3([lon, lat])
      const got = albersUsa(lon, lat)
      if (!want) {
        assert.equal(got, null, `${lat},${lon} should be off the map`)
        continue
      }
      assert.ok(got, `${lat},${lon} is on the map`)
      assert.ok(Math.abs(got[0] - want[0]) < 0.06 && Math.abs(got[1] - want[1]) < 0.06, `${lat},${lon}: ${got} vs ${want}`)
      checked += 1
    }
  }
  assert.ok(checked > 800, `only ${checked} points were on the map`)
})

test('albersUsa places known cities where d3-geo does', () => {
  for (const [name, lon, lat] of [['Atlanta', -84.39, 33.75], ['Anchorage', -149.9, 61.22], ['Honolulu', -157.86, 21.31], ['Seattle', -122.33, 47.61]]) {
    const want = d3([lon, lat])
    const got = albersUsa(lon, lat)
    assert.ok(Math.abs(got[0] - want[0]) < 0.06 && Math.abs(got[1] - want[1]) < 0.06, name)
  }
})

test('albersUsa returns null far from the United States', () => {
  assert.equal(albersUsa(2.35, 48.85), null)
  assert.equal(albersUsa(-70.0, -33.0), null)
})
