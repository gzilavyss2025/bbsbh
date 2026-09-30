// The bracket's spoiler rule, pinned on real postseasons (#1227, build prompt
// sections 3 and 7, tests 1, 2, 3 and 6). The bracket shows each series
// HEADING INTO the cutoff date. A game counts only when it went Final with a
// winner BEFORE the cutoff, on its officialDate, or on its resumeGameDate for a
// suspended game. The derivation re-applies that rule itself, so every test
// here hands it the WHOLE season's results and expects it to drop the rest.
import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveBracket } from '../../src/api/postseason/bracket.js'
import { bracket2025, results, seriesWith, skeleton, winsOf } from './fixtures.js'

// ---------------------------------------------------------------------------
// Known answers from 2025 (the issue's own list)
// ---------------------------------------------------------------------------

test('heading into 2025-10-04, the four Division Series are 0-0 with both clubs known', () => {
  const b = bracket2025('2025-10-04')
  const ds = b.series.filter((s) => s.round === 'division')
  assert.equal(ds.length, 4)
  for (const s of ds) {
    assert.deepEqual(
      s.slots.map((slot) => slot.wins),
      [0, 0],
    )
    assert.ok(
      s.slots.every((slot) => slot.club),
      'both clubs are known once the Wild Card round is over',
    )
    assert.equal(s.decided, false)
    assert.equal(s.playsOnCutoff, true)
    assert.equal(s.cutoffGame.gameNumber, 1)
  }
  assert.equal(winsOf(seriesWith(b, 'NL', 'division', 'MIL')), 'CHC 0, MIL 0')
  assert.equal(winsOf(seriesWith(b, 'AL', 'division', 'TOR')), 'NYY 0, TOR 0')
})

test('heading into 2025-10-05, MIL, TOR, LAD and DET each lead 1-0', () => {
  const b = bracket2025('2025-10-05')
  assert.equal(winsOf(seriesWith(b, 'NL', 'division', 'MIL')), 'CHC 0, MIL 1')
  assert.equal(winsOf(seriesWith(b, 'AL', 'division', 'TOR')), 'NYY 0, TOR 1')
  assert.equal(winsOf(seriesWith(b, 'NL', 'division', 'LAD')), 'LAD 1, PHI 0')
  assert.equal(winsOf(seriesWith(b, 'AL', 'division', 'DET')), 'DET 1, SEA 0')
})

test('heading into 2025-10-09: TOR won 3-1, SEA-DET 2-2 with no game, MIL 2-1, LAD 2-1', () => {
  const b = bracket2025('2025-10-09')

  const tor = seriesWith(b, 'AL', 'division', 'TOR')
  assert.equal(winsOf(tor), 'NYY 1, TOR 3')
  assert.equal(tor.decided, true)
  assert.equal(tor.winner.abbreviation, 'TOR')
  assert.equal(tor.eliminated.abbreviation, 'NYY')
  assert.equal(tor.playsOnCutoff, false)
  assert.equal(tor.cutoffGame, null)

  const sea = seriesWith(b, 'AL', 'division', 'SEA')
  assert.equal(winsOf(sea), 'DET 2, SEA 2')
  assert.equal(sea.decided, false)
  assert.equal(sea.playsOnCutoff, false, 'its deciding game is the next day')

  const mil = seriesWith(b, 'NL', 'division', 'MIL')
  assert.equal(winsOf(mil), 'CHC 1, MIL 2')
  assert.equal(mil.playsOnCutoff, true)
  assert.equal(mil.cutoffGame.gameNumber, 4)

  const lad = seriesWith(b, 'NL', 'division', 'LAD')
  assert.equal(winsOf(lad), 'LAD 2, PHI 1')
  assert.equal(lad.cutoffGame.gameNumber, 4)

  // TOR clinched on 10-08, so on 10-09 it waits in the ALCS slot, and the
  // other slot is empty until SEA-DET is decided.
  const alcs = b.leagues.AL.lcs
  assert.deepEqual(
    alcs.slots.map((slot) => slot.club?.abbreviation ?? null).sort(),
    [null, 'TOR'].sort(),
  )
  assert.equal(alcs.id, null, 'no series id until both clubs are known')
})

// ---------------------------------------------------------------------------
// Test 1: a game on the cutoff date never changes the state, Final or not
// ---------------------------------------------------------------------------

test('test 1: a Final game on the cutoff date does not count', () => {
  const cutoff = '2025-10-05'
  const all = deriveBracket(skeleton(2025), results(2025), cutoff)
  const onlyBefore = deriveBracket(
    skeleton(2025),
    results(2025).filter((r) => r.officialDate < cutoff),
    cutoff,
  )
  // Both ALDS played Game 2 on 10-05, and both went Final in the fixture.
  assert.ok(results(2025).some((r) => r.officialDate === cutoff && r.final && r.winnerId))
  assert.deepEqual(all, onlyBefore)
  assert.equal(winsOf(seriesWith(all, 'AL', 'division', 'SEA')), 'DET 1, SEA 0')
})

test('test 1: a game on the cutoff date that is not Final does not count either', () => {
  const cutoff = '2025-10-05'
  const live = results(2025).map((r) =>
    r.officialDate === cutoff ? { ...r, final: false, winnerId: null } : r,
  )
  assert.deepEqual(
    deriveBracket(skeleton(2025), live, cutoff),
    deriveBracket(skeleton(2025), results(2025), cutoff),
  )
})

test('a game before the cutoff counts only when it is Final AND has a winner', () => {
  const cutoff = '2025-10-06'
  const notFinal = results(2025).map((r) => (r.gamePk === 813047 ? { ...r, final: false } : r))
  const noWinner = results(2025).map((r) => (r.gamePk === 813047 ? { ...r, winnerId: null } : r))
  // NLDS CHC @ MIL Game 1 (813047, 2025-10-04), which MIL won.
  assert.equal(winsOf(seriesWith(bracket2025(cutoff), 'NL', 'division', 'MIL')), 'CHC 0, MIL 1')
  for (const rows of [notFinal, noWinner]) {
    assert.equal(winsOf(seriesWith(deriveBracket(skeleton(2025), rows, cutoff), 'NL', 'division', 'MIL')), 'CHC 0, MIL 0')
  }
})

test('test 1: a game after the cutoff date never counts', () => {
  const b = bracket2025('2025-10-01')
  // By 2025-10-01 only Wild Card Game 1 is in: every series is 1-0.
  for (const s of b.series.filter((x) => x.round === 'wildcard')) {
    assert.equal(s.gamesPlayed, 1)
  }
  for (const s of b.series.filter((x) => x.round !== 'wildcard')) {
    assert.equal(s.gamesPlayed, 0)
    assert.ok(s.slots.every((slot) => slot.wins === 0))
  }
})

// ---------------------------------------------------------------------------
// Test 2: a suspended game resumed on the cutoff date does not count
// ---------------------------------------------------------------------------
// 2008 World Series Game 5 (gamePk 243847): officialDate 2008-10-27,
// resumeGameDate 2008-10-29. Its 10-27 listing carries the winner (PHI).

test('test 2: a suspended game counts on its resume date, not its officialDate', () => {
  const ws = (cutoff) => deriveBracket(skeleton(2008), results(2008), cutoff).worldSeries

  assert.equal(winsOf(ws('2008-10-28')), 'TB 1, PHI 3', 'the game has an officialDate before the cutoff')
  assert.equal(winsOf(ws('2008-10-29')), 'TB 1, PHI 3', 'resumed ON the cutoff date: not yet')
  assert.equal(ws('2008-10-29').playsOnCutoff, true)
  assert.equal(ws('2008-10-29').cutoffGame.gameNumber, 5)
  assert.equal(winsOf(ws('2008-10-30')), 'TB 1, PHI 4')
})

// ---------------------------------------------------------------------------
// Test 3: a postponed game is not a win, and its second listing counts once
// ---------------------------------------------------------------------------
// 2022 ALDS CLE @ NYY Game 2 (gamePk 715752) is listed under 2022-10-13 with
// abstractGameState "Final", status Postponed, no winner, and again under
// 2022-10-14, where it was played. Game 5 (715749) did the same, 10-17 -> 10-18.

test('test 3: a postponed game reads "Final" but is not a win', () => {
  const alds = (cutoff) =>
    seriesWith(deriveBracket(skeleton(2022), results(2022), cutoff), 'AL', 'division', 'NYY')

  assert.equal(winsOf(alds('2022-10-14')), 'CLE 0, NYY 1')
  assert.equal(alds('2022-10-14').gamesPlayed, 1)
  assert.equal(alds('2022-10-14').cutoffGame.gameNumber, 2, 'the make-up date plays Game 2')
  assert.equal(winsOf(alds('2022-10-15')), 'CLE 1, NYY 1')
  // Game 5 was postponed on 10-17: that day the series does not play.
  assert.equal(alds('2022-10-17').playsOnCutoff, false)
  assert.equal(alds('2022-10-18').cutoffGame.gameNumber, 5)
})

test('test 3: a second listing of the same game counts once', () => {
  // The resumed 2008 Game 5 is listed twice with a winner both times.
  const raw = results(2008).filter((r) => r.gamePk === 243847)
  assert.equal(raw.length, 1, 'resultRowsFrom keeps the listing whose date is its officialDate')
  const b = deriveBracket(skeleton(2008), [...results(2008), ...raw], '2008-10-30')
  assert.equal(winsOf(b.worldSeries), 'TB 1, PHI 4')
})

// ---------------------------------------------------------------------------
// Test 6: the champion shows only when 4 World Series wins fall before the cutoff
// ---------------------------------------------------------------------------

test('test 6: no champion until the fourth World Series win is before the cutoff', () => {
  assert.equal(bracket2025('2025-10-24').champion, null)
  const eve = bracket2025('2025-11-01')
  assert.equal(winsOf(eve.worldSeries), 'TOR 3, LAD 3')
  assert.equal(eve.champion, null, 'Game 7 is on the cutoff date')
  const after = bracket2025('2025-11-02')
  assert.equal(after.champion.abbreviation, 'LAD')
  assert.equal(after.champion.id, 119)
  assert.equal(after.worldSeries.winner.id, 119)
  assert.equal(after.worldSeries.eliminated.abbreviation, 'TOR')
  // The offseason keeps the champion.
  assert.equal(bracket2025('2025-12-15').champion.abbreviation, 'LAD')
})

test('test 6: the 2008 champion follows the resumed game', () => {
  assert.equal(deriveBracket(skeleton(2008), results(2008), '2008-10-29').champion, null)
  assert.equal(deriveBracket(skeleton(2008), results(2008), '2008-10-30').champion.abbreviation, 'PHI')
})

// ---------------------------------------------------------------------------
// The games still to play (trap 6)
// ---------------------------------------------------------------------------
// An unplayed "if necessary" game drops off the schedule when its series ends,
// and a future game's own `ifNecessary` flag flips when it becomes necessary.
// So `upcoming` never reads either: "if necessary" comes from the heading-in
// wins alone, and an "if necessary" game never carries a date or a gamePk —
// live or historical. Whether the skeleton still lists it reflects how the
// real series played out AFTER the cutoff, not the cutoff itself: on an old
// `?d=`, the fixture here is captured from the real, already-finished 2025
// season, so a row existing for a later game leaks that the series went that
// far. `bracket2025('2025-10-06')` below is exactly that case — 2 games into
// a Division Series, nobody can clinch for at least 2 more — and it must not
// say games 4 and 5 have real dates just because the real series went to 5.

test('upcoming: only the certain game numbers carry dates; every if-necessary game is blank', () => {
  const mil = seriesWith(bracket2025('2025-10-06'), 'NL', 'division', 'MIL')
  assert.deepEqual(
    mil.upcoming.map((g) => [g.gameNumber, g.date, g.ifNecessary]),
    [
      [2, '2025-10-06', false],
      [3, '2025-10-08', false],
      [4, null, true],
      [5, null, true],
    ],
  )
})

test('upcoming: an if-necessary game has no date even when today alone cannot yet end the series', () => {
  const mil = seriesWith(bracket2025('2025-10-09'), 'NL', 'division', 'MIL')
  assert.deepEqual(
    mil.upcoming.map((g) => [g.gameNumber, g.date, g.gamePk, g.ifNecessary]),
    [
      [4, '2025-10-09', 813050, false],
      [5, null, null, true],
    ],
  )
})

test('trap 6: the bracket is the same whether or not the schedule still lists the game today can drop', () => {
  const cutoff = '2025-10-09'
  const withG5 = deriveBracket(skeleton(2025), results(2025), cutoff)
  const withoutG5 = deriveBracket(
    skeleton(2025).filter((row) => row.gamePk !== 813046), // NLDS MIL-CHC Game 5
    results(2025),
    cutoff,
  )
  assert.deepEqual(withoutG5, withG5)
})

test('trap 6: a future row whose ifNecessary flag flipped does not change the bracket', () => {
  const cutoff = '2025-10-09'
  const flipped = skeleton(2025).map((row) => (row.gamePk === 813046 ? { ...row, ifNecessary: 'N' } : row))
  assert.deepEqual(deriveBracket(flipped, results(2025), cutoff), bracket2025(cutoff))
})
