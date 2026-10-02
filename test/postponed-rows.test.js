// A game postponed and made up later comes back from the schedule API as the SAME
// gamePk on two dates (gamePk 816469, Triple-A: 2026-08-14 Postponed, 2026-08-15
// Final 5-4 in 7). The postponed row's abstractGameState is still 'Final', so a
// status check alone does not reject it (#1342). Both stamp-facts producers must
// give the row that was played, whatever the row order.
import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchGameFinal } from '../api/stamps.js'
import { fetchStampGames } from '../src/api/logbook.js'

const side = (id, abbreviation, runs, isWinner) => ({
  team: { id, abbreviation, name: abbreviation, sport: { id: 11 } },
  score: runs,
  isWinner,
})
const POSTPONED = {
  gamePk: 816469,
  officialDate: '2026-08-15',
  gameNumber: 1,
  gameType: 'R',
  status: { abstractGameState: 'Final', detailedState: 'Postponed' },
  teams: { away: side(1, 'AAA', undefined, false), home: side(2, 'BBB', undefined, false) },
  linescore: { innings: [], teams: {} },
}
const PLAYED = {
  ...POSTPONED,
  status: { abstractGameState: 'Final', detailedState: 'Final' },
  teams: { away: side(1, 'AAA', 5, true), home: side(2, 'BBB', 4, false) },
  linescore: {
    scheduledInnings: 7,
    innings: Array.from({ length: 7 }, () => ({ away: { runs: 0 }, home: { runs: 0 } })),
    teams: { away: { runs: 5, hits: 8, errors: 0 }, home: { runs: 4, hits: 6, errors: 1 } },
  },
}
const day = (date, game) => ({ date, games: [game] })
const ORDERS = {
  'postponed first': [day('2026-08-14', POSTPONED), day('2026-08-15', PLAYED)],
  'played first': [day('2026-08-15', PLAYED), day('2026-08-14', POSTPONED)],
}

async function withFetch(dates, run) {
  const real = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ dates }) })
  try {
    return await run()
  } finally {
    globalThis.fetch = real
  }
}

for (const [name, dates] of Object.entries(ORDERS)) {
  test(`fetchGameFinal gives the played row, ${name}`, async () => {
    const facts = await withFetch(dates, () => fetchGameFinal(816469))
    assert.equal(facts.innings, 7)
    assert.equal(facts.away.runs, 5)
    assert.equal(facts.winnerId, 1)
  })

  test(`fetchStampGames gives the played row, ${name}`, async () => {
    const out = await withFetch(dates, () => fetchStampGames([816469]))
    assert.equal(out[816469].innings, 7)
    assert.equal(out[816469].away.runs, 5)
  })
}

test('a game that was only ever postponed still resolves, blank', async () => {
  const out = await withFetch([day('2026-08-14', POSTPONED)], () => fetchStampGames([816469]))
  assert.equal(out[816469].innings, 0)
})
