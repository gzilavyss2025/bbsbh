// The two postseason fetches (#1227, build prompt section 3 and trap 1).
// The results fetch asks statsapi ONLY for dates before the cutoff, and only
// for a winner flag: never runs, a score, a linescore, seriesStatus or
// leagueRecord (the last two give the state AFTER a game). The skeleton fetch
// asks for every date but for no result field at all. Both are pinned here on
// the URL itself, and the row normalizers on real captured answers.
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import {
  dayBefore,
  fetchPostseasonResults,
  fetchPostseasonSkeleton,
  resultRowsFrom,
  resultsUrl,
  skeletonRowsFrom,
  skeletonUrl,
} from '../../src/api/postseason/fetch.js'
import { rawFixture } from './fixtures.js'

const fieldsOf = (url) => new URLSearchParams(url.split('?')[1]).get('fields').split(',')
const FORBIDDEN = /score|runs|linescore|seriesstatus|leaguerecord|hits|errors/i

test('the results URL stops the day before the cutoff and asks for no score', () => {
  const url = resultsUrl(2025, '2025-10-09')
  const q = new URLSearchParams(url.split('?')[1])
  assert.equal(q.get('endDate'), '2025-10-08')
  assert.equal(q.get('startDate'), '2025-01-01')
  assert.equal(q.get('season'), '2025')
  assert.equal(q.get('gameType'), 'F,D,L,W')
  assert.equal(q.get('hydrate'), null)
  for (const f of fieldsOf(url)) assert.ok(!FORBIDDEN.test(f), `results fetch asks for ${f}`)
  assert.ok(fieldsOf(url).includes('isWinner'))
})

test('the skeleton URL carries no result field, not even the game state', () => {
  const url = skeletonUrl(2026)
  for (const f of fieldsOf(url)) {
    assert.ok(!FORBIDDEN.test(f), `skeleton fetch asks for ${f}`)
    assert.ok(!/isWinner|status|GameState/i.test(f), `skeleton fetch asks for ${f}`)
  }
})

test('dayBefore crosses month and year ends', () => {
  assert.equal(dayBefore('2025-10-01'), '2025-09-30')
  assert.equal(dayBefore('2027-01-01'), '2026-12-31')
  assert.equal(dayBefore('2028-03-01'), '2028-02-29')
})

test('resultRowsFrom: a winner only for a Final game with isWinner, one row per listing kept', () => {
  const rows = resultRowsFrom(rawFixture('2022-results'))
  // 2022 ALDS Game 2 (715752): the postponed 10-13 listing is dropped, the
  // played 10-14 listing is kept with its winner.
  const g2 = rows.filter((r) => r.gamePk === 715752)
  assert.equal(g2.length, 1)
  assert.equal(g2[0].officialDate, '2022-10-14')
  assert.equal(g2[0].winnerId, 114)
  // No row carries anything but these keys.
  for (const r of rows) {
    assert.deepEqual(Object.keys(r).sort(), ['final', 'gamePk', 'officialDate', 'resumeGameDate', 'winnerId'])
  }
})

test('resultRowsFrom: the suspended game keeps its first listing and its resume date', () => {
  const rows = resultRowsFrom(rawFixture('2008-results')).filter((r) => r.gamePk === 243847)
  assert.deepEqual(rows, [
    { gamePk: 243847, officialDate: '2008-10-27', resumeGameDate: '2008-10-29', final: true, winnerId: 143 },
  ])
})

test('skeletonRowsFrom keeps clubs and placeholders as the schedule names them', () => {
  const rows = skeletonRowsFrom(rawFixture('2026-skeleton'))
  const nlds = rows.find((r) => r.gamePk === 849828) // NLDS 'B' Game 1, ATL/PHI @ LAD
  assert.deepEqual(nlds.away, { id: 5532, name: 'ATL/PHI', abbreviation: 'ATL/PHI', leagueId: 104 })
  assert.equal(nlds.home.abbreviation, 'LAD')
  assert.equal(nlds.gameNumber, 1)
  assert.equal(nlds.gamesInSeries, 5)
  assert.equal(nlds.seriesDescription, 'NL Division Series')
  assert.equal(nlds.gameType, 'D')
  assert.equal(rows.length, 53)
})

function stubFetch(body) {
  const calls = []
  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url))
    return { ok: true, status: 200, json: async () => body }
  })
  return { calls, restore: () => fetchMock.mock.restore() }
}

test('fetchPostseasonResults asks statsapi once, with the results URL', async () => {
  const stub = stubFetch(rawFixture('2025-results'))
  try {
    const rows = await fetchPostseasonResults(2025, '2025-10-09')
    assert.equal(stub.calls.length, 1)
    assert.ok(stub.calls[0].endsWith(resultsUrl(2025, '2025-10-09')))
    assert.ok(rows.length > 0)
  } finally {
    stub.restore()
  }
})

test('fetchPostseasonSkeleton asks statsapi once, with the skeleton URL', async () => {
  const stub = stubFetch(rawFixture('2026-skeleton'))
  try {
    const rows = await fetchPostseasonSkeleton(2026)
    assert.equal(stub.calls.length, 1)
    assert.ok(stub.calls[0].endsWith(skeletonUrl(2026)))
    assert.equal(rows.length, 53)
  } finally {
    stub.restore()
  }
})
