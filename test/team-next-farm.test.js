import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')

// A rank reads "11th", never "#11" (#1107, row 6d).
test('the Farm rank labels are ordinals, not "#"', () => {
  assert.doesNotMatch(read('screens/team/modules/minors/DepthChartCard.jsx'), />#\{/)
  assert.doesNotMatch(read('screens/team/modules/minors/ProspectsCard.jsx'), />#\{/)
})

test('the Farm band keeps the prospect count and the one-shot motion gate', () => {
  const src = read('screens/team/next/farm/index.jsx')
  assert.match(src, /m\.prospects\.length/)
  assert.match(src, /useViewOnce\(team\.id, 'team-\w+'/)
})

test('farm.css is tokens only and square', () => {
  const css = read('styles/team-next/farm.css').replace(/\/\*[^]*?\*\//g, '')
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/)
  assert.doesNotMatch(css, /border-radius:\s*[^0\s]/)
})
