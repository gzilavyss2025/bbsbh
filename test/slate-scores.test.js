// Unit coverage for the "Scores Unlocked" slate score line (Task A / ADR-0026).
// Three things are pinned here:
//   1. The DEFAULT slate model (normalizeGame) NEVER carries a score-bearing
//      field, even handed a raw schedule row that has them — the spoiler-critical
//      guarantee that a render-gate bug on the slate has nothing to leak.
//   2. fetchSlateScores builds the { gamePk: {…} } score map and degrades to {}.
//   3. slateScoreLine formats Live / Final / extras / lean-MiLB / no-entry.
import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeGame, fetchSlateScores } from '../src/api/schedule.js'
import { slateScoreLine } from '../src/lib/slateScoreLine.js'

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

// A raw schedule row LADEN with every score-bearing field the real feed can
// carry — exactly what fetchSchedule receives before normalizeGame runs.
const scoreLadenRow = {
  gamePk: 777001,
  gameDate: '2026-07-24T23:05:00Z',
  status: { statusCode: 'I', abstractGameState: 'Live' },
  teams: {
    away: {
      team: { id: 158, name: 'Milwaukee Brewers', teamName: 'Brewers' },
      score: 4,
      isWinner: false,
      leagueRecord: { wins: 60, losses: 40 },
    },
    home: {
      team: { id: 109, name: 'Arizona Diamondbacks', teamName: 'D-backs' },
      score: 2,
      isWinner: true,
      leagueRecord: { wins: 50, losses: 50 },
    },
  },
  linescore: {
    currentInning: 7,
    inningState: 'Bottom',
    teams: { away: { runs: 4, hits: 8, errors: 0 }, home: { runs: 2, hits: 5, errors: 1 } },
  },
}

// --------------------------------------------------------------------------
// 1. The default slate model is score-free — the spoiler invariant
// --------------------------------------------------------------------------
test('normalizeGame copies no score-bearing field into the slate model', () => {
  const model = normalizeGame(scoreLadenRow, 1)
  const forbidden = /score|isWinner|runs|hits|errors|linescore|leagueRecord|inningState|currentInning/i
  const scan = (obj, path = '') => {
    for (const [k, v] of Object.entries(obj)) {
      assert.ok(!forbidden.test(k), `slate model leaks a score field at ${path}${k}`)
      if (v && typeof v === 'object') scan(v, `${path}${k}.`)
    }
  }
  scan(model)
  // The coarse, spoiler-free state DOES survive — the score line's Live/Final
  // branch keys off it, so its presence is intentional and asserted.
  assert.equal(model.abstractState, 'Live')
})

// --------------------------------------------------------------------------
// 2. fetchSlateScores — the toggle-gated score fetch
// --------------------------------------------------------------------------
test('fetchSlateScores maps each game to its runs + live inning', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    response({
      dates: [
        {
          games: [
            {
              gamePk: 777001,
              teams: { away: { score: 4 }, home: { score: 2 } },
              linescore: { currentInning: 7, inningState: 'Bottom' },
            },
          ],
        },
      ],
    })
  try {
    const map = await fetchSlateScores('2026-07-24', 1)
    assert.deepEqual(map[777001], {
      awayScore: 4,
      homeScore: 2,
      currentInning: 7,
      inningState: 'Bottom',
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fetchSlateScores degrades to {} on a failed request', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => response({ error: 'boom' }, 500)
  try {
    assert.deepEqual(await fetchSlateScores('2026-07-24', 1), {})
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fetchSlateScores returns {} without a date (never fetches)', async () => {
  assert.deepEqual(await fetchSlateScores('', 1), {})
})

// --------------------------------------------------------------------------
// 3. slateScoreLine — the pure formatter matrix
// --------------------------------------------------------------------------
const game = (abstractState) => ({
  abstractState,
  away: { abbreviation: 'MIL' },
  home: { abbreviation: 'AZ' },
})

test('slateScoreLine: a live game shows the score and the live half', () => {
  const out = slateScoreLine(
    { awayScore: 4, homeScore: 2, currentInning: 7, inningState: 'Bottom' },
    game('Live'),
  )
  assert.equal(out.score, 'MIL 4 – AZ 2')
  assert.equal(out.inning, 'BOT 7')
})

test('slateScoreLine: a regulation Final shows the score, no inning tag', () => {
  const out = slateScoreLine(
    { awayScore: 3, homeScore: 5, currentInning: 9, inningState: 'End' },
    game('Final'),
  )
  assert.equal(out.score, 'MIL 3 – AZ 5')
  assert.equal(out.inning, null) // the card's own FINAL status carries it
})

test('slateScoreLine: an extras Final marks F/{n}', () => {
  const out = slateScoreLine(
    { awayScore: 6, homeScore: 5, currentInning: 11, inningState: 'End' },
    game('Final'),
  )
  assert.equal(out.inning, 'F/11')
})

test('slateScoreLine: a lean feed with no runs yields no line', () => {
  assert.equal(slateScoreLine({ awayScore: null, homeScore: null }, game('Live')), null)
})

test('slateScoreLine: no entry yields no line', () => {
  assert.equal(slateScoreLine(undefined, game('Live')), null)
})

test('slateScoreLine: a live game with no posted inning still shows the score', () => {
  const out = slateScoreLine({ awayScore: 0, homeScore: 0 }, game('Live'))
  assert.equal(out.score, 'MIL 0 – AZ 0')
  assert.equal(out.inning, null)
})
