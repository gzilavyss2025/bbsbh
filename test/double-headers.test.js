import assert from 'node:assert/strict'
import test from 'node:test'
import {
  stackDoubleHeaders,
  STACK_WINDOW_MINUTES,
  doubleHeaderLabel,
} from '../src/lib/resultCards.js'

const OMA = 541
const TOL = 512

// The real 2026-08-07 AAA rows this feature was built from: game 2 carries the
// LOWER gamePk and a start five minutes after game 1's.
function twinBill(over = {}) {
  const base = {
    sportId: 11,
    officialDate: '2026-08-07',
    doubleHeader: 'Y',
    away: { id: OMA },
    home: { id: TOL },
    abstractState: 'Preview',
  }
  return [
    { ...base, gamePk: 815575, gameNumber: 1, gameDate: '2026-08-07T21:35:00Z', ...over.first },
    { ...base, gamePk: 815573, gameNumber: 2, gameDate: '2026-08-07T21:40:00Z', ...over.second },
  ]
}

const LONE = {
  gamePk: 815648,
  sportId: 11,
  officialDate: '2026-08-07',
  doubleHeader: 'N',
  gameNumber: 1,
  gameDate: '2026-08-07T22:35:00Z',
  away: { id: 445 },
  home: { id: 552 },
  abstractState: 'Preview',
}

test('stackDoubleHeaders: a pre-game twin bill collapses onto game 1', () => {
  const [g1, g2] = twinBill()
  const { games, stackedBehind } = stackDoubleHeaders([g1, g2, LONE])
  assert.deepEqual(
    games.map((g) => g.gamePk),
    [815575, 815648],
  )
  assert.equal(stackedBehind.get(815575), g2)
  assert.equal(stackedBehind.size, 1)
})

test('stackDoubleHeaders: pairing is by gameNumber, not gamePk order', () => {
  // Game 2's pk sorts first; feeding the rows in that order must not make it
  // the card the other one stacks behind.
  const [g1, g2] = twinBill()
  const { games, stackedBehind } = stackDoubleHeaders([g2, g1])
  assert.deepEqual(
    games.map((g) => g.gamePk),
    [815575],
  )
  assert.equal(stackedBehind.get(815575).gameNumber, 2)
})

test('stackDoubleHeaders: game 2 returns to the slate once game 1 is under way', () => {
  for (const state of ['Live', 'Final']) {
    const [g1, g2] = twinBill({ first: { abstractState: state } })
    const { games, stackedBehind } = stackDoubleHeaders([g1, g2])
    assert.equal(games.length, 2, `${state} game 1 must not hide game 2`)
    assert.equal(stackedBehind.size, 0)
  }
})

// MLB's own traditional twin bill carries the identical 5-minute placeholder:
// Colorado at the Mets, 2026-04-26, 5:40 PM and 5:45 PM.
test('stackDoubleHeaders: an MLB traditional doubleheader stacks the same way', () => {
  const [g1, g2] = twinBill({
    first: { sportId: 1, officialDate: '2026-04-26', gameDate: '2026-04-26T21:40:00Z' },
    second: { sportId: 1, officialDate: '2026-04-26', gameDate: '2026-04-26T21:45:00Z' },
  })
  const { games, stackedBehind } = stackDoubleHeaders([g1, g2])
  assert.deepEqual(
    games.map((g) => g.gameNumber),
    [1],
  )
  assert.equal(stackedBehind.get(g1.gamePk), g2)
})

// The far more common MLB shape: a split-admission pair with two real times, an
// afternoon game and an evening one. Every one of the season's 14 sits between
// 240 and 405 minutes apart, so none of them may collapse — the reader needs
// both times.
test('stackDoubleHeaders: a split doubleheader, hours apart, stays two cards', () => {
  for (const gapMinutes of [240, 300, 405]) {
    const start = new Date('2026-07-19T20:35:00Z')
    const second = new Date(start.getTime() + gapMinutes * 60000).toISOString()
    const [g1, g2] = twinBill({
      first: { sportId: 1, doubleHeader: 'S', gameDate: start.toISOString() },
      second: { sportId: 1, doubleHeader: 'S', gameDate: second },
    })
    const { games, stackedBehind } = stackDoubleHeaders([g1, g2])
    assert.equal(games.length, 2, `${gapMinutes}min apart must stay two cards`)
    assert.equal(stackedBehind.size, 0)
  }
  // The window has to stay clear of both observed clusters: 5 minutes on a
  // traditional pair, 240+ on a split one.
  assert.ok(STACK_WINDOW_MINUTES > 5 && STACK_WINDOW_MINUTES < 240)
})

test('stackDoubleHeaders: same two clubs on different dates are not a pair', () => {
  const [g1] = twinBill()
  const [, g2] = twinBill({ second: { officialDate: '2026-08-08', gameDate: '2026-08-08T21:40:00Z' } })
  const { games, stackedBehind } = stackDoubleHeaders([g1, g2])
  assert.equal(games.length, 2)
  assert.equal(stackedBehind.size, 0)
})

test('stackDoubleHeaders: nothing to stack returns the same array reference', () => {
  const games = [LONE]
  assert.equal(stackDoubleHeaders(games).games, games)
  assert.equal(stackDoubleHeaders([]).games.length, 0)
})

test('doubleHeaderLabel: the stacked card says DOUBLEHEADER, every other card its number', () => {
  const [g1, g2] = twinBill()
  assert.equal(doubleHeaderLabel(g1, true), 'Doubleheader')
  assert.equal(doubleHeaderLabel(g1), 'Game 1')
  assert.equal(doubleHeaderLabel(g2), 'Game 2')
  assert.equal(doubleHeaderLabel(LONE), null)
  // A lone game can never be stacked, so "stacked" must not invent a pill.
  assert.equal(doubleHeaderLabel(LONE, true), null)
})
