import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchPitcherSeasonVsOpponent } from '../src/api/game.js'

// The shape /api/v1/people/{id}/stats?stats=gameLog&group=pitching really
// returns, trimmed to the fields the sum reads. Every literal is the live
// response's own types — `inningsPitched` arrives as a "6.1" STRING (six and
// one third), the counting stats as strings too, and `isHome` as a boolean.
// Guessing at this feed is how a selector starts reading a field that never
// arrives, so the fixture mirrors it rather than an idealized object.
const start = (date, opponentId, ip, extra = {}) => ({
  date,
  gameType: 'R',
  isHome: false,
  opponent: { id: opponentId },
  stat: { inningsPitched: ip, hits: '4', earnedRuns: '2', strikeOuts: '7', baseOnBalls: '1' },
  ...extra,
})

function withGameLog(splits, run) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ stats: [{ splits }] }),
  })
  return run().finally(() => {
    globalThis.fetch = originalFetch
  })
}

// The reason innings are summed in OUTS rather than added as decimals. Two
// starts of 6.1 IP are twelve and two thirds — "12.2". Naive decimal addition
// gives 12.2 as well BY COINCIDENCE here, so the case that actually proves it
// is 6.2 + 6.2: nineteen and one third, "13.1", where decimal addition would
// say "13.4" — an innings count that cannot exist.
test('two starts of 6.2 IP sum to 13.1, not 13.4', async () => {
  const out = await withGameLog([start('2026-05-01', 158, '6.2'), start('2026-06-01', 158, '6.2')], () =>
    fetchPitcherSeasonVsOpponent(1, 2026, 158, '2026-08-25'),
  )
  assert.equal(out.inningsPitched, '13.1')
  assert.equal(out.games.length, 2)
  assert.equal(out.hits, 8)
  assert.equal(out.earnedRuns, 4)
  assert.equal(out.strikeOuts, 14)
  assert.equal(out.baseOnBalls, 2)
})

// A start against SOMEONE ELSE is not part of this matchup's history.
test('a start against another club is left out of the sum', async () => {
  const out = await withGameLog([start('2026-05-01', 158, '6.0'), start('2026-05-08', 112, '9.0')], () =>
    fetchPitcherSeasonVsOpponent(1, 2026, 158, '2026-08-25'),
  )
  assert.equal(out.inningsPitched, '6.0')
  assert.equal(out.games.length, 1)
})

// The spoiler discipline this shares with fetchPitcherLastGame: a start on or
// after the game being staged must never fold in, or the staging page would
// carry a line out of a game the scorer has not reached.
test('a start on or after the staged game never folds in', async () => {
  const out = await withGameLog(
    [start('2026-05-01', 158, '6.0'), start('2026-08-25', 158, '7.0'), start('2026-09-01', 158, '8.0')],
    () => fetchPitcherSeasonVsOpponent(1, 2026, 158, '2026-08-25'),
  )
  assert.equal(out.games.length, 1)
  assert.equal(out.games[0].date, '2026-05-01')
})

// Spring training and postseason lines are not this season's regular-season
// matchup history.
test('a non-regular-season start is left out', async () => {
  const out = await withGameLog(
    [start('2026-03-01', 158, '4.0', { gameType: 'S' }), start('2026-05-01', 158, '6.0')],
    () => fetchPitcherSeasonVsOpponent(1, 2026, 158, '2026-08-25'),
  )
  assert.equal(out.games.length, 1)
  assert.equal(out.inningsPitched, '6.0')
})

// He has not faced them yet this year — the card's row is hidden on null,
// never rendered as an empty line.
test('null when he has never faced this opponent this season', async () => {
  const out = await withGameLog([start('2026-05-01', 112, '6.0')], () =>
    fetchPitcherSeasonVsOpponent(1, 2026, 158, '2026-08-25'),
  )
  assert.equal(out, null)
})

test('null when a required argument is missing', async () => {
  assert.equal(await fetchPitcherSeasonVsOpponent(null, 2026, 158, '2026-08-25'), null)
  assert.equal(await fetchPitcherSeasonVsOpponent(1, 2026, null, '2026-08-25'), null)
})
