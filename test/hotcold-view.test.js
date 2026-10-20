import assert from 'node:assert/strict'
import test from 'node:test'
import { hotColdView, pastWord, toneTag } from '../src/screens/player/next/top/hotColdView.js'

// The words of a hot or cold callout on the player page (#1855, slice 2).

const hitLine = { g: 40, pa: 170, ab: 150, h: 45, d: 8, t: 1, hr: 9, bb: 15, hbp: 2, sf: 3, so: 30, sb: 2 }
const flag = (over) => ({
  role: 'hitting', key: 'hr', tone: 'hot', value: 9 / 170, percentile: 99.4,
  checkpoint: 40, sample: 40, weight: 'firm', pool: 3422, line: hitLine, ...over,
})
const SEASONS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]

test('a hot home-run pace reads like the issue: "9 HR", "In 40 games (0.23 a game)"', () => {
  const v = hotColdView(flag(), { seasons: SEASONS })
  assert.equal(v.kicker, 'Stretch')
  assert.equal(`${v.figure} ${v.rest}`, '9 HR In 40 games (0.23 a game)')
  assert.equal(v.hint, 'Better than 99% of 3,422 MLB seasons through 40 games, 2017–26')
})

test('a cold early AVG says early, worse, and the three-place rate', () => {
  const v = hotColdView(flag({ key: 'avg', tone: 'cold', value: 0.168, percentile: 1.3, weight: 'early', checkpoint: 20, line: { ...hitLine, g: 24 } }), { seasons: SEASONS })
  assert.equal(v.kicker, 'Early start')
  assert.equal(`${v.figure} ${v.rest}`, '.168 AVG Through 24 games')
  assert.match(v.hint, /^Worse than 98% of 3,422 MLB seasons through 20 games/)
})

test('a pitcher reads in innings, and a two-way kicker names the role', () => {
  const line = { g: 30, outs: 487, bf: 640, h: 120, hr: 12, bb: 30, hbp: 4, so: 180, er: 39 }
  const v = hotColdView(flag({ role: 'pitching', key: 'era', value: 2.16, percentile: 1.9, weight: 'real', checkpoint: 160, line }), { seasons: SEASONS, twoWay: true })
  assert.equal(v.kicker, 'Full season · pitching')
  assert.equal(`${v.figure} ${v.rest}`, '2.16 ERA Through 162.1 innings')
  // A low ERA is the hot side: it says better, never bottom.
  assert.match(v.hint, /^Better than 98% of 3,422 MLB seasons through 160 innings/)
})

test('pastWord counts the side of the league the line is past, and never says 100%', () => {
  assert.deepEqual([100, 99.6, 98.1, 0, 0.4, 1.9].map((p) => pastWord('hot', p)),
    ['Better than 99%', 'Better than 99%', 'Better than 98%', 'Better than 99%', 'Better than 99%', 'Better than 98%'])
  assert.equal(pastWord('cold', 99.2), 'Worse than 99%')
})

test('toneTag counts each tone for the card tag', () => {
  assert.equal(toneTag([{ tone: 'hot' }]), '1 hot')
  assert.equal(toneTag([{ tone: 'cold' }, { tone: 'cold' }]), '2 cold')
  assert.equal(toneTag([{ tone: 'cold' }, { tone: 'hot' }]), '1 hot · 1 cold')
})
