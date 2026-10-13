import assert from 'node:assert/strict'
import test from 'node:test'
import { cursorText, formView, stretchRows } from '../src/screens/player/next/modules/form/formView.js'

// The batter Form trend's pure view (#1889): rollingSeries' points plus the cursor line and
// the "How the stretches ended" rows. The board's numbers are samples; these are built.

const game = (date, pk, { ab = 4, h = 0, d = 0, t = 0, hr = 0, bb = 0, so = 0, type = 'R' } = {}) => ({
  date,
  gameType: type,
  isHome: false,
  opponent: { id: 112 },
  game: { gamePk: pk, gameNumber: 1 },
  stat: {
    gamesPlayed: 1, atBats: ab, hits: h, doubles: d, triples: t, homeRuns: hr, baseOnBalls: bb, hitByPitch: 0,
    sacFlies: 0, strikeOuts: so, plateAppearances: ab + bb, totalBases: h + d + 2 * t + 3 * hr, rbi: 0, runs: 0, stolenBases: 0,
  },
})

// 8 games, window 2: cold start, a hot middle (games 4-5), a cold tail.
const LOG = [
  game('2026-04-01', 1, { so: 2 }),
  game('2026-04-02', 2, { h: 1, so: 1 }),
  game('2026-04-03', 3, { h: 1, bb: 1 }),
  game('2026-04-04', 4, { h: 3, hr: 1, bb: 1 }),
  game('2026-04-05', 5, { h: 2, d: 1, hr: 1 }),
  game('2026-04-06', 6, { h: 1, so: 2 }),
  game('2026-04-07', 7, { so: 3 }),
  game('2026-04-08', 8, { so: 4 }),
]

test('a log shorter than the window has no view, and the as-of day is cut off', () => {
  assert.equal(formView(LOG.slice(0, 1), 2), null)
  assert.equal(formView([], 2), null)
  assert.equal(formView(undefined, 2), null)
  // Games before the day only: 04-01 to 04-03 is three games, two points.
  assert.equal(formView(LOG, 2, '2026-04-04').points.length, 2)
  assert.equal(formView(LOG, 2, '2026-04-02'), null)
})

test('the points carry the chart value and mark a game with a home run', () => {
  const v = formView(LOG, 2)
  assert.equal(v.points.length, 7)
  assert.deepEqual(v.points.map((p) => p.mark), [false, false, true, true, false, false, false])
  assert.equal(v.points[3].v, v.points[3].ops)
})

test('best and worst are the indexes of the best and worst stretch', () => {
  const v = formView(LOG, 2)
  assert.equal(v.best, 3) // games 4-5
  assert.equal(v.worst, 6) // games 7-8
  assert.equal(v.points[v.best].v, Math.max(...v.points.map((p) => p.v)))
  assert.equal(v.points[v.worst].v, Math.min(...v.points.map((p) => p.v)))
})

test('the season line is the regular season only; an October game moves the chart, not the line', () => {
  const plain = formView(LOG, 2)
  const withOct = formView([...LOG, game('2026-10-02', 99, { h: 4, hr: 2, type: 'F' })], 2)
  assert.equal(withOct.seasonOps, plain.seasonOps)
  assert.equal(withOct.points.length, 8)
  // An October-only log has a series and no season line.
  const oct = formView([game('2026-10-02', 90, { h: 1, type: 'F' }), game('2026-10-03', 91, { h: 2, type: 'D' })], 2)
  assert.equal(oct.seasonOps, null)
  assert.equal(cursorText(oct, 0).line2, '')
  assert.deepEqual(stretchRows(oct, 0).map((r) => r.key), ['cursor', 'best', 'worst'])
})

test('the cursor text: the big figure, the game, and the gap to the season line', () => {
  const v = formView(LOG, 2)
  const t = cursorText(v, 3)
  assert.equal(t.big, '2.167')
  assert.equal(t.line1, 'Game 5 · Apr 5 · @ CHC · 2-for-4, HR')
  assert.match(t.line2, /^\+1\.404 against his season OPS of \.763$/)
  // Below the line the sign is a true minus; the last game says so.
  const last = cursorText(v, 6)
  assert.match(last.line1, /^Latest · Game 8 · Apr 8 · @ CHC · 0-for-4, 4 K$/)
  assert.match(last.line2, /^−\.763 against/)
  assert.equal(cursorText(v, 2).line1, 'Game 4 · Apr 4 · @ CHC · 3-for-4, HR, 1 BB')
})

test('the stretch rows: cursor, season, best, worst, each with its plate appearances and outcome bar', () => {
  const v = formView(LOG, 2)
  const rows = stretchRows(v, 6)
  assert.deepEqual(rows.map((r) => r.key), ['cursor', 'season', 'best', 'worst'])
  assert.deepEqual(rows.map((r) => r.at), [null, null, 3, 6])
  const best = rows[2]
  assert.equal(best.sub, '2 games · Apr 4 to Apr 5')
  assert.equal(best.pa, 9) // 5 PA + 4 PA
  assert.equal(best.ops, '2.167')
  // Extra-base 3 (2 HR, 1 2B) of 5 hits, so 2 singles; 1 walk; 3 outs; no strikeouts.
  assert.deepEqual(best.segs.map((s) => s.n), [3, 2, 1, 3, 0])
  assert.equal(best.segs.reduce((t, s) => t + s.n, 0), best.pa)
  assert.equal(best.k, '0%')
  assert.equal(best.bb, '11%')
  assert.equal(rows[1].sub, '8 games')
  assert.equal(rows[1].pa, 34)
})

test('every row splits its plate appearances into outcomes that add up, on-base and outs share 100', () => {
  const v = formView(LOG, 2)
  for (const r of stretchRows(v, 6)) {
    assert.equal(r.segs.reduce((t, s) => t + s.n, 0), r.pa, r.key)
    assert.equal(Number.parseInt(r.good, 10) + Number.parseInt(r.bad, 10), 100, r.key)
  }
})
