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
import {
  BAR,
  KEYS,
  buildReport,
  ladderFor,
  projectField,
  scoreSeason,
  seasonField,
  warByTeam,
} from '../scripts/gen-nine-keys.mjs'
import { floorSentence, listOf, placeboSentence, supportSentence } from '../src/api/nineKeys.js'
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
// warByTeam — Talent, split by stint.
// --------------------------------------------------------------------------
// The bug this closes: the bulk sabermetrics board files a traded player's
// whole season under his LAST club (2024 Chisholm: one row, Yankees, 4.05).
// Per-club queries return each stint, and each is summed to the club asked.
test('a traded player counts for each club only the WAR he gave it', () => {
  const war = warByTeam([
    { teamId: 146, splits: [{ team: { id: 146 }, stat: { war: '1.79' } }, { team: { id: 146 }, stat: { war: 2 } }] },
    { teamId: 147, splits: [{ team: { id: 147 }, stat: { war: 2.26 } }] },
  ])
  assert.equal(war.get(146), 3.79)
  assert.equal(war.get(147), 2.26)
})

test('a row naming another club is not summed into the club that was asked', () => {
  const war = warByTeam([{ teamId: 146, splits: [{ team: { id: 147 }, stat: { war: 4.05 } }] }])
  assert.equal(war.get(146), undefined)
})

// --------------------------------------------------------------------------
// projectField / seasonField — who holds a place, and whether that is final.
// --------------------------------------------------------------------------
// Standings records the way /standings sends them: three divisions a league,
// the leader flagged by MLB rather than inferred from the rounded pct.
const records = (pcts) =>
  [103, 104].flatMap((leagueId, l) =>
    [0, 1, 2].map((d) => ({
      league: { id: leagueId },
      division: { id: 200 + l * 3 + d },
      teamRecords: pcts[l][d].map((pct, i) => ({
        team: { id: l * 100 + d * 10 + i + 1, name: `T${l}${d}${i}` },
        winningPercentage: pct,
        divisionLeader: i === 0,
      })),
    })),
  )
const league = [
  ['.600', '.560', '.540', '.450', '.400'],
  ['.590', '.550', '.500', '.450', '.400'],
  ['.580', '.530', '.520', '.450', '.400'],
]

test('projectField takes the three flagged division leaders and three wild cards per league', () => {
  const field = projectField(records([league, league]))
  assert.equal(field.length, 12)
  for (const leader of [1, 11, 21, 101, 111, 121]) assert.ok(field.includes(leader))
  assert.equal(new Set(field).size, 12, 'no club is counted twice')
})

// The bug this closed: a sort on the rounded pct string let array order
// decide a tie for the last wild card. The app's board keeps both.
test('a tie for the last wild card keeps both clubs', () => {
  // Wild-card order: .560, .550, then two clubs at .530 for the last place.
  const tied = [
    ['.600', '.560', '.530', '.450', '.400'],
    ['.590', '.550', '.500', '.450', '.400'],
    ['.580', '.530', '.520', '.450', '.400'],
  ]
  const field = projectField(records([tied, league]))
  assert.ok(field.includes(3) && field.includes(22), 'both .530 clubs hold the third place')
  assert.equal(field.filter((id) => id < 100).length, 7)
})

test('seasonField prefers the played bracket, then the clinched clubs, then the projection', () => {
  const recs = records([league, league])
  const clubs = recs.flatMap((r) => r.teamRecords.map((t) => ({ teamId: t.team.id, clinched: false })))
  assert.deepEqual(seasonField({ clubs, records: recs, history: [1, 2], regularSeasonOver: true }), {
    ids: [1, 2],
    final: true,
  })

  // The regular season is over and postseason-history.json does not have it
  // yet: the standings' clinched flag names the field, and it is final.
  const clinchedIds = [1, 2, 3, 11, 12, 21, 101, 102, 103, 111, 112, 121]
  const done = clubs.map((c) => ({ ...c, clinched: clinchedIds.includes(c.teamId) }))
  assert.deepEqual(seasonField({ clubs: done, records: recs, regularSeasonOver: true }), {
    ids: clinchedIds,
    final: true,
  })

  // Still being played: a projection, and not final even with 12 clinched.
  const live = seasonField({ clubs: done, records: recs, regularSeasonOver: false })
  assert.equal(live.final, false)
  assert.deepEqual(live.ids, projectField(recs))
})

// --------------------------------------------------------------------------
// buildReport — the limit is read off the champions, never a constant.
// --------------------------------------------------------------------------
// A 30-club season where every club ties at a good value on every key, and
// the champion alone is worst on `fails` of them.
const BAD = { runsScored: 400, runsAllowed: 1000, spERA: 7, rpERA: 7, obp: 0.2, hr: 50, batSO: 2000, whip: 2, war: 0 }
const KEY_FIELDS = Object.keys(BAD)
function fixtureSeason(year, fails) {
  const bad = Object.fromEntries(KEY_FIELDS.slice(0, fails).map((f) => [f, BAD[f]]))
  const clubs = Array.from({ length: 30 }, (_, i) => club(i + 1, { name: `C${i + 1}`, wins: 90, losses: 72 }))
  clubs[0] = { ...clubs[0], ...bad }
  return { year, clubs, regularSeasonOver: true }
}
const fixtureHistory = (years) => ({
  seasons: years.map((year) => ({ year, championTeamId: 1, rounds: [series('worldseries', 1, 2, 1)] })),
})

// The bug this closed: LIMIT was a constant 3 and a 4-fail champion only
// printed a NOTE, so the page would state a rule its own table broke.
test('a champion who fails more keys moves the limit with him', () => {
  const report = buildReport([fixtureSeason(2000, 1), fixtureSeason(2001, 4)], fixtureHistory([2000, 2001]))
  assert.equal(report.limit, 4)
  const atLimit = report.thresholds.find((t) => t.limit === report.limit)
  assert.equal(atLimit.championsPassing, atLimit.championTotal)
})

// The bug this closed: "leave-one-out holds 26 of 26" passed by construction
// whenever two champions shared the worst count.
test('limitSupport counts the champions at the limit, and names the limit without a lone one', () => {
  const shared = buildReport(
    [fixtureSeason(2000, 3), fixtureSeason(2001, 3), fixtureSeason(2002, 1)],
    fixtureHistory([2000, 2001, 2002]),
  )
  assert.deepEqual(shared.limitSupport, { atLimit: 2, of: 3, withoutLoneWorst: null })

  const lone = buildReport(
    [fixtureSeason(2000, 3), fixtureSeason(2001, 1), fixtureSeason(2002, 2)],
    fixtureHistory([2000, 2001, 2002]),
  )
  assert.deepEqual(lone.limitSupport, { atLimit: 1, of: 3, withoutLoneWorst: 2 })
})

test('firstSeason is the first season the report scored', () => {
  const report = buildReport([fixtureSeason(2012, 1)], fixtureHistory([2012]))
  assert.equal(report.firstSeason, 2012)
})

// --------------------------------------------------------------------------
// The page's derived sentences.
// --------------------------------------------------------------------------
const label = (id) => ({ offense: 'Runs', power: 'Power', bullpen: 'Bullpen' })[id] ?? id
const champ = (year, name, failed) => ({ year, name, failed })

test('listOf joins one, two and three items', () => {
  assert.equal(listOf(['A']), 'A')
  assert.equal(listOf(['A', 'B']), 'A and B')
  assert.equal(listOf(['A', 'B', 'C']), 'A, B and C')
})

test('floorSentence says "both" for two clubs and one shared key', () => {
  const text = floorSentence(
    [champ(2014, 'Giants', ['power', 'bullpen']), champ(2003, 'Marlins', ['power', 'offense'])],
    2,
    label,
  )
  assert.equal(text, 'The 2014 Giants and the 2003 Marlins sit at the limit. The only key they both failed is Power.')
})

// The bug this closed: the grammar was fixed at two clubs and one key.
test('floorSentence says "all" for three clubs, and lists two shared keys', () => {
  const text = floorSentence(
    [
      champ(2014, 'Giants', ['power', 'bullpen']),
      champ(2003, 'Marlins', ['power', 'bullpen']),
      champ(2006, 'Cardinals', ['bullpen', 'power']),
    ],
    2,
    label,
  )
  assert.equal(
    text,
    'The 2014 Giants, the 2003 Marlins and the 2006 Cardinals sit at the limit. The keys they all failed are Power and Bullpen.',
  )
})

test('floorSentence says so when the clubs share no key, and is silent for one club', () => {
  assert.match(floorSentence([champ(1, 'A', ['power']), champ(2, 'B', ['offense'])], 1, label), /share no failed key/)
  assert.equal(floorSentence([champ(1, 'A', ['power'])], 1, label), null)
})

test('supportSentence names a lone club at the limit and the limit without it', () => {
  const text = supportSentence({ atLimit: 1, of: 26, withoutLoneWorst: 2 }, 3, [champ(2014, 'Giants', ['a', 'b', 'c'])])
  assert.equal(text, 'Only the 2014 Giants sit at the limit. Without that season, the limit would be 2.')
  assert.match(supportSentence({ atLimit: 2, of: 26, withoutLoneWorst: null }, 3, []), /^2 of the 26 champions/)
})

// The bug this closed: the page said the REAL screen "filters at least as
// hard 5% of the time". p is the share of RANDOM screens that do.
test('placeboSentence says p is the share of random screens as strict as this one', () => {
  assert.equal(
    placeboSentence({ reps: 3000, p: 0.039 }),
    'Of 3,000 screens built the same way from randomly drawn postseason clubs, 4% filter as hard as this one.',
  )
  assert.match(placeboSentence({ reps: 3000, p: 0.004 }), /fewer than 1% filter/)
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

test("the file's limit support matches its own champion rows", () => {
  const atLimit = file.champions.filter((c) => c.failed.length === file.limit).length
  assert.equal(file.limitSupport.atLimit, atLimit)
  assert.equal(file.limitSupport.of, file.champions.length)
})

// --------------------------------------------------------------------------
// Routing.
// --------------------------------------------------------------------------
test('/nine-keys routes to the report', () => {
  assert.deepEqual(parseRoute('/nine-keys'), { name: 'nine-keys' })
})
