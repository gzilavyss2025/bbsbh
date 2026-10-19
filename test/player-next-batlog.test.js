import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { fetchFinalScores } from '../src/api/boxlines/fetch.js'
import { COLUMNS, batlogView, loadBatlog, scopeRows, totalsOf } from '../src/screens/player/next/modules/batlog/batlogView.js'

// The batter Game Log's rows (#1890): every game of the hitting gameLog split, newest first, with
// the club's score from fetchFinalScores (which holds today back) and the fouls store's per-game
// pitches seen, fouls and whiffs. Same shape as the pitcher log (player-next-pitchlog.test.js).

const game = (date, pk, { n = 1, type = 'R', pos = ['2B'], opp = 112, ...stat } = {}) => ({
  date,
  gameType: type,
  isHome: true,
  league: { id: 104 },
  opponent: { id: opp, name: 'Chicago Cubs' },
  positionsPlayed: pos.map((abbreviation) => ({ abbreviation })),
  game: { gamePk: pk, gameNumber: n },
  stat: {
    atBats: 4, runs: 1, hits: 2, doubles: 1, triples: 0, homeRuns: 0, rbi: 1, baseOnBalls: 1, strikeOuts: 1,
    stolenBases: 0, hitByPitch: 0, sacFlies: 0, numberOfPitches: 20, ...stat,
  },
})

test('the columns: the board order, the card look of each', () => {
  assert.deepEqual(
    COLUMNS.map((c) => [c.key, c.label, c.card]),
    [
      ['game', 'Game', 'head'],
      ['result', 'Result · Pos', 'end'],
      ...['ab:AB', 'r:R', 'h:H', 'd2:2B', 'd3:3B', 'hr:HR', 'rbi:RBI', 'bb:BB', 'k:K', 'sb:SB', 'avg:AVG'].map((s) => [...s.split(':'), 'cell']),
      ['seen', 'Seen', 'foot'],
      ['bar', 'Whiffs · fouls · other', 'foot'],
    ],
  )
})

test('row values: the stat line, the position, the day\'s average, the club\'s score', () => {
  const scores = new Map([[1, { runs: 14, oppRuns: 2 }]])
  const [r] = batlogView([game('2026-03-26', 1, { atBats: 4, hits: 2, pos: ['2B', 'SS'] })], { scores }).rows
  assert.deepEqual([r.date, r.home, r.oppId, r.opp, r.pos], ['3/26', true, 112, 'Chicago Cubs', '2B/SS'])
  assert.deepEqual([r.result, r.runs, r.oppRuns], ['W', 14, 2])
  assert.deepEqual([r.ab, r.r, r.h, r.d2, r.d3, r.hr, r.rbi, r.bb, r.k, r.sb, r.avg], [4, 1, 2, 1, 0, 0, 1, 1, 1, 0, '.500'])
})

test('a game with no at-bat prints a dash for the average, not a number; a bare game has no position', () => {
  const [r] = batlogView([game('2026-09-19', 1, { atBats: 0, hits: 0, pos: [] })]).rows
  assert.deepEqual([r.avg, r.pos], ['—', '—'])
})

// Brice Turang 2026: three doubleheaders, game 2 above game 1; every game is a row, numbered from the first.
test('a doubleheader reads in game order, newest first, and the rows number from his first game', () => {
  const rows = batlogView([
    game('2026-04-04', 11, { n: 1 }), game('2026-04-04', 12, { n: 2 }), game('2026-04-03', 10), game('2026-04-05', 13),
  ]).rows
  assert.deepEqual(rows.map((r) => [r.gamePk, r.n]), [[13, 4], [12, 3], [11, 2], [10, 1]])
})

test('no game is no view', () => {
  assert.equal(batlogView([]), null)
  assert.equal(batlogView(null), null)
})

test('pitches seen, whiffs and fouls join on the gamePk; the rest are the other pitches', () => {
  const fouls = { 1: [22, 3, 4] }
  const rows = batlogView([game('2026-03-26', 1), game('2026-03-28', 2, { numberOfPitches: 18 })], { fouls }).rows
  assert.deepEqual([rows[1].seen, rows[1].whiffs, rows[1].fouls, rows[1].other], [22, 4, 3, 15])
  // A game the store does not have: seen from his own split, no bar.
  assert.deepEqual([rows[0].seen, rows[0].whiffs, rows[0].fouls, rows[0].other], [18, null, null, null])
})

// The one guard (ADR-0034): a game on today's date shows no score and no result.
test('a game today, and a game before it: both show their score and result once Final (ADR-0117)', async () => {
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
    const games = [game('2026-10-08', 1), game('2026-10-13', 2)]
    const scores = await fetchFinalScores(games, 'hitting', null)
    assert.deepEqual(asked, [1, 2])
    const [today, before] = batlogView(games, { scores }).rows
    assert.deepEqual([today.result, today.runs, today.oppRuns], ['W', 6, 2])
    assert.deepEqual([before.result, before.runs, before.oppRuns], ['W', 6, 2])
  } finally {
    m.mock.restore()
  }
})

test('a cutoff keeps the games before that day only', () => {
  const rows = batlogView([game('2026-05-01', 1), game('2026-05-11', 3)], { cutoff: '2026-05-11' }).rows
  assert.deepEqual(rows.map((r) => r.gamePk), [1])
})

test('the filter and the totals: games, AVG, OBP, SLG, HR, RBI over the rows it shows', () => {
  const { rows } = batlogView([
    game('2026-05-01', 1, { atBats: 4, hits: 2, doubles: 1, baseOnBalls: 1, hitByPitch: 1, sacFlies: 0, homeRuns: 1, rbi: 2 }),
    game('2026-05-06', 2, { atBats: 5, hits: 1, doubles: 0, baseOnBalls: 0, hitByPitch: 0, sacFlies: 1, homeRuns: 0, rbi: 0 }),
    game('2026-10-07', 3, { type: 'D', atBats: 3, hits: 0, doubles: 0, baseOnBalls: 0, hitByPitch: 0, sacFlies: 0, homeRuns: 0, rbi: 0 }),
  ])
  assert.deepEqual(scopeRows(rows, 'post').map((r) => r.gamePk), [3])
  assert.deepEqual(scopeRows(rows, 'reg').map((r) => r.gamePk), [2, 1])
  assert.equal(rows[0].series, 'NLDS')

  const reg = totalsOf(scopeRows(rows, 'reg'))
  // reg: AB 9, H 3, BB 1, HBP 1, SF 1 -> AVG .333, OBP 5/12 = .417; TB = 3 + 1 (2B) + 3 (HR) = 7 -> SLG .778
  assert.deepEqual(reg, { games: 2, avg: '.333', obp: '.417', slg: '.778', hr: 1, rbi: 2 })
  assert.deepEqual(totalsOf([]), { games: 0, avg: '—', obp: '—', slg: '—', hr: 0, rbi: 0 })
})

test('the loader: a log with no game, or a failed fetch, ends as no view', async () => {
  const m = mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => ({ stats: [{ splits: [] }] }) }))
  try {
    assert.equal(await loadBatlog(1, 2026, null), null)
    m.mock.mockImplementation(async () => {
      throw new Error('offline')
    })
    assert.equal(await loadBatlog(1, 2026, null), null)
  } finally {
    m.mock.restore()
  }
})
