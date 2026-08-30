// Coverage for the run value data layer — src/api/around-the-game/runValue.js,
// the derivations the nightly file deliberately does NOT carry (the total, the
// ranks, the role split, the club roll-up).
//
// The first test is the one that matters most, and it is not hypothetical: the
// published leaderboard this feature reconstructs prints a total that is NOT
// the sum of its own printed columns. Pete Crow-Armstrong's row reads
// +36 / +24 / +5 / +0 and totals +66, because the total is summed from the
// unrounded components and only then rounded. Sum the whole runs on screen and
// you get 65. A reader who checks our arithmetic against the columns beside it
// will get 65 too, so the rule has to be pinned: components are rounded for
// DISPLAY only, and the total is always computed from the stored tenths.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COMPONENTS,
  MIN_ABS_RUNS,
  ROLES,
  board,
  clubBoard,
  clubRunValue,
  componentBoard,
  isPitcher,
  playerRunValue,
  signed,
  tone,
  total,
} from '../src/api/around-the-game/runValue.js'

const player = (id, name, over = {}) => ({
  id,
  name,
  teamId: 112,
  bat: 0,
  fld: 0,
  run: 0,
  pit: 0,
  ...over,
})

// The real top of the 2026 board as published on 2026-08-29, at the tenths the
// generator stores. Used by several tests below; every figure came off the four
// Baseball Savant leaderboards the generator reads (docs/run-value.md).
const PUBLISHED = {
  season: 2026,
  players: [
    player(691718, 'Pete Crow-Armstrong', { teamId: 112, bat: 36.2, fld: 24.4, run: 5.1 }),
    player(660271, 'Shohei Ohtani', { teamId: 119, bat: 28.8, run: 1.2, pit: 20.5 }),
    player(694819, 'Jacob Misiorowski', { teamId: 158, pit: 46.7 }),
    player(670541, 'Yordan Alvarez', { teamId: 117, bat: 50.2, fld: -2, run: -4.6 }),
    player(656302, 'Dylan Cease', { teamId: 141, pit: 36.4 }),
    player(621566, 'Matt Olson', { teamId: 144, bat: 30.1, fld: 5.9 }),
  ],
}

// --------------------------------------------------------------------------
// total — summed from the stored tenths, never from the printed whole runs.
// --------------------------------------------------------------------------

test('total sums the tenths, so it can differ from the printed columns', () => {
  const pca = PUBLISHED.players[0]
  // The columns as the board prints them add to 65 …
  const printed = COMPONENTS.reduce((sum, c) => sum + Math.round(pca[c.key]), 0)
  assert.equal(printed, 65)
  // … and the published total is 66. That gap is the point.
  assert.equal(signed(total(pca)), '+66')
})

test('total is zero for a player with no component at all', () => {
  assert.equal(total(player(1, 'Nobody')), 0)
  assert.equal(total(null), 0)
})

test('a negative total keeps its sign through the rounding', () => {
  assert.equal(signed(total(player(2, 'Cold', { bat: -8.4, fld: -1.2 }))), '-10')
})

// --------------------------------------------------------------------------
// signed / tone — how a figure is printed and inked.
// --------------------------------------------------------------------------

test('signed prints a plus on anything above zero and a bare 0 on nothing', () => {
  assert.equal(signed(4.4), '+4')
  assert.equal(signed(0), '0')
  assert.equal(signed(-0.2), '0', 'a small negative rounds to nothing, not to “-0”')
  assert.equal(signed(-4.6), '-5')
  assert.equal(signed(null), '—')
})

test('tone calls a rounded zero neither good nor bad', () => {
  assert.equal(tone(3), 'up')
  assert.equal(tone(-3), 'down')
  assert.equal(tone(0.4), 'flat', 'under half a run is not a strength')
})

// --------------------------------------------------------------------------
// isPitcher — the role split is drawn on the numbers, not on a position code.
// --------------------------------------------------------------------------

test('a two-way season lands on the side its own value came from', () => {
  // Ohtani's real 2026 line to this date: more with the bat than on the mound.
  assert.equal(isPitcher(PUBLISHED.players[1]), false)
  // Flip the halves and the same rule puts him the other way.
  assert.equal(isPitcher(player(3, 'Other Way', { bat: 10, pit: 40 })), true)
})

test('a position player who mopped up an inning is still a position player', () => {
  assert.equal(isPitcher(player(4, 'Mop Up', { bat: 12, fld: 3, pit: -1.4 })), false)
})

test('a reliever who took an at-bat is still a pitcher', () => {
  assert.equal(isPitcher(player(5, 'Reliever', { bat: -0.4, pit: 9 })), true)
})

test('ROLES offers everyone first', () => {
  assert.equal(ROLES[0].key, 'all')
  assert.deepEqual(
    ROLES.map((r) => r.key),
    ['all', 'position', 'pitchers'],
  )
})

// --------------------------------------------------------------------------
// board — the ranked leaderboard.
// --------------------------------------------------------------------------

test('board reproduces the published order', () => {
  assert.deepEqual(
    board(PUBLISHED).map((r) => `${r.rank} ${r.name} ${signed(r.value)}`),
    [
      '1 Pete Crow-Armstrong +66',
      '2 Shohei Ohtani +51',
      '3 Jacob Misiorowski +47',
      '4 Yordan Alvarez +44',
      '5 Dylan Cease +36',
      '6 Matt Olson +36',
    ],
  )
})

test('two rows printed at the same whole runs are still ranked apart', () => {
  // Cease (+36.4) and Olson (+36.0) both print "+36". They are 5th and 6th —
  // not both 5th — because the rank reads the tenths, which is how the source
  // publishes it and the honest reading of two seasons a tenth apart.
  const rows = board(PUBLISHED)
  const cease = rows.find((r) => r.name === 'Dylan Cease')
  const olson = rows.find((r) => r.name === 'Matt Olson')
  assert.equal(signed(cease.value), signed(olson.value))
  assert.equal(cease.rank, 5)
  assert.equal(olson.rank, 6)
  assert.equal(cease.tied, false)
})

test('genuinely level rows share a rank and are both marked tied', () => {
  const data = {
    players: [
      player(10, 'A', { bat: 12 }),
      player(11, 'B', { bat: 12 }),
      player(12, 'C', { bat: 4 }),
    ],
  }
  const rows = board(data)
  assert.deepEqual(
    rows.map((r) => [r.name, r.rank, r.tied]),
    [
      ['A', 1, true],
      ['B', 1, true],
      ['C', 3, false],
    ],
  )
})

test('the role filter narrows the board but not what a rank means', () => {
  const pitchers = board(PUBLISHED, { role: 'pitchers' })
  assert.deepEqual(pitchers.map((r) => r.name), ['Jacob Misiorowski', 'Dylan Cease'])
  assert.equal(pitchers[0].rank, 1, 'ranked within the role shown, not carried over from the full board')
})

test('a club filter leaves only that club', () => {
  assert.deepEqual(
    board(PUBLISHED, { teamId: 119 }).map((r) => r.name),
    ['Shohei Ohtani'],
  )
})

test('reading the board from the bottom keeps each row’s real rank', () => {
  const worst = board(PUBLISHED, { direction: 'asc' })
  assert.equal(worst[0].name, 'Matt Olson')
  assert.equal(worst[0].rank, 6, 'still 6th of six, not 1st-worst')
})

test('a player who has not moved a run does not reach the board', () => {
  const data = { players: [...PUBLISHED.players, player(99, 'Just Up', { bat: 0.4 })] }
  assert.equal(Math.abs(total(data.players[6])) < MIN_ABS_RUNS, true)
  assert.equal(board(data).some((r) => r.name === 'Just Up'), false)
})

test('board copes with a file that never loaded', () => {
  assert.deepEqual(board(null), [])
  assert.deepEqual(board({ players: [] }), [])
})

// --------------------------------------------------------------------------
// componentBoard — one skill's own leaders.
// --------------------------------------------------------------------------

test('a component board ranks within that component, across every role', () => {
  assert.deepEqual(
    componentBoard(PUBLISHED, 'bat', { limit: 3 }).map((r) => r.name),
    ['Yordan Alvarez', 'Pete Crow-Armstrong', 'Matt Olson'],
  )
  assert.deepEqual(
    componentBoard(PUBLISHED, 'pit', { limit: 2 }).map((r) => r.name),
    ['Jacob Misiorowski', 'Dylan Cease'],
  )
})

test('a component board does not apply the total floor', () => {
  // A glove-only player a fraction of a run from average overall still leads
  // the league with the glove, and this board is where that shows.
  const data = { players: [player(20, 'Glove Only', { bat: -14.6, fld: 15 })] }
  assert.equal(Math.abs(total(data.players[0])) < MIN_ABS_RUNS, true)
  assert.equal(componentBoard(data, 'fld')[0].name, 'Glove Only')
})

// --------------------------------------------------------------------------
// playerRunValue — one man, with where he stands.
// --------------------------------------------------------------------------

test('a player is ranked against his own role', () => {
  const view = playerRunValue(PUBLISHED, 694819)
  assert.equal(view.name, 'Jacob Misiorowski')
  assert.equal(view.role, 'pitchers')
  assert.equal(view.rank, 1)
  assert.equal(view.of, 2)
  assert.equal(signed(view.total), '+47')
})

test('a player under the floor keeps his components and loses only his rank', () => {
  const data = { players: [player(30, 'Quiet', { bat: 0.3, fld: -0.2 })] }
  const view = playerRunValue(data, 30)
  assert.equal(view.rank, null)
  assert.equal(view.bat, 0.3)
})

test('a player who is not in the file at all reads as absent', () => {
  assert.equal(playerRunValue(PUBLISHED, 1), null)
  assert.equal(playerRunValue(null, 691718), null)
})

// --------------------------------------------------------------------------
// clubRunValue / clubBoard — the club roll-up.
// --------------------------------------------------------------------------

test('a club sums its own men and lists them best first', () => {
  const data = {
    players: [
      player(40, 'Bat', { teamId: 158, bat: 10 }),
      player(41, 'Arm', { teamId: 158, pit: 20 }),
      player(42, 'Elsewhere', { teamId: 112, bat: 99 }),
    ],
  }
  const club = clubRunValue(data, 158)
  assert.equal(club.total, 30)
  assert.equal(club.bat, 10)
  assert.equal(club.pit, 20)
  assert.deepEqual(club.players.map((p) => p.name), ['Arm', 'Bat'])
})

test('a club with nobody in the file reads as absent, not as a club of zero', () => {
  assert.equal(clubRunValue(PUBLISHED, 999), null)
})

test('the club board ranks clubs and counts who it counted', () => {
  const rows = clubBoard(PUBLISHED)
  assert.equal(rows[0].teamId, 112, 'Crow-Armstrong’s +66 is the biggest single-club total here')
  assert.equal(rows[0].rank, 1)
  assert.equal(signed(rows[0].total), '+66')
  assert.equal(rows.every((r) => r.n >= 1), true)
})

test('a player with no club at all is left out of the club board', () => {
  const data = { players: [player(50, 'Free Agent', { teamId: null, bat: 20 })] }
  assert.deepEqual(clubBoard(data), [])
})
