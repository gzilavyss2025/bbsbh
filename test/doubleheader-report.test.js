// The two halves of the doubleheader report's pipeline: what scripts/gen-doubleheaders.mjs
// reduces a season's schedule down to, and what src/api/around-the-game/doubleheaders.js
// folds those pair rows into for the board.
//
// The assertions worth having are about which DAYS count and which do not,
// because that is where this report can be wrong while still looking right:
//
//   - A makeup doubleheader SWAPS home and away between its two games. Keying
//     the day on away|home splits it into two lone games and drops it. 2020
//     lost more than twenty real doubleheaders to exactly that bug before it
//     was caught, and nothing on the finished page would have looked odd.
//   - A rained-out second game leaves ONE Final game still carrying the
//     doubleHeader flag. Counting it puts single games inside a doubleheader
//     record.
//   - Sweeps count DAYS and W-L counts GAMES, so the two must stay in step:
//     sweeps + sweptBy + splits has to equal the doubleheader count, and W+L
//     has to equal twice it (less any tie).
import test from 'node:test'
import assert from 'node:assert/strict'
import { pairsFromGames, hostsByVenue } from '../scripts/gen-doubleheaders.mjs'
import {
  buildBoard,
  boardHighlights,
  seasonBounds,
  topOpponents,
  pct,
} from '../src/api/around-the-game/doubleheaders.js'

// One schedule row, in the shape the fields-filtered feed returns.
const game = ({
  date = '2026-07-04',
  away,
  home,
  winner,
  dh = 'S',
  num = 1,
  state = 'F',
  venue = 1,
}) => ({
  date,
  gameNumber: num,
  doubleHeader: dh,
  status: { codedGameState: state },
  venue: { id: venue },
  teams: {
    away: { team: { id: away }, isWinner: winner === away },
    home: { team: { id: home }, isWinner: winner === home },
  },
})

// A season's worth of home dates at one park, so hostsByVenue clears its
// minimum and calls that park the club's own.
const homeStand = (teamId, venue, n = 25) =>
  Array.from({ length: n }, (_, i) =>
    game({ date: `2026-04-${String((i % 28) + 1).padStart(2, '0')}`, away: 999, home: teamId, venue, dh: 'N' }),
  )

test('pairs a doubleheader whose two games swap home and away', () => {
  // The 2020-08-05 shape: game 1 at one park, game 2 the makeup, so the
  // visiting club bats last. One day, one doubleheader.
  const { pairs, incomplete } = pairsFromGames([
    game({ away: 143, home: 147, winner: 147, dh: 'Y', num: 1 }),
    game({ away: 147, home: 143, winner: 147, dh: 'Y', num: 2 }),
  ])
  assert.equal(incomplete, 0)
  assert.equal(pairs.length, 1)
  const [date, teamA, teamB, winsA, winsB] = pairs[0]
  assert.equal(date, '2026-07-04')
  // Ids are sorted low-first, so the row does not encode home and away at all.
  assert.equal(teamA, 143)
  assert.equal(teamB, 147)
  assert.equal(winsA, 0)
  assert.equal(winsB, 2)
})

// The half of the swap case the pairing rule cannot answer on its own: which
// club's park was this? The two games disagree — one has 147 at home, the other
// 143 — and both were played at one address. Only the venue knows.
test('the host is the park\u2019s usual occupant, not the game\u2019s home flag', () => {
  const season = [
    ...homeStand(147, 55),
    game({ date: '2026-07-04', away: 143, home: 147, winner: 147, dh: 'Y', num: 1, venue: 55 }),
    game({ date: '2026-07-04', away: 147, home: 143, winner: 147, dh: 'Y', num: 2, venue: 55 }),
  ]
  const { pairs } = pairsFromGames(season)
  const day = pairs.find((r) => r[0] === '2026-07-04')
  assert.equal(day[5], 147, 'the day belongs to the club that plays at venue 55')
})

test('a park nobody calls home leaves the host unset', () => {
  // London, Mexico City, the Field of Dreams game: a handful of dates at a
  // venue no club occupies. Calling it somebody's park would print "@ Cubs"
  // for a game nobody played in Chicago.
  const { pairs } = pairsFromGames([
    game({ away: 112, home: 158, winner: 112, num: 1, venue: 401 }),
    game({ away: 112, home: 158, winner: 158, num: 2, venue: 401 }),
  ])
  assert.equal(pairs[0][5], null)
})

test('hostsByVenue takes the mode, and only past the threshold', () => {
  const hosts = hostsByVenue([...homeStand(158, 7), ...homeStand(112, 9, 3)])
  assert.equal(hosts.get(7), 158)
  assert.equal(hosts.has(9), false, 'three dates is not a home park')
})

test('a doubleheader with only one game played is dropped, and counted', () => {
  const { pairs, incomplete } = pairsFromGames([
    game({ away: 158, home: 138, winner: 158, num: 1 }),
    game({ away: 158, home: 138, num: 2, state: 'D' }), // postponed
  ])
  assert.deepEqual(pairs, [])
  assert.equal(incomplete, 1)
})

test('two games on one day without the flag are not a doubleheader', () => {
  const { pairs, incomplete } = pairsFromGames([
    game({ away: 158, home: 138, winner: 158, dh: 'N', num: 1 }),
    game({ away: 158, home: 138, winner: 138, dh: 'N', num: 2 }),
  ])
  assert.deepEqual(pairs, [])
  assert.equal(incomplete, 0)
})

test('a tied game counts in the pair but credits neither club', () => {
  const { pairs } = pairsFromGames([
    game({ away: 158, home: 138, winner: 158, num: 1 }),
    game({ away: 158, home: 138, winner: null, num: 2 }),
  ])
  assert.equal(pairs.length, 1)
  // Row is [date, 138, 158, wins, wins, host] — ids sorted low-first — so the
  // club that won the first game is the SECOND number, and the tie credits
  // neither. The host is unset here: this fixture has no home stand behind it.
  assert.deepEqual(pairs[0].slice(3), [0, 1, null])
})

test("'Game Over' counts as played, the way the rest of the app treats it", () => {
  const { pairs } = pairsFromGames([
    game({ away: 158, home: 138, winner: 158, num: 1, state: 'O' }),
    game({ away: 158, home: 138, winner: 138, num: 2, state: 'F' }),
  ])
  assert.equal(pairs.length, 1)
})

// A three-season file: 158 sweeps 138 in 2024 at 138's park, is swept by 138 in
// 2025 at its own, and splits with 112 in 2026 at its own. The sixth column is
// the host club.
const FILE = {
  seasons: {
    2024: [['2024-05-01', 138, 158, 0, 2, 138]],
    2025: [['2025-05-01', 138, 158, 2, 0, 158]],
    2026: [['2026-05-01', 112, 158, 1, 1, 158]],
  },
}

test('seasonBounds reads the span the file covers', () => {
  assert.deepEqual(seasonBounds(FILE), { first: 2024, last: 2026 })
  assert.equal(seasonBounds({ seasons: {} }), null)
})

test('both clubs are folded from one pair row', () => {
  const { rows, pairs, clubs } = buildBoard(FILE, { from: 2024, to: 2024 })
  assert.equal(pairs, 1)
  assert.equal(clubs, 2)
  const brewers = rows.find((r) => r.teamId === 158)
  const cardinals = rows.find((r) => r.teamId === 138)
  assert.deepEqual(
    { dh: brewers.dh, w: brewers.w, l: brewers.l, sweeps: brewers.sweeps, sweptBy: brewers.sweptBy },
    { dh: 1, w: 2, l: 0, sweeps: 1, sweptBy: 0 },
  )
  assert.deepEqual(
    {
      dh: cardinals.dh,
      w: cardinals.w,
      l: cardinals.l,
      sweeps: cardinals.sweeps,
      sweptBy: cardinals.sweptBy,
    },
    { dh: 1, w: 0, l: 2, sweeps: 0, sweptBy: 1 },
  )
})

test('the year range is what changes the answer', () => {
  const all = buildBoard(FILE, { from: 2024, to: 2026 })
  const brewers = all.rows.find((r) => r.teamId === 158)
  assert.equal(brewers.dh, 3)
  assert.equal(brewers.w, 3)
  assert.equal(brewers.l, 3)
  assert.equal(brewers.pct, '.500')

  // Narrowed to 2025, the same club is 0-2 and shows up swept.
  const narrow = buildBoard(FILE, { from: 2025, to: 2025 })
  const narrowed = narrow.rows.find((r) => r.teamId === 158)
  assert.equal(narrowed.dh, 1)
  assert.equal(narrowed.sweptBy, 1)
  assert.equal(narrowed.pct, '.000')
  // 112 played no doubleheader in 2025, so it is not on the board at all.
  assert.equal(narrow.rows.some((r) => r.teamId === 112), false)
})

test('days and games stay in step for every row', () => {
  const { rows } = buildBoard(FILE, { from: 2024, to: 2026 })
  for (const r of rows) {
    assert.equal(r.sweeps + r.sweptBy + r.splits, r.dh, `days for ${r.teamId}`)
    assert.equal(r.w + r.l + r.t, r.dh * 2, `games for ${r.teamId}`)
  }
})

test('the per-year drawer lists only the seasons a club actually played one', () => {
  const { rows } = buildBoard(FILE, { from: 2024, to: 2026 })
  const cardinals = rows.find((r) => r.teamId === 138)
  assert.deepEqual(
    cardinals.seasons.map((s) => s.season),
    [2025, 2024], // newest first, and no 2026 line at all
  )
})

// The drawer draws a MARK per sweep, not a count, so each season has to carry
// the ids — and carry a repeat as a repeat.
test('each season names the clubs swept and the clubs that swept it', () => {
  const file = {
    seasons: {
      2026: [
        ['2026-05-01', 112, 158, 0, 2, 158],
        ['2026-06-01', 112, 158, 0, 2, 112], // 158 sweeps the same club twice
        ['2026-07-01', 138, 158, 2, 0, 138], // and is swept once
      ],
    },
  }
  const { rows } = buildBoard(file, { from: 2026, to: 2026 })
  const year = rows.find((r) => r.teamId === 158).seasons[0]
  assert.deepEqual(year.swept, [112, 112], 'the same opponent twice is two marks')
  assert.deepEqual(year.sweptBy, [138])
  // The counts the row prints are derived from those same lists.
  assert.equal(year.swept.length + year.sweptBy.length <= year.dh, true)
})

// "@ Brewers" or "vs Brewers" — read off the host column, never off a per-game
// home flag.
test('each doubleheader in a season knows whose park it was at', () => {
  const { rows } = buildBoard(FILE, { from: 2024, to: 2026 })
  const brewers = rows.find((r) => r.teamId === 158)
  const byYear = Object.fromEntries(brewers.seasons.map((s) => [s.season, s.days]))
  assert.deepEqual(byYear[2024], [{ oppId: 138, home: false, w: 2, l: 0, swept: true, sweptBy: false }])
  assert.deepEqual(byYear[2025], [{ oppId: 138, home: true, w: 0, l: 2, swept: false, sweptBy: true }])
  assert.equal(byYear[2026][0].home, true)

  // The other side of the same row sees the mirror image.
  const cardinals = rows.find((r) => r.teamId === 138)
  assert.equal(cardinals.seasons.find((s) => s.season === 2024).days[0].home, true)
})

test('a neutral-site doubleheader is neither home nor away', () => {
  const file = { seasons: { 2026: [['2026-06-20', 112, 158, 1, 1, null]] } }
  const { rows } = buildBoard(file, { from: 2026, to: 2026 })
  for (const row of rows) {
    assert.equal(row.seasons[0].days[0].home, null)
  }
})

test('a tie at the top of the opponent column names every club sharing it', () => {
  const byOpponent = new Map([
    [138, { teamId: 138, dh: 2 }],
    [112, { teamId: 112, dh: 2 }],
    [141, { teamId: 141, dh: 1 }],
  ])
  assert.deepEqual(topOpponents(byOpponent), { dh: 2, ids: [112, 138] })
  assert.equal(topOpponents(new Map()), null)
})

test('the most-met opponent is counted over the selected years only', () => {
  const { rows } = buildBoard(FILE, { from: 2024, to: 2025 })
  const brewers = rows.find((r) => r.teamId === 158)
  assert.deepEqual(brewers.top, { dh: 2, ids: [138] })
})

test('sorting picks the column and the sample breaks the tie', () => {
  const file = {
    seasons: {
      2026: [
        ['2026-05-01', 112, 158, 0, 2], // 158 sweeps
        ['2026-06-01', 112, 158, 0, 2], // 158 sweeps again
        ['2026-07-01', 138, 141, 0, 2], // 141 sweeps once
      ],
    },
  }
  const bySweeps = buildBoard(file, { from: 2026, to: 2026, sortBy: 'sweeps' })
  assert.equal(bySweeps.rows[0].teamId, 158)
  assert.equal(bySweeps.rows[0].rank, 1)

  // 158 and 141 are both 1.000; the club with four games ranks above the one
  // with two, and both share rank 1 because the ranking is on the value.
  const byPct = buildBoard(file, { from: 2026, to: 2026, sortBy: 'pct' })
  assert.equal(byPct.rows[0].teamId, 158)
  assert.equal(byPct.rows[0].tied, true)
  assert.equal(byPct.rows[1].teamId, 141)
  assert.equal(byPct.rows[1].rank, 1)
})

test('the slabs read off the board they sit above', () => {
  const highs = boardHighlights(buildBoard(FILE, { from: 2024, to: 2026 }))
  assert.equal(highs.pairs, 3)
  assert.equal(highs.busiest.teamId, 158) // three doubleheaders, the most
  assert.equal(highs.mostSweeps.sweeps, 1)
  assert.equal(boardHighlights({ rows: [] }), null)
})

test('win percentage prints the way every other record in the app does', () => {
  assert.equal(pct(3, 3), '.500')
  assert.equal(pct(2, 0), '1.000')
  assert.equal(pct(0, 0), null)
})
