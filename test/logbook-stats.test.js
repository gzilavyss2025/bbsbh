// Unit coverage for src/api/logbookStats.js — the Logbook's Tier 1
// retrospective (ADR-0035, the game-stamps PRD §6).
//
// This file is the reason that module is pure. FirstScorebookPage.jsx derives
// the same family of numbers — records, streaks, aggregates — inline in
// `useMemo`s, where nothing can reach them, so a miscounted streak or a
// tie-break that flips between renders would only ever be caught by eye. Here
// the math is a function, and every rule below is a rule a future refactor has
// to keep.
//
// The fixture is hand-built rather than captured: the interesting cases (a tie
// breaking a streak, a doubleheader on one date, a game whose facts never
// resolved) are ones a real feed produces rarely and a book of eight games can
// state exactly.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BLOWOUT_MARGIN,
  REGULATION_INNINGS,
  computeLogbookStats,
} from '../src/api/logbookStats.js'

// --------------------------------------------------------------------------
// Fixture — the `game:final` blob shape both producers emit
// (src/api/logbook.js's stampGameFacts, api/stamps.js's fetchGameFinal).
// --------------------------------------------------------------------------
const CLUBS = {
  158: { id: 158, abbreviation: 'MIL', name: 'Milwaukee Brewers' },
  138: { id: 138, abbreviation: 'STL', name: 'St. Louis Cardinals' },
  112: { id: 112, abbreviation: 'CHC', name: 'Chicago Cubs' },
}

// `winnerId: null` is a real, if rare, Final state — a called or suspended game
// that ended level. It matters here because it must break a streak.
function game(gamePk, { date, away, home, awayRuns, homeRuns, innings = 9, venue = 'American Family Field', gameNumber = 1, decisions = {}, tie = false }) {
  const winnerId = tie ? null : awayRuns > homeRuns ? away : home
  return {
    gamePk,
    date,
    gameNumber,
    sportId: 1,
    gameType: 'R',
    venue,
    innings,
    homeBattedLast: true,
    status: 'Final',
    away: { ...CLUBS[away], runs: awayRuns, hits: null, errors: null },
    home: { ...CLUBS[home], runs: homeRuns, hits: null, errors: null },
    winnerId,
    decisions: { winner: '', loser: '', save: '', ...decisions },
  }
}

function stamp(gamePk, date, mode = 'watched') {
  return { gamePk, mode, stampedAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000, note: '', date }
}

// Eight games, deliberately shaped:
//   1  MIL beat STL 3-2      one-run
//   2  MIL beat STL 5-0      shutout, blowout margin 5
//   3  MIL beat CHC 4-1      (MIL win streak reaches 3)
//   4  STL beat MIL 6-1 (11) extra innings, blowout, breaks MIL's streak
//   5  CHC beat MIL 2-1      MIL loss streak 2
//   6  MIL/CHC 4-4 tie       breaks the loss streak without extending anything
//   7  CHC beat MIL 7-0      shutout + blowout; MIL loss streak restarts at 1
//   8  STL beat CHC 3-2      a game MIL is not in at all (doubleheader g2)
const GAMES = [
  game(1, { date: '2026-04-01', away: 138, home: 158, awayRuns: 2, homeRuns: 3, decisions: { winner: 'Freddy Peralta', loser: 'Sonny Gray' } }),
  game(2, { date: '2026-04-02', away: 138, home: 158, awayRuns: 0, homeRuns: 5, decisions: { winner: 'Freddy Peralta', loser: 'Miles Mikolas', save: 'Trevor Megill' } }),
  game(3, { date: '2026-04-05', away: 158, home: 112, awayRuns: 4, homeRuns: 1, venue: 'Wrigley Field', decisions: { winner: 'Quinn Priester', loser: 'Justin Steele' } }),
  game(4, { date: '2026-04-10', away: 138, home: 158, awayRuns: 6, homeRuns: 1, innings: 11, decisions: { winner: 'Sonny Gray', loser: 'Quinn Priester' } }),
  game(5, { date: '2026-04-12', away: 112, home: 158, awayRuns: 2, homeRuns: 1, decisions: { winner: 'Justin Steele', loser: 'Freddy Peralta' } }),
  game(6, { date: '2026-04-15', away: 112, home: 158, awayRuns: 4, homeRuns: 4, tie: true }),
  game(7, { date: '2026-04-18', away: 158, home: 112, awayRuns: 0, homeRuns: 7, venue: 'Wrigley Field', decisions: { winner: 'Justin Steele', loser: 'Quinn Priester' } }),
  game(8, { date: '2026-04-18', away: 138, home: 112, awayRuns: 3, homeRuns: 2, gameNumber: 2, venue: 'Wrigley Field', decisions: { winner: 'Miles Mikolas', loser: 'Justin Steele' } }),
]

const FACTS = Object.fromEntries(GAMES.map((g) => [g.gamePk, g]))
const STAMPS = GAMES.map((g) => stamp(g.gamePk, g.date))

const stats = () => computeLogbookStats(STAMPS, FACTS)

// --------------------------------------------------------------------------
// The empty and degraded shapes
// --------------------------------------------------------------------------
test('an empty collection returns the full shape with zeroes, not nulls', () => {
  const out = computeLogbookStats([], {})
  assert.equal(out.stamps, 0)
  assert.equal(out.games, 0)
  assert.equal(out.runsPerGame, 0)
  assert.equal(out.dateRange, null)
  // Every list is still a list — the page never null-checks a field.
  for (const key of ['seasons', 'clubs', 'venues', 'matchups', 'pitchers']) {
    assert.deepEqual(out[key], [], key)
  }
  assert.deepEqual(out.modes, { watched: 0, followed: 0 })
})

test('non-array / non-object inputs degrade to the empty shape', () => {
  assert.equal(computeLogbookStats(null, null).games, 0)
  assert.equal(computeLogbookStats(undefined, undefined).stamps, 0)
  assert.equal(computeLogbookStats(STAMPS, null).pending, STAMPS.length)
})

test('a stamp whose facts have not resolved counts as pending, never as a game', () => {
  const partial = { ...FACTS }
  delete partial[3]
  const out = computeLogbookStats(STAMPS, partial)
  assert.equal(out.games, 7)
  assert.equal(out.pending, 1)
  // ...but it still counts as a stamp, and still counts in the mode split:
  // the local record knows how you took it in even when the feed is silent.
  assert.equal(out.stamps, 8)
  assert.equal(out.modes.watched, 8)
})

test('a Final game missing a run total is pending, not a shutout', () => {
  // The failure mode this guards: reading a null as 0 would invent a shutout
  // (and a blowout) out of a feed gap.
  const broken = { ...FACTS, 1: { ...FACTS[1], away: { ...FACTS[1].away, runs: null } } }
  const out = computeLogbookStats(STAMPS, broken)
  assert.equal(out.pending, 1)
  // Game 1 was 2-3 — read as 0-3 it would become both a shutout and, at a
  // margin of 3, nothing else. Only the two real shutouts survive.
  assert.equal(out.shutouts, 2) // games 2 and 7
})

test('a game that is not Final never counts', () => {
  const live = { ...FACTS, 2: { ...FACTS[2], status: 'Live' } }
  const out = computeLogbookStats(STAMPS, live)
  assert.equal(out.games, 7)
  assert.equal(out.pending, 1)
})

// --------------------------------------------------------------------------
// Totals
// --------------------------------------------------------------------------
test('games, innings, runs and runs-per-game total the resolved games only', () => {
  const out = stats()
  assert.equal(out.games, 8)
  assert.equal(out.pending, 0)
  assert.equal(out.innings, 9 * 7 + 11)
  // 5 + 5 + 5 + 7 + 3 + 8 + 7 + 5
  assert.equal(out.runs, 45)
  assert.equal(out.runsPerGame, 45 / 8)
})

test('the date range spans first to last game chronologically', () => {
  assert.deepEqual(stats().dateRange, ['2026-04-01', '2026-04-18'])
})

test('one-run games, shutouts, blowouts and extra-inning games are counted by their own rules', () => {
  const out = stats()
  assert.equal(out.oneRunGames, 3) // games 1 (3-2), 5 (2-1), 8 (3-2)
  assert.equal(out.shutouts, 2) // games 2 (5-0) and 7 (7-0)
  assert.equal(out.blowouts, 3) // 5-0, 6-1, 7-0 — margins 5, 5, 7
  assert.equal(out.extraInningGames, 1) // only game 4 went past nine
})

test('a shutout is a game in which SOMEBODY was blanked, counted once', () => {
  const out = computeLogbookStats(
    [stamp(99, '2026-05-01')],
    { 99: game(99, { date: '2026-05-01', away: 138, home: 158, awayRuns: 0, homeRuns: 0, tie: true }) },
  )
  // A 0-0 called game blanks both clubs; it is one shutout, not two.
  assert.equal(out.shutouts, 1)
})

test('the blowout and extra-inning thresholds are the exported constants', () => {
  const wide = game(99, { date: '2026-05-01', away: 138, home: 158, awayRuns: 0, homeRuns: BLOWOUT_MARGIN })
  const narrow = game(98, { date: '2026-05-02', away: 138, home: 158, awayRuns: 1, homeRuns: BLOWOUT_MARGIN })
  const out = computeLogbookStats(
    [stamp(99, '2026-05-01'), stamp(98, '2026-05-02')],
    { 99: wide, 98: narrow },
  )
  assert.equal(out.blowouts, 1)

  const regulation = game(97, { date: '2026-05-03', away: 138, home: 158, awayRuns: 1, homeRuns: 2, innings: REGULATION_INNINGS })
  assert.equal(computeLogbookStats([stamp(97, '2026-05-03')], { 97: regulation }).extraInningGames, 0)
})

// --------------------------------------------------------------------------
// Splits
// --------------------------------------------------------------------------
test('the watched / followed split comes from the stamp record, not the game', () => {
  const mixed = [stamp(1, '2026-04-01', 'followed'), stamp(2, '2026-04-02'), stamp(3, '2026-04-05', 'nonsense')]
  const out = computeLogbookStats(mixed, FACTS)
  // An unknown mode normalizes to 'watched', matching src/lib/stamps.js — the
  // mode is flavour, the stamp is the keepsake.
  assert.deepEqual(out.modes, { watched: 2, followed: 1 })
})

test('home vs. road counts which dugout won, and a tie is neither', () => {
  const out = stats()
  // Home wins: 1, 2, 7. Away wins: 3, 4, 5, 8. Tie: 6.
  assert.deepEqual(out.homeRoad, { homeWins: 3, awayWins: 4, ties: 1 })
  assert.equal(out.homeRoad.homeWins + out.homeRoad.awayWins + out.homeRoad.ties, out.games)
})

test('seasons are counted from each game’s own date, newest first', () => {
  const twoSeasons = [...STAMPS, stamp(50, '2025-09-09')]
  const out = computeLogbookStats(twoSeasons, {
    ...FACTS,
    50: game(50, { date: '2025-09-09', away: 138, home: 158, awayRuns: 1, homeRuns: 2 }),
  })
  assert.deepEqual(out.seasons, [
    { season: 2026, games: 8 },
    { season: 2025, games: 1 },
  ])
})

// --------------------------------------------------------------------------
// Clubs and records
// --------------------------------------------------------------------------
test('every club carries your record watching it, both sides of every game', () => {
  const byId = Object.fromEntries(stats().clubs.map((c) => [c.id, c]))
  // MIL appears in games 1-7: won 1, 2, 3; lost 4, 5, 7; tied 6.
  assert.deepEqual(
    { games: byId[158].games, wins: byId[158].wins, losses: byId[158].losses, ties: byId[158].ties },
    { games: 7, wins: 3, losses: 3, ties: 1 },
  )
  // CHC appears in 3, 5, 6, 7, 8: won 5, 7; lost 3, 8; tied 6.
  assert.deepEqual(
    { games: byId[112].games, wins: byId[112].wins, losses: byId[112].losses, ties: byId[112].ties },
    { games: 5, wins: 2, losses: 2, ties: 1 },
  )
  // Each club's W+L+T equals its games — no game counted twice for one side.
  for (const club of stats().clubs) {
    assert.equal(club.wins + club.losses + club.ties, club.games, club.abbreviation)
  }
})

test('clubs sort by games seen, most first', () => {
  // MIL 7, CHC 5, STL 4.
  assert.deepEqual(stats().clubs.map((c) => c.abbreviation), ['MIL', 'CHC', 'STL'])
})

test('a games-seen tie is broken alphabetically, so the order never flips', () => {
  // One game, two clubs, one apiece — the only tie-break left is the label.
  // Without it the order would follow whichever side the map happened to see
  // first, and the page's "most-seen club" would drift between renders.
  const out = computeLogbookStats([stamp(1, '2026-04-01')], FACTS)
  assert.deepEqual(out.clubs.map((c) => c.abbreviation), ['MIL', 'STL'])
  assert.equal(out.mostSeenClub.abbreviation, 'MIL')
})

test('the most-seen club, and the opponent you saw it face most', () => {
  const out = stats()
  assert.equal(out.mostSeenClub.abbreviation, 'MIL')
  assert.equal(out.mostSeenClub.games, 7)
  // MIL faced STL three times (1, 2, 4) and CHC four (3, 5, 6, 7).
  assert.equal(out.mostSeenOpponent.abbreviation, 'CHC')
  assert.equal(out.mostSeenOpponent.games, 4)
})

// --------------------------------------------------------------------------
// Streaks — the part most worth pinning
// --------------------------------------------------------------------------
test('a streak counts only the games in YOUR book, in date order', () => {
  const mil = stats().clubs.find((c) => c.id === 158)
  // Games 1, 2, 3 are wins — and they are not consecutive on the real calendar
  // (Apr 1, 2, 5). That is the point: this is your streak watching them.
  assert.equal(mil.longestWin.length, 3)
  assert.deepEqual([mil.longestWin.from, mil.longestWin.to], ['2026-04-01', '2026-04-05'])
})

test('a tie breaks a streak without becoming one', () => {
  const mil = stats().clubs.find((c) => c.id === 158)
  // MIL lost 4 and 5, then tied 6, then lost 7. The longest losing run is 2,
  // not 3 — the tie is not a loss.
  assert.equal(mil.longestLoss.length, 2)
  assert.deepEqual([mil.longestLoss.from, mil.longestLoss.to], ['2026-04-10', '2026-04-12'])
})

test('the headline streaks are the best of the per-club ones', () => {
  const out = stats()
  assert.equal(out.longestWinStreak.abbreviation, 'MIL')
  assert.equal(out.longestWinStreak.length, 3)
  const mil = out.clubs.find((c) => c.id === 158)
  assert.equal(out.longestWinStreak.length, mil.longestWin.length)
  assert.equal(out.longestLossStreak.length, 2)
})

test('a lone win is not a streak', () => {
  const one = computeLogbookStats([stamp(1, '2026-04-01')], FACTS)
  const mil = one.clubs.find((c) => c.id === 158)
  assert.equal(mil.longestWin.length, 1) // the club row still records it...
  assert.equal(one.longestWinStreak, null) // ...but the headline needs a pair
  assert.equal(one.longestLossStreak, null)
})

test('a club that never won has no win streak at all', () => {
  const out = computeLogbookStats([stamp(4, '2026-04-10'), stamp(5, '2026-04-12')], FACTS)
  const mil = out.clubs.find((c) => c.id === 158)
  assert.equal(mil.longestWin, null)
  assert.equal(mil.longestLoss.length, 2)
})

test('a doubleheader orders by gameNumber, so a same-day streak is not scrambled', () => {
  // Two games on one date: MIL loses game 1, wins game 2. Ordered wrongly, the
  // book would read as a win followed by a loss and the run boundaries flip.
  const g1 = game(60, { date: '2026-06-01', away: 158, home: 138, awayRuns: 1, homeRuns: 2, gameNumber: 1 })
  const g2 = game(61, { date: '2026-06-01', away: 158, home: 138, awayRuns: 5, homeRuns: 2, gameNumber: 2 })
  const g3 = game(62, { date: '2026-06-02', away: 158, home: 138, awayRuns: 6, homeRuns: 2 })
  // Handed to the module out of order on purpose.
  const out = computeLogbookStats(
    [stamp(62, '2026-06-02'), stamp(61, '2026-06-01'), stamp(60, '2026-06-01')],
    { 60: g1, 61: g2, 62: g3 },
  )
  const mil = out.clubs.find((c) => c.id === 158)
  assert.equal(mil.longestWin.length, 2)
  assert.deepEqual([mil.longestWin.from, mil.longestWin.to], ['2026-06-01', '2026-06-02'])
})

// --------------------------------------------------------------------------
// Venues, matchups, pitchers of record
// --------------------------------------------------------------------------
test('venues count games, most-visited first', () => {
  assert.deepEqual(stats().venues, [
    { name: 'American Family Field', label: 'American Family Field', games: 5 },
    { name: 'Wrigley Field', label: 'Wrigley Field', games: 3 },
  ])
})

test('a matchup is an unordered pair — a home-and-home is one matchup seen twice', () => {
  const out = stats()
  // MIL/CHC: games 3, 5, 6, 7 — two at each park, one matchup.
  const top = out.matchups[0]
  assert.equal(top.games, 4)
  assert.deepEqual(top.teams.map((t) => t.abbreviation).sort(), ['CHC', 'MIL'])
  // The label is fixed by the lower team id, so it never flips with the leg.
  assert.equal(top.key, '112-158')
  assert.equal(out.matchups.reduce((n, m) => n + m.games, 0), out.games)
})

test('pitchers of record aggregate from decisions, saves alongside', () => {
  const byName = Object.fromEntries(stats().pitchers.map((p) => [p.name, p]))
  assert.deepEqual(
    { w: byName['Justin Steele'].wins, l: byName['Justin Steele'].losses, d: byName['Justin Steele'].decisions },
    { w: 2, l: 2, d: 4 },
  )
  assert.deepEqual(
    { w: byName['Freddy Peralta'].wins, l: byName['Freddy Peralta'].losses },
    { w: 2, l: 1 },
  )
  assert.equal(byName['Trevor Megill'].saves, 1)
  // A save is not a decision — it must not inflate the sort key.
  assert.equal(byName['Trevor Megill'].decisions, 0)
  // Most decisions first.
  assert.equal(stats().pitchers[0].name, 'Justin Steele')
})

test('a game with no decisions recorded adds no pitcher rows', () => {
  const out = computeLogbookStats([stamp(6, '2026-04-15')], FACTS)
  assert.deepEqual(out.pitchers, [])
})
