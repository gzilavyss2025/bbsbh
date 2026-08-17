// The cross-club pivot behind the standalone Team Records page
// (src/api/teamRecordRankings.js): one situational split, every club at a
// level, in rank order.
//
// The cases here are the ones where "sort it highest first" is the wrong
// answer — a count whose good end is the low one, a club that has never been in
// the split at all, a shared rank, and a split that exists at MLB but not below
// it. The tally itself is teamRecords.js's and is pinned in
// test/team-records.test.js; nothing is re-tested here.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRankingIndex, rankMetric, defaultOrder } from '../src/api/teamRecordRankings.js'

const row = (over) => ({ d: '2026-04-01', o: 10, r: 'W', rs: 4, ra: 2, hi: 9, ha: 7, ...over })

// One club's entry, as fetchLevelTeamRecords hands it over: the static club
// record next to that club's season ledger.
const entry = (id, name, games, over = {}) => ({
  team: { id, name },
  data: {
    teamId: id,
    season: 2026,
    sportId: 1,
    allStarDate: '2026-07-14',
    opponents: { 10: { l: 104, v: 205 } },
    names: { leagues: { 104: 'National League' }, divisions: { 205: 'National League Central' } },
    dailyRank: {},
    games,
    ...over,
  },
})

const ranked = (result) => result.ranked.map((r) => [r.team.name, r.rank])

// ---------------------------------------------------------------------------
// The pivot
// ---------------------------------------------------------------------------

test('a split ranks every club that has it, best win percentage first', () => {
  const index = buildRankingIndex([
    entry(1, 'Alphas', [row({ rs: 5 }), row({ d: '2026-04-02', rs: 5, r: 'L' })]),
    entry(2, 'Betas', [row({ rs: 5 }), row({ d: '2026-04-02', rs: 5 })]),
  ])
  const result = rankMetric(index, 'scored-4-plus')
  assert.deepEqual(ranked(result), [['Betas', 1], ['Alphas', 2]])
  assert.equal(result.of, 2)
  assert.equal(result.ranked[0].v, '2-0')
})

test('the menu carries the card’s own groups, and by-league is MLB only', () => {
  const mlb = buildRankingIndex([entry(1, 'Alphas', [row({})])])
  const titles = mlb.groups.map((g) => g.title)
  assert.ok(titles.includes('Scoring'))
  assert.ok(titles.includes('By league'))
  assert.ok(titles.includes('Season counts'))

  const milb = buildRankingIndex([entry(1, 'Alphas', [row({})], { sportId: 11 })])
  assert.ok(!milb.groups.some((g) => g.title === 'By league'))
})

test('months sort by the calendar, not by whichever club opened its season first', () => {
  const index = buildRankingIndex([
    entry(1, 'Alphas', [row({ d: '2026-04-01' })]),
    entry(2, 'Betas', [row({ d: '2026-03-28' })]),
  ])
  const months = index.groups.find((g) => g.title === 'By month').metrics.map((m) => m.id)
  assert.deepEqual(months, ['month-3', 'month-4'])
})

// ---------------------------------------------------------------------------
// Which end is the good one
// ---------------------------------------------------------------------------

test('a count whose good end is the low one opens ascending, not highest-first', () => {
  const index = buildRankingIndex([
    entry(1, 'Alphas', [row({ ll: 1 }), row({ d: '2026-04-02', ll: 1, r: 'L' })]),
    entry(2, 'Betas', [row({})]),
  ])
  const result = rankMetric(index, 'count-losses-after-leading')
  assert.equal(result.order, 'asc')
  // Fewest first: the club that has never blown a lead leads the column.
  assert.deepEqual(ranked(result), [['Betas', 1], ['Alphas', 2]])
  assert.ok(result.byQuality)
})

test('the same shape read the other way round still opens with the leader on top', () => {
  const index = buildRankingIndex([
    entry(1, 'Alphas', [row({ wo: 1 })]),
    entry(2, 'Betas', [row({})]),
  ])
  const result = rankMetric(index, 'count-walk-off-wins')
  assert.equal(result.order, 'desc')
  assert.deepEqual(ranked(result), [['Alphas', 1], ['Betas', 2]])
})

test('a count with no good end is ranked but makes no claim about quality', () => {
  const index = buildRankingIndex([entry(1, 'Alphas', [row({})])])
  const result = rankMetric(index, 'count-days-3')
  assert.equal(result.byQuality, false)
  assert.equal(result.order, 'desc')
})

test('"how often" is a neutral sort even on a W-L split that has a best end', () => {
  const index = buildRankingIndex([entry(1, 'Alphas', [row({})])])
  assert.equal(rankMetric(index, 'scored-4-plus', { sortBy: 'pct' }).byQuality, true)
  assert.equal(rankMetric(index, 'scored-4-plus', { sortBy: 'played' }).byQuality, false)
})

test('an explicit order overrides the metric’s own default', () => {
  const index = buildRankingIndex([
    entry(1, 'Alphas', [row({ ll: 1 })]),
    entry(2, 'Betas', [row({})]),
  ])
  const flipped = rankMetric(index, 'count-losses-after-leading', { order: 'desc' })
  assert.deepEqual(ranked(flipped), [['Alphas', 1], ['Betas', 2]])
  assert.equal(defaultOrder(flipped.metric), 'asc')
})

// ---------------------------------------------------------------------------
// Clubs the split cannot answer for
// ---------------------------------------------------------------------------

test('a club that has never been in the split is printed last, with no rank', () => {
  const index = buildRankingIndex([
    entry(1, 'Alphas', [row({ hr: 2 })]),
    entry(2, 'Betas', [row({})]),
  ])
  const result = rankMetric(index, 'homers-2-plus')
  assert.deepEqual(ranked(result), [['Alphas', 1], ['Betas', null]])
  // The field size counts only the clubs that could be ranked — a "1 of 2"
  // that included a club with no games in the split would misreport the field.
  assert.equal(result.of, 1)
  assert.equal(result.ranked[1].v, '—')
})

test('ties share a rank and are flagged, so the page can print T2', () => {
  const index = buildRankingIndex([
    entry(1, 'Alphas', [row({ rs: 5 })]),
    entry(2, 'Betas', [row({ rs: 5 })]),
    entry(3, 'Gammas', [row({ rs: 5, r: 'L' })]),
  ])
  const result = rankMetric(index, 'scored-4-plus')
  assert.deepEqual(ranked(result), [['Alphas', 1], ['Betas', 1], ['Gammas', 3]])
  assert.equal(result.ranked[0].tied, true)
  assert.equal(result.ranked[2].tied, false)
})

test('the cutoff and the half reach the pivot exactly as they reach the card', () => {
  const games = [row({ d: '2026-04-01' }), row({ d: '2026-08-01', r: 'L' })]
  const index = buildRankingIndex([entry(1, 'Alphas', games)], { cutoff: '2026-05-01' })
  assert.equal(rankMetric(index, 'scored-4-plus').ranked[0].v, '1-0')

  const post = buildRankingIndex([entry(1, 'Alphas', games)], { half: 'post' })
  assert.equal(rankMetric(post, 'scored-4-plus').ranked[0].v, '0-1')
})

test('an unknown metric id resolves to nothing rather than an empty table', () => {
  const index = buildRankingIndex([entry(1, 'Alphas', [row({})])])
  assert.equal(rankMetric(index, 'not-a-real-split'), null)
  // …which is what lets the page fall back to the first split in its own menu.
  assert.ok(index.groups[0].metrics[0].id)
})

test('a club with no games at all in the filter is dropped from the field', () => {
  const index = buildRankingIndex([
    entry(1, 'Alphas', [row({})]),
    entry(2, 'Betas', [row({ d: '2026-09-01' })]),
  ])
  const result = rankMetric(index, 'scored-4-plus', {})
  assert.equal(result.of, 2)
  // Filtered out by the cutoff, Betas keeps its place in the table as an
  // unranked row rather than vanishing from a league-wide list.
  const cut = buildRankingIndex(
    [entry(1, 'Alphas', [row({})]), entry(2, 'Betas', [row({ d: '2026-09-01' })])],
    { cutoff: '2026-05-01' },
  )
  const cutResult = rankMetric(cut, 'scored-4-plus')
  assert.deepEqual(ranked(cutResult), [['Alphas', 1], ['Betas', null]])
})
