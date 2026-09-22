// Coverage for the Nine Keys data layer: the generator's pure scorers
// (gen-nine-keys.mjs) and the invariants the committed data file has to hold
// for the page's claims to be true.
//
// The page states its rule as a number — "no champion has failed more than
// three of nine" — and draws every table off public/data/nine-keys.json. So
// the test that matters is not that the number is 3; it is that the number
// the file carries IS the worst any champion in the file did. A regenerate
// that moves the champions must move the limit with them, or the page states
// something the table underneath it contradicts.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { BAR, KEYS, ladderFor, projectField, scoreSeason } from '../scripts/gen-nine-keys.mjs'
import { parseRoute } from '../src/lib/route.js'

const file = JSON.parse(readFileSync(new URL('../public/data/nine-keys.json', import.meta.url)))

// A club shaped the way seasonInputs() hands one over. Only the fields the
// nine keys read need to be present.
const club = (teamId, over = {}) => ({
  teamId,
  games: 162,
  runsScored: 700,
  runsAllowed: 700,
  spERA: 4,
  rpERA: 4,
  obp: 0.32,
  hr: 180,
  pa: 6200,
  batSO: 1300,
  whip: 1.3,
  war: 30,
  ...over,
})

// --------------------------------------------------------------------------
// scoreSeason — ranks, and the tie rule that decides a key at the bar.
// --------------------------------------------------------------------------
test('scoreSeason ranks each key 1..n, best first', () => {
  const clubs = [club(1, { runsScored: 900 }), club(2, { runsScored: 800 }), club(3, { runsScored: 700 })]
  const scored = scoreSeason(clubs)
  assert.equal(scored.get(1).ranks.offense, 1)
  assert.equal(scored.get(2).ranks.offense, 2)
  assert.equal(scored.get(3).ranks.offense, 3)
})

test('a lower ERA and a lower WHIP rank better, not worse', () => {
  const clubs = [club(1, { spERA: 5, whip: 1.5 }), club(2, { spERA: 3, whip: 1.1 })]
  const scored = scoreSeason(clubs)
  assert.equal(scored.get(2).ranks.rotation, 1)
  assert.equal(scored.get(2).ranks.whip, 1)
})

test('striking out less ranks better on contact', () => {
  const clubs = [club(1, { batSO: 1600 }), club(2, { batSO: 1000 })]
  assert.equal(scoreSeason(clubs).get(2).ranks.contact, 1)
})

// The bug this closes: WHIP is published to two decimals and OBP to three, so
// exact ties are common. A plain index-based rank hands the better number to
// whichever club the sort happened to put first, which decided real keys at
// the 15/16 line — it moved the 2013 Red Sox between failing two keys and
// three, and with them the whole champion distribution.
test('tied clubs take the same rank, and the next distinct value skips ahead', () => {
  const clubs = [
    club(1, { whip: 1.1 }),
    club(2, { whip: 1.3 }),
    club(3, { whip: 1.3 }),
    club(4, { whip: 1.3 }),
    club(5, { whip: 1.4 }),
  ]
  const scored = scoreSeason(clubs)
  assert.equal(scored.get(1).ranks.whip, 1)
  assert.equal(scored.get(2).ranks.whip, 2)
  assert.equal(scored.get(3).ranks.whip, 2)
  assert.equal(scored.get(4).ranks.whip, 2)
  // Three clubs used up slots 2-4, so the next distinct value is 5th.
  assert.equal(scored.get(5).ranks.whip, 5)
})

test('a club is failed on a key it has no number for', () => {
  const clubs = [club(1, { spERA: null }), club(2)]
  assert.ok(scoreSeason(clubs).get(1).failed.includes('rotation'))
})

// --------------------------------------------------------------------------
// ladderFor — how far a club got, read off the bracket rather than the seed.
// --------------------------------------------------------------------------
const series = (key, a, b, winner) => ({
  key,
  series: [{ teamA: { teamId: a }, teamB: { teamId: b }, winnerTeamId: winner }],
})

test('ladderFor places each club by the deepest round it reached', () => {
  const season = {
    championTeamId: 1,
    rounds: [
      series('wildcard', 3, 4, 3),
      series('division', 1, 3, 1),
      series('lcs', 1, 5, 1),
      series('worldseries', 1, 6, 1),
    ],
  }
  const ladder = ladderFor(season)
  assert.equal(ladder.get(1), 5, 'champion')
  assert.equal(ladder.get(6), 4, 'lost the World Series')
  assert.equal(ladder.get(5), 3, 'lost the LCS')
  assert.equal(ladder.get(4), 1, 'lost its first series')
  // Won the Wild Card round, then lost the Division Series — a rung that only
  // exists from 2012, when the Wild Card round became its own series.
  assert.equal(ladder.get(3), 2)
})

// --------------------------------------------------------------------------
// projectField — who holds a place while the season is still being played.
// --------------------------------------------------------------------------
test('projectField takes three division leaders and three wild cards per league', () => {
  const clubs = []
  let id = 1
  for (const leagueId of [103, 104]) {
    for (const divisionId of [1, 2, 3]) {
      for (let i = 0; i < 5; i += 1) {
        clubs.push(club(id++, { leagueId, divisionId, winPct: 0.7 - i * 0.05 }))
      }
    }
  }
  const field = projectField(clubs)
  assert.equal(field.length, 12)
  // The best club in each division is a leader, whatever its league record.
  for (const leader of [1, 6, 11, 16, 21, 26]) assert.ok(field.includes(leader))
  assert.equal(new Set(field).size, 12, 'no club is counted twice')
})

// --------------------------------------------------------------------------
// The committed file — the invariants the page's claims rest on.
// --------------------------------------------------------------------------
test('the file carries one entry per key, and the page and generator agree on the bar', () => {
  assert.equal(file.keys.length, KEYS.length)
  assert.deepEqual(
    file.keys.map((k) => k.id),
    KEYS.map((k) => k.id),
  )
  assert.equal(file.bar, BAR)
})

test('the stated limit IS the worst any champion did', () => {
  const worst = file.champions.reduce((m, c) => Math.max(m, c.failed.length), 0)
  assert.equal(
    file.limit,
    worst,
    'the page says no champion has failed more than file.limit — so it must equal the worst one',
  )
})

test('every champion is within the rule, by construction', () => {
  for (const champion of file.champions) {
    assert.ok(
      champion.failed.length <= file.limit,
      `${champion.year} ${champion.name} failed ${champion.failed.length}`,
    )
  }
})

test("a row's failed list is exactly the keys it ranks worse than the bar", () => {
  const rows = [...file.champions, ...(file.current?.teams ?? [])]
  assert.ok(rows.length > 0)
  for (const row of rows) {
    const derived = file.keys
      .filter((k) => row.ranks[k.id] == null || row.ranks[k.id] > file.bar)
      .map((k) => k.id)
    assert.deepEqual(row.failed, derived, `${row.name} ${row.year ?? ''}`)
  }
})

test('every rank sits inside the league', () => {
  const rows = [...file.champions, ...(file.current?.teams ?? [])]
  for (const row of rows) {
    for (const key of file.keys) {
      const rank = row.ranks[key.id]
      if (rank == null) continue
      assert.ok(rank >= 1 && rank <= 30, `${row.name} ${key.id} ranked ${rank}`)
    }
  }
})

test('the distribution adds up to the champions listed', () => {
  const total = Object.values(file.distribution).reduce((a, b) => a + b, 0)
  assert.equal(total, file.champions.length)
})

test('champions run newest first, one per season, none before the first season', () => {
  const years = file.champions.map((c) => c.year)
  assert.deepEqual(years, [...years].sort((a, b) => b - a))
  assert.equal(new Set(years).size, years.length)
  for (const year of years) assert.ok(year >= file.firstSeason)
})

test('the threshold table is monotonic — a looser line never admits fewer champions', () => {
  for (let i = 1; i < file.thresholds.length; i += 1) {
    assert.ok(file.thresholds[i].championsPassing >= file.thresholds[i - 1].championsPassing)
    assert.ok(file.thresholds[i].rejectsOctober <= file.thresholds[i - 1].rejectsOctober)
  }
  const atLimit = file.thresholds.find((t) => t.limit === file.limit)
  assert.equal(atLimit.championsPassing, atLimit.championTotal, 'the rule admits every champion')
})

test('leave-one-out never reports more passes than there are champions', () => {
  assert.ok(file.leaveOneOut.passed <= file.leaveOneOut.of)
  assert.equal(file.leaveOneOut.of, file.champions.length)
})

// --------------------------------------------------------------------------
// Routing.
// --------------------------------------------------------------------------
test('/nine-keys routes to the report', () => {
  assert.deepEqual(parseRoute('/nine-keys'), { name: 'nine-keys' })
})
