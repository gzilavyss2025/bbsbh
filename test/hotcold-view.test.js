import assert from 'node:assert/strict'
import test from 'node:test'
import { LIST_MAX, hintWords, hotColdView, listView, sampleWords, toneTag } from '../src/screens/player/next/top/hotColdView.js'

// The words of a hot or cold callout on the player page (#1855): design B, the sentence as
// the headline, said the way a person would say it, with an exact count (Gary, 2026-10-20).

const hitLine = { g: 40, pa: 170, ab: 150, h: 45, d: 8, t: 1, hr: 9, bb: 15, hbp: 2, sf: 3, so: 30, sb: 2 }
const past = (n, start = 1) => Array.from({ length: n }, (_, i) => (
  { value: 0.07 - i * 0.001, id: start + i, season: 2018 + (i % 8), name: `Player ${start + i}`, team: i % 2 ? null : 'Padres' }
))
const flag = (over) => ({
  role: 'hitting', key: 'hr', tone: 'hot', value: 9 / 170, percentile: 99.4,
  checkpoint: 40, sample: 40, weight: 'firm', pool: 3422, line: hitLine, beyond: past(3), teamName: 'Brewers', ...over,
})
const SEASONS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]

test('a hot home-run pace: the exact count as the headline, then the figure and sample', () => {
  const v = hotColdView(flag(), { seasons: SEASONS })
  assert.equal(v.headline, 'Only 3 hitters in the last 10 years had a better home-run pace through 40 games.')
  assert.equal(v.line, '9 HR · In 40 games (0.23 a game)')
})

test('a cold early AVG says worse, and this early in a season', () => {
  const v = hotColdView(flag({ key: 'avg', tone: 'cold', value: 0.168, percentile: 1.3, weight: 'early', checkpoint: 20, line: { ...hitLine, g: 24 }, beyond: past(1) }), { seasons: SEASONS })
  assert.equal(v.headline, 'Only 1 hitter in the last 10 years had a worse batting average this early in a season.')
  assert.equal(v.line, '.168 AVG · Through 24 games')
})

test('a pitcher over a full season, and a two-way line names the role', () => {
  const line = { g: 30, outs: 487, bf: 640, h: 120, hr: 12, bb: 30, hbp: 4, so: 180, er: 39 }
  const v = hotColdView(flag({ role: 'pitching', key: 'era', value: 2.16, percentile: 1.9, weight: 'real', checkpoint: 160, line, beyond: past(5) }), { seasons: SEASONS, twoWay: true })
  // A low ERA is the hot side: it says better, never bottom; and ERA stays singular.
  assert.equal(v.headline, 'Only 5 pitchers in the last 10 years had a better ERA over a full season.')
  assert.equal(v.line, 'Pitching · 2.16 ERA · Through 162.1 innings')
})

test('hintWords keeps the count true when a player is in the list twice, or no one is', () => {
  const base = { tone: 'hot', who: 'pitchers', noun: 'ERA', sample: 'over a full season', years: ' in the last 10 years' }
  const twice = [{ id: 1 }, { id: 2 }, { id: 1 }]
  assert.equal(hintWords({ ...base, beyond: twice }), 'Only 3 times in the last 10 years has a pitcher had a better ERA over a full season.')
  assert.equal(hintWords({ ...base, beyond: [] }), 'No pitcher in the last 10 years had a better ERA over a full season.')
  // The list failed to load: no number at all.
  assert.equal(hintWords({ ...base, beyond: null }), 'Among the best over a full season in the last 10 years.')
})

test('sampleWords: early, a count in the middle, then a full season', () => {
  assert.deepEqual([10, 20, 30, 80, 140, 150, 160].map((c) => sampleWords(c, 'games')), [
    'this early in a season', 'this early in a season', 'through 30 games', 'through 80 games',
    'through 140 games', 'over a full season', 'over a full season',
  ])
})

test('listView ranks the seasons with their club, then his own in its place', () => {
  const list = listView(flag({ beyond: past(2) }), { name: 'Me', season: 2026 })
  assert.deepEqual(list.rows.map((r) => [r.rank, r.name, r.sub, r.self]), [
    [1, 'Player 1', '2018 · Padres', false],
    [2, 'Player 2', '2019', false], // the club is not known: the season alone
    [3, 'Me', '2026 · Brewers', true],
  ])
  assert.equal(list.rows[0].value, '1 per 14 PA')
  assert.equal(list.more, 0)
  // A long early list shows LIST_MAX and counts the rest.
  const long = listView(flag({ beyond: past(LIST_MAX + 7) }), { name: 'Me', season: 2026 })
  assert.equal(long.rows.length, LIST_MAX + 1)
  assert.equal(long.rows.at(-1).rank, LIST_MAX + 8)
  assert.equal(long.more, 7)
  // Nothing past him: nothing to show.
  assert.equal(listView(flag({ beyond: [] }), { name: 'Me', season: 2026 }), null)
})

test('toneTag counts each tone for the card tag', () => {
  assert.equal(toneTag([{ tone: 'hot' }]), '1 hot')
  assert.equal(toneTag([{ tone: 'cold' }, { tone: 'cold' }]), '2 cold')
  assert.equal(toneTag([{ tone: 'cold' }, { tone: 'hot' }]), '1 hot · 1 cold')
})
