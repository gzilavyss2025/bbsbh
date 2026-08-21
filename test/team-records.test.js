// The situational-records pipeline: the per-game derivations the nightly
// gen-team-records.mjs stores (scripts/lib/team-records.mjs) and the tally the
// Numbers tab's Records card reads off them (src/api/teamRecords.js).
//
// Several cases here are the shapes that make this hard rather than the happy
// path: a home side that never batted in the last inning, a rain-shortened
// game that must not answer "leading after 8" at all, a MiLB doubleheader
// scheduled for seven innings, a series broken by a trip to another park, and
// a set straddling the All-Star break.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inningRuns,
  encodeInnings,
  decodeInnings,
  scoredFirstSide,
  cumulativeHalves,
  leadStateAfter,
  leadTrailFlags,
  lastAtBatOutcome,
  ipToOuts,
  isQualityStart,
  starterLine,
  battedAroundHalves,
  tagSeries,
  isGetawayDay,
  dailyDivisionRanks,
} from '../scripts/lib/team-records.mjs'
import { teamRecordsFor, longestStreaks, sweepCounts, seriesRecordCounts, daysAtPlace } from '../src/api/teamRecords.js'

// A linescore's innings array, from `[away, home]` pairs. `null` home means
// that side did not bat.
const ls = (pairs) => ({
  innings: pairs.map(([a, h]) => ({ away: { runs: a }, home: h == null ? undefined : { runs: h } })),
})
const runs = (pairs) => inningRuns(ls(pairs))

// ---------------------------------------------------------------------------
// inningRuns / encode / decode
// ---------------------------------------------------------------------------

test('a home side that never batted reads null, not zero', () => {
  const parsed = runs([[0, 0], [1, null]])
  assert.deepEqual(parsed, [{ a: 0, h: 0 }, { a: 1, h: null }])
  // The distinction has to survive the round trip through the stored form —
  // collapsing it to 0 would make every top-of-the-9th win look like the home
  // side batted and was retired in order.
  assert.deepEqual(decodeInnings(encodeInnings(parsed)), parsed)
})

test('the stored form is pairs, not objects', () => {
  assert.deepEqual(encodeInnings(runs([[1, 2], [0, null]])), [[1, 2], [0, null]])
})

// ---------------------------------------------------------------------------
// scoredFirstSide
// ---------------------------------------------------------------------------

test('within one inning the away club scored first — it bats the top half', () => {
  assert.equal(scoredFirstSide(runs([[1, 1], [0, 0]])), 'away')
})

test('the home club scores first when the away side is retired scoreless', () => {
  assert.equal(scoredFirstSide(runs([[0, 2], [1, 0]])), 'home')
})

test('a 0-0 game has no first scorer rather than defaulting to the away club', () => {
  assert.equal(scoredFirstSide(runs([[0, 0], [0, 0]])), null)
})

// ---------------------------------------------------------------------------
// cumulativeHalves / leadStateAfter / leadTrailFlags
// ---------------------------------------------------------------------------

test('cumulative totals are per completed half-inning, and a skipped bottom adds none', () => {
  assert.deepEqual(cumulativeHalves(runs([[1, 0], [2, null]])), [
    { a: 1, h: 0 }, // top 1
    { a: 1, h: 0 }, // bottom 1
    { a: 3, h: 0 }, // top 2 — no bottom half follows
  ])
})

test('leading after 7 is read from the home club’s own side of the ledger', () => {
  const innings = runs([[0, 1], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, null]])
  assert.equal(leadStateAfter(innings, 7, true), 1)
  assert.equal(leadStateAfter(innings, 7, false), -1)
})

test('a game that never reached the 8th answers null, not tied', () => {
  // A rain-shortened seven-inning game. Coalescing this to 0 would file it
  // under "Tied after 8", which is the bug this null exists to prevent.
  const short = runs([[0, 0], [0, 0], [1, 0], [0, 0], [0, 0], [0, 0], [0, 1]])
  assert.equal(leadStateAfter(short, 7, true), 0)
  assert.equal(leadStateAfter(short, 8, true), null)
})

test('an inning whose bottom half was never played is not a completed inning', () => {
  const innings = runs([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, null]])
  assert.equal(leadStateAfter(innings, 8, false), 0)
  assert.equal(leadStateAfter(innings, 9, false), null)
})

test('led and trailed are both true for a club that gave a lead back and retook it', () => {
  const innings = runs([[2, 0], [0, 3], [2, 0]])
  assert.deepEqual(leadTrailFlags(innings, false), { led: true, trailed: true })
})

// ---------------------------------------------------------------------------
// lastAtBatOutcome
// ---------------------------------------------------------------------------

test('a walk-off is decided in the last at-bat, from the home side', () => {
  const innings = runs([[3, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 4]])
  assert.deepEqual(lastAtBatOutcome(innings, true), { decided: true, walkOff: true })
})

test('a home club that led all night and added a run did not decide it in the last at-bat', () => {
  const innings = runs([[0, 5], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 1]])
  assert.deepEqual(lastAtBatOutcome(innings, true), { decided: false, walkOff: false })
})

test('a road club that breaks a tie in the top of the 9th decided it — and it is no walk-off', () => {
  const innings = runs([[0, 1], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 0], [2, 0]])
  assert.deepEqual(lastAtBatOutcome(innings, false), { decided: true, walkOff: false })
})

test('a home side that never batted in the 9th cannot have decided it there', () => {
  const innings = runs([[0, 4], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, null]])
  assert.deepEqual(lastAtBatOutcome(innings, true), { decided: false, walkOff: false })
})

test('a tie decides nothing', () => {
  assert.deepEqual(lastAtBatOutcome(runs([[1, 1]]), null), { decided: false, walkOff: false })
})

// ---------------------------------------------------------------------------
// Pitching
// ---------------------------------------------------------------------------

test('innings pitched converts thirds, not tenths', () => {
  assert.equal(ipToOuts('5.1'), 16)
  assert.equal(ipToOuts('6.0'), 18)
  assert.equal(ipToOuts('6.2'), 20)
  assert.equal(ipToOuts(undefined), 0)
})

test('a quality start is 6 innings and no more than 3 earned', () => {
  assert.equal(isQualityStart(18, 3), true)
  assert.equal(isQualityStart(17, 0), false) // 5.2 IP
  assert.equal(isQualityStart(27, 4), false)
  assert.equal(isQualityStart(null, 0), false)
})

test('the starter is pitchers[0], read out of the boxscore side', () => {
  const side = {
    pitchers: [111, 222],
    players: { ID111: { stats: { pitching: { inningsPitched: '7.0', earnedRuns: 1 } } } },
  }
  assert.deepEqual(starterLine(side), { id: 111, outs: 21, earnedRuns: 1 })
})

test('a side with no pitching line degrades to nulls rather than throwing', () => {
  assert.deepEqual(starterLine({}), { id: null, outs: null, earnedRuns: null })
  assert.deepEqual(starterLine({ pitchers: [9], players: {} }), {
    id: 9,
    outs: null,
    earnedRuns: null,
  })
})

// ---------------------------------------------------------------------------
// battedAroundHalves
// ---------------------------------------------------------------------------

const pa = (inning, halfInning) => ({ result: { type: 'atBat' }, about: { inning, halfInning } })

test('ten batters in a half is batting around; nine is not', () => {
  const plays = [
    ...Array.from({ length: 10 }, () => pa(3, 'top')),
    ...Array.from({ length: 9 }, () => pa(4, 'bottom')),
  ]
  assert.deepEqual(battedAroundHalves(plays), { away: 1, home: 0 })
})

test('top-level baserunning plays do not count as plate appearances', () => {
  // allPlays interleaves steals and pickoffs with real PAs; counting them
  // would turn a busy inning into a phantom bat-around.
  const plays = [
    ...Array.from({ length: 9 }, () => pa(1, 'bottom')),
    { result: { type: 'runnerEvent' }, about: { inning: 1, halfInning: 'bottom' } },
    { result: { type: 'runnerEvent' }, about: { inning: 1, halfInning: 'bottom' } },
  ]
  assert.deepEqual(battedAroundHalves(plays), { away: 0, home: 0 })
})

test('a missing play-by-play counts nothing rather than throwing', () => {
  assert.deepEqual(battedAroundHalves(undefined), { away: 0, home: 0 })
})

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

const g = (date, opp, venue, result = 'W') => ({ date, opp_id: opp, venue_id: venue, result })

test('a series is consecutive games against one club at one park', () => {
  const tagged = tagSeries([
    g('2026-04-01', 10, 5),
    g('2026-04-02', 10, 5),
    g('2026-04-03', 10, 5),
    g('2026-04-05', 11, 7),
    g('2026-04-06', 11, 7),
  ])
  assert.deepEqual(
    tagged.map((r) => [r.seriesGame, r.seriesLength, r.opener, r.finale]),
    [
      [1, 3, true, false],
      [2, 3, false, false],
      [3, 3, false, true],
      [1, 2, true, false],
      [2, 2, false, true],
    ],
  )
})

test('the same opponent at a different park is a new series, not a longer one', () => {
  // The home-and-home shape: three there, three here. `gamesInSeries` from the
  // feed cannot tell these apart, which is why the ledger decides instead.
  const tagged = tagSeries([g('2026-05-01', 10, 5), g('2026-05-03', 10, 9)])
  assert.deepEqual(tagged.map((r) => r.seriesLength), [1, 1])
})

test('a getaway day is a finale the club then leaves', () => {
  const tagged = tagSeries([g('2026-04-01', 10, 5), g('2026-04-02', 10, 5), g('2026-04-04', 11, 5)])
  // Finale of the first series, but the next game is at the SAME park — the
  // club is not going anywhere, so it is not a getaway day.
  assert.equal(isGetawayDay(tagged[1], tagged[2]), false)
  assert.equal(isGetawayDay(tagged[0], tagged[1]), false) // not a finale at all
  // The season's last game has no next venue; everyone goes home.
  assert.equal(isGetawayDay(tagged[2], undefined), true)
})

// ---------------------------------------------------------------------------
// dailyDivisionRanks
// ---------------------------------------------------------------------------

test('clubs tied atop the division are both in first that day', () => {
  const rows = (dates, results) => dates.map((d, i) => ({ date: d, result: results[i] }))
  const ranks = dailyDivisionRanks(
    new Map([
      [1, rows(['2026-04-01', '2026-04-02'], ['W', 'W'])],
      [2, rows(['2026-04-01', '2026-04-02'], ['W', 'L'])],
    ]),
  )
  assert.equal(ranks[1]['2026-04-01'], 1)
  assert.equal(ranks[2]['2026-04-01'], 1) // both 1-0
  assert.equal(ranks[1]['2026-04-02'], 1)
  assert.equal(ranks[2]['2026-04-02'], 2)
})

// ---------------------------------------------------------------------------
// The reader's tally
// ---------------------------------------------------------------------------

// A shipped row. Falsy keys are omitted in the real file, so the fixtures here
// omit them too — a test that spelled out `e: 0` would not exercise the
// coalescing every predicate depends on.
const row = (over) => ({ d: '2026-04-01', o: 10, r: 'W', rs: 4, ra: 2, hi: 9, ha: 7, ...over })

const shard = (games, over = {}) => ({
  teamId: 158,
  season: 2026,
  sportId: 1,
  allStarDate: '2026-07-14',
  opponents: { 10: { l: 104, v: 205 } },
  names: { leagues: { 104: 'National League' }, divisions: { 205: 'National League Central' } },
  dailyRank: {},
  games,
  ...over,
})

const rowsOf = (result, title, key) =>
  result.groups.find((x) => x.title === title)?.rows.find((r) => r.k === key)

test('a split with no games is dropped rather than printed as 0-0', () => {
  const result = teamRecordsFor(shard([row({ hr: 2 })]))
  assert.equal(rowsOf(result, 'Hits and homers', 'Hitting 2+ homers').v, '1-0')
  assert.equal(rowsOf(result, 'Hits and homers', 'Not hitting a home run'), undefined)
})

test('leading/trailing/tied rows name the inning and cover all three states after 6', () => {
  const result = teamRecordsFor(shard([row({ l6: 0 }), row({ d: '2026-04-02', l6: 1, r: 'L' })]))
  assert.equal(rowsOf(result, 'Leading and trailing', 'Tied after 6 innings').v, '1-0')
  assert.equal(rowsOf(result, 'Leading and trailing', 'Leading after 6 innings').v, '0-1')
  assert.equal(rowsOf(result, 'Leading and trailing', 'Trailing after 6 innings'), undefined)
  assert.equal(rowsOf(result, 'Leading and trailing', 'Leading after 6'), undefined)
})

test('an unresolved starting hand counts in neither the RHS nor the LHS row', () => {
  const result = teamRecordsFor(shard([row({ oh: 'L' }), row({ d: '2026-04-02' })]))
  assert.equal(rowsOf(result, 'Starting pitching', 'Vs. left-handed starter').v, '1-0')
  assert.equal(rowsOf(result, 'Starting pitching', 'Vs. right-handed starter'), undefined)
})

test('the cutoff drops later games entirely, so a dated page cannot look ahead', () => {
  const result = teamRecordsFor(
    shard([row({ d: '2026-04-01' }), row({ d: '2026-04-09', r: 'L' })]),
    { cutoff: '2026-04-05' },
  )
  assert.equal(result.gamesCounted, 1)
  assert.equal(rowsOf(result, 'Scoring', 'Scoring 4+ runs').v, '1-0')
})

test('the All-Star lever splits on the break, and the game itself falls in neither half', () => {
  const games = [
    row({ d: '2026-07-01' }),
    row({ d: '2026-07-14', r: 'L' }), // the break itself
    row({ d: '2026-08-01', r: 'L' }),
  ]
  assert.equal(teamRecordsFor(shard(games), { half: 'all' }).gamesCounted, 3)
  assert.equal(teamRecordsFor(shard(games), { half: 'pre' }).gamesCounted, 1)
  assert.equal(teamRecordsFor(shard(games), { half: 'post' }).gamesCounted, 1)
})

test('a file with no All-Star date yet ignores the lever instead of emptying the card', () => {
  const result = teamRecordsFor(shard([row({})], { allStarDate: null }), { half: 'pre' })
  assert.equal(result.gamesCounted, 1)
  assert.equal(result.allStarDate, null)
})

test('day games are the absence of the night flag, not a flag of their own', () => {
  const result = teamRecordsFor(shard([row({}), row({ d: '2026-04-02', n: 1, r: 'L' })]))
  assert.equal(rowsOf(result, 'Schedule', 'Day games').v, '1-0')
  assert.equal(rowsOf(result, 'Schedule', 'Night games').v, '0-1')
})

test('win pct counts only decided games, and a tie prints in the record', () => {
  const result = teamRecordsFor(
    shard([row({}), row({ d: '2026-04-02', r: 'L' }), row({ d: '2026-04-03', r: 'T' })]),
  )
  const r = rowsOf(result, 'Scoring', 'Scoring 4+ runs')
  assert.equal(r.v, '1-1-1')
  assert.equal(r.pct, '.500')
})

test('by-division rows are named and MLB alone gets the by-league split', () => {
  const mlb = teamRecordsFor(shard([row({})]))
  assert.ok(mlb.groups.find((x) => x.title === 'By division').rows[0].k.includes('NL') === false)
  assert.equal(
    mlb.groups.find((x) => x.title === 'By division').rows[0].k,
    'Vs. National League Central',
  )
  assert.ok(mlb.groups.find((x) => x.title === 'By league'))
  const milb = teamRecordsFor(shard([row({})], { sportId: 11 }))
  assert.equal(milb.groups.find((x) => x.title === 'By league'), undefined)
})

// ---------------------------------------------------------------------------
// Season counts
// ---------------------------------------------------------------------------

test('a tie breaks neither streak and extends neither', () => {
  const games = ['W', 'W', 'T', 'W', 'L', 'L', 'L'].map((r, i) => ({ d: `2026-04-0${i + 1}`, r }))
  assert.deepEqual(longestStreaks(games), { wins: 3, losses: 3 })
})

test('a sweep needs every game of the series inside the filter', () => {
  const series = [
    { d: '2026-04-01', o: 10, r: 'W', sg: 1, sl: 3 },
    { d: '2026-04-02', o: 10, r: 'W', sg: 2, sl: 3 },
    { d: '2026-04-03', o: 10, r: 'W', sg: 3, sl: 3 },
  ]
  assert.deepEqual(sweepCounts(series), { swept: 1, sweptBy: 0 })
  // Cut the last game — a set straddling the break belongs to neither half.
  assert.deepEqual(sweepCounts(series.slice(0, 2)), { swept: 0, sweptBy: 0 })
})

test('a one-game series is not a sweep', () => {
  assert.deepEqual(sweepCounts([{ d: '2026-04-01', o: 10, r: 'W', sg: 1, sl: 1 }]), {
    swept: 0,
    sweptBy: 0,
  })
})

test('a series win/loss counts every complete series, not just sweeps', () => {
  const series = [
    // Won, not swept: 2-1.
    { d: '2026-04-01', o: 10, r: 'W', sg: 1, sl: 3 },
    { d: '2026-04-02', o: 10, r: 'W', sg: 2, sl: 3 },
    { d: '2026-04-03', o: 10, r: 'L', sg: 3, sl: 3 },
    // Lost, not swept: 1-2.
    { d: '2026-04-08', o: 11, r: 'L', sg: 1, sl: 3 },
    { d: '2026-04-09', o: 11, r: 'W', sg: 2, sl: 3 },
    { d: '2026-04-10', o: 11, r: 'L', sg: 3, sl: 3 },
    // Split down the middle: neither a series win nor a series loss.
    { d: '2026-04-15', o: 12, r: 'W', sg: 1, sl: 4 },
    { d: '2026-04-16', o: 12, r: 'L', sg: 2, sl: 4 },
    { d: '2026-04-17', o: 12, r: 'W', sg: 3, sl: 4 },
    { d: '2026-04-18', o: 12, r: 'L', sg: 4, sl: 4 },
  ]
  assert.deepEqual(seriesRecordCounts(series), { won: 1, lost: 1 })
  // Cut the last game of the first set — a series straddling the filter
  // belongs to neither total.
  assert.deepEqual(seriesRecordCounts(series.slice(0, 2)), { won: 0, lost: 0 })
})

test('days at a place respect the cutoff and the chosen half', () => {
  const dailyRank = { '2026-07-01': 1, '2026-07-20': 1, '2026-08-01': 2 }
  const opts = { allStarDate: '2026-07-14' }
  assert.deepEqual(daysAtPlace(dailyRank, { ...opts, half: 'all', cutoff: null }), [2, 1, 0, 0, 0])
  assert.deepEqual(daysAtPlace(dailyRank, { ...opts, half: 'pre', cutoff: null }), [1, 0, 0, 0, 0])
  // A cutoff drops the 07-20 first-place day as well as the 08-01 second-place
  // one — only 07-01 survives.
  assert.deepEqual(daysAtPlace(dailyRank, { ...opts, half: 'all', cutoff: '2026-07-15' }), [
    1, 0, 0, 0, 0,
  ])
})

test('come-from-behind wins and losses after leading are counted from the row flags', () => {
  const result = teamRecordsFor(
    shard([row({ cb: 1 }), row({ d: '2026-04-02', r: 'L', ll: 1 }), row({ d: '2026-04-03' })]),
  )
  assert.equal(result.counts.comebackWins, 1)
  assert.equal(result.counts.lossesAfterLeading, 1)
})

test('a club with no file, or no games in the filter, returns null so the card hides', () => {
  assert.equal(teamRecordsFor(null), null)
  assert.equal(teamRecordsFor(shard([])), null)
  assert.equal(teamRecordsFor(shard([row({ d: '2026-08-01' })]), { cutoff: '2026-04-01' }), null)
})
