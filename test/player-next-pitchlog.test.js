import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { fetchFinalScores } from '../src/api/boxlines/fetch.js'
import { keyOf, loadPitchlog, pitchlogView, scopeRows, totalsOf } from '../src/screens/player/next/modules/pitchlog/pitchlogView.js'

// The pitcher Game Log's rows (#1851): his starts from the gameLog split, newest first, with the
// score and decision from fetchFinalScores (which holds today back) and the per-start pitch mix.

const app = (date, pk, { gs = 1, type = 'R', w = 0, l = 0, ip = '6.0', er = 1, k = 5, bb = 1, opp = 112, ...rest } = {}) => ({
  date,
  gameType: type,
  isHome: true,
  league: { id: 104 },
  opponent: { id: opp, name: 'Chicago Cubs' },
  game: { gamePk: pk, gameNumber: 1 },
  stat: {
    gamesStarted: gs, wins: w, losses: l, inningsPitched: ip, hits: 4, runs: er, earnedRuns: er,
    baseOnBalls: bb, strikeOuts: k, homeRuns: 0, numberOfPitches: 90, strikes: 60, ...rest,
  },
})

// Robert Gasser (688107), 2026-05-23 vs LAD, gamePk 823787, as the live gameLog split and the
// pitch-arsenal-starts store have it.
const GASSER = {
  date: '2026-05-23',
  gameType: 'R',
  isHome: true,
  league: { id: 104 },
  opponent: { id: 119, name: 'Los Angeles Dodgers' },
  game: { gamePk: 823787, gameNumber: 1 },
  stat: {
    gamesStarted: 1, wins: 0, losses: 1, inningsPitched: '4.1', hits: 4, runs: 4, earnedRuns: 4,
    baseOnBalls: 4, strikeOuts: 4, homeRuns: 1, numberOfPitches: 89, strikes: 53,
  },
}

test('a row is one start: relief outings stay out, newest first, numbered from his first start', () => {
  const rows = pitchlogView([app('2026-05-01', 1), app('2026-05-06', 2, { gs: 0 }), app('2026-05-11', 3)]).rows
  assert.deepEqual(rows.map((r) => [r.gamePk, r.n]), [[3, 2], [1, 1]])
})

test('no start (a reliever, or no game yet) is no view', () => {
  assert.equal(pitchlogView([app('2026-05-06', 2, { gs: 0 })]), null)
  assert.equal(pitchlogView([]), null)
  assert.equal(pitchlogView(null), null)
})

test('Gasser 5/23 vs LAD: L 3-11, his loss, 4.1 IP, 4 ER, 4 K, 89 pitches, 53 strikes, cutter 29', () => {
  const scores = new Map([[823787, { won: false, runs: 3, oppRuns: 11 }]])
  const mixes = new Map([[823787, { CH: 8, FC: 29, FF: 16, SI: 18, ST: 18 }]])
  const [r] = pitchlogView([GASSER], { scores, mixes }).rows
  assert.deepEqual([r.date, r.home, r.oppId, r.opp], ['5/23', true, 119, 'Los Angeles Dodgers'])
  assert.deepEqual([r.result, r.runs, r.oppRuns, r.dec], ['L', 3, 11, 'L'])
  assert.deepEqual([r.ip, r.h, r.r, r.er, r.bb, r.k, r.hr, r.pitches, r.strikes], ['4.1', 4, 4, 4, 4, 4, 1, 89, 53])
  // The fixed order FF, SI, FC, ST, CH, and each share of the start's pitches.
  assert.deepEqual(r.mix.map((m) => [m.code, m.n, m.pct]), [['FF', 16, 18], ['SI', 18, 20], ['FC', 29, 33], ['ST', 18, 20], ['CH', 8, 9]])
})

test('the decision: W, L, or ND once the game is final', () => {
  const scores = new Map([[1, { runs: 5, oppRuns: 2 }], [2, { runs: 4, oppRuns: 3 }], [3, { runs: 1, oppRuns: 2 }]])
  const rows = pitchlogView([app('2026-05-01', 1, { w: 1 }), app('2026-05-06', 2), app('2026-05-11', 3, { l: 1 })], { scores }).rows
  assert.deepEqual(rows.map((r) => [r.result, r.dec]), [['L', 'L'], ['W', 'ND'], ['W', 'W']])
})

test('the key lists every pitch in the bars, in the bar order, whatever start shows it first', () => {
  const mixes = new Map([[2, { ST: 9, FF: 30, CU: 5 }], [1, { FC: 4, SL: 3, FF: 20 }]])
  const { rows } = pitchlogView([app('2026-05-01', 1), app('2026-05-06', 2), app('2026-05-11', 3)], { mixes })
  assert.deepEqual(keyOf(rows), ['FF', 'FC', 'SL', 'ST', 'CU'])
})

test('a start with no row in the per-start store has no mix bar', () => {
  assert.equal(pitchlogView([app('2026-05-01', 1)], { mixes: new Map() }).rows[0].mix, null)
  assert.equal(pitchlogView([app('2026-05-01', 1)]).rows[0].mix, null)
})

// The one guard (ADR-0110): a start still in progress today shows no final score and no decision.
test('a start in progress today: no score and no decision, though the split already says W', async () => {
  const asked = []
  const m = mock.method(globalThis, 'fetch', async (url) => {
    const pks = (String(url).match(/gamePks=([\d,]+)/)?.[1] ?? '').split(',').map(Number)
    asked.push(...pks)
    const games = pks.map((gamePk) => ({
      gamePk,
      status: { abstractGameState: 'Final' },
      teams: { away: { score: 2, team: { id: 112 } }, home: { score: 6, team: { id: 158 } } },
    }))
    return { ok: true, status: 200, json: async () => ({ dates: [{ games }] }) }
  })
  try {
    const starts = [app('2026-10-08', 1, { w: 1 }), app('2026-10-13', 2, { w: 1 })]
    const scores = await fetchFinalScores(starts, 'pitching', null, '2026-10-13')
    assert.deepEqual(asked, [1])
    const [today, before] = pitchlogView(starts, { scores }).rows
    assert.deepEqual([today.result, today.runs, today.oppRuns, today.dec], [null, null, null, null])
    assert.deepEqual([before.result, before.runs, before.oppRuns, before.dec], ['W', 6, 2, 'W'])
  } finally {
    m.mock.restore()
  }
})

test('a cutoff keeps the starts before that day only', () => {
  const rows = pitchlogView([app('2026-05-01', 1), app('2026-05-11', 3)], { cutoff: '2026-05-11' }).rows
  assert.deepEqual(rows.map((r) => r.gamePk), [1])
})

test('the filter and the totals row: starts, W-L (the decisions shown), ERA, IP, K, BB', () => {
  const { rows } = pitchlogView([
    app('2026-05-01', 1, { w: 1, ip: '6.0', er: 2, k: 7, bb: 1 }),
    app('2026-05-06', 2, { l: 1, ip: '4.1', er: 4, k: 4, bb: 4 }),
    app('2026-10-07', 3, { type: 'D', ip: '4.0', er: 1, k: 3, bb: 1 }),
  ], { scores: new Map([1, 2, 3].map((pk) => [pk, { runs: 3, oppRuns: 2 }])) })
  assert.deepEqual(scopeRows(rows, 'post').map((r) => r.gamePk), [3])
  assert.deepEqual(scopeRows(rows, 'reg').map((r) => r.gamePk), [2, 1])
  assert.equal(scopeRows(rows, 'all').length, 3)
  assert.equal(rows[0].series, 'NLDS')
  assert.deepEqual(totalsOf(rows), { starts: 3, w: 1, l: 1, era: '4.40', ip: '14.1', k: 14, bb: 6 })
  assert.equal(totalsOf([]).era, '—')
})

test('the loader: a log with no start, or a failed fetch, ends as no view', async () => {
  const m = mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => ({ stats: [{ splits: [app('2026-05-06', 2, { gs: 0 })] }] }) }))
  try {
    assert.equal(await loadPitchlog(1, 2026, null), null)
    m.mock.mockImplementation(async () => {
      throw new Error('offline')
    })
    assert.equal(await loadPitchlog(1, 2026, null), null)
  } finally {
    m.mock.restore()
  }
})
