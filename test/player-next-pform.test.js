import assert from 'node:assert/strict'
import test from 'node:test'
import { CHIPS, chartOf, cursorText, pformView, roleOf, stretchRows } from '../src/screens/player/next/modules/pform/pformView.js'

// The pitcher Form trend's pure view (#1930): pitcherRollingSeries' points plus the chips by role,
// the cursor line and the "How the stretches ended" rows. Samples are built, not live.

const app = (date, pk, { ip, er = 0, k = 0, bb = 0, h = 0, hr = 0, d = 0, bf, gs = 1, sv = 0, type = 'R' }) => ({
  date,
  gameType: type,
  isHome: false,
  opponent: { id: 112 },
  game: { gamePk: pk, gameNumber: 1 },
  stat: {
    summary: `${ip} IP, ${er} ER, ${k} K, ${bb} BB`,
    inningsPitched: ip, earnedRuns: er, strikeOuts: k, baseOnBalls: bb, hitByPitch: 0, hits: h, homeRuns: hr, doubles: d, triples: 0,
    battersFaced: bf, gamesPlayed: 1, gamesPitched: 1, gamesStarted: gs, saves: sv,
  },
})

// Five starts and one relief inning. Starts, window 2: ERA 3.27, 4.09, 7.00, 5.40.
const LOG = [
  app('2026-04-01', 1, { ip: '6.0', er: 0, k: 6, bb: 1, h: 2, bf: 24 }),
  app('2026-04-07', 2, { ip: '5.0', er: 4, k: 2, bb: 2, h: 6, hr: 1, d: 1, bf: 24 }),
  app('2026-04-13', 3, { ip: '6.0', er: 1, k: 8, bb: 0, h: 3, bf: 23 }),
  app('2026-04-19', 4, { ip: '3.0', er: 6, k: 1, bb: 3, h: 7, bf: 19 }),
  app('2026-04-25', 5, { ip: '7.0', er: 0, k: 9, bb: 1, h: 2, bf: 25 }),
  app('2026-04-26', 6, { ip: '1.0', k: 1, bf: 3, gs: 0 }),
]

test('the role picks the chips: starters count starts, relievers and closers count innings', () => {
  assert.equal(roleOf(LOG), 'SP')
  const pen = [1, 2, 3, 4].map((i) => app(`2026-05-0${i}`, 10 + i, { ip: '1.0', k: 1, bf: 4, gs: 0 }))
  assert.equal(roleOf(pen), 'RP')
  assert.equal(roleOf(pen.map((g) => ({ ...g, stat: { ...g.stat, saves: 8 } }))), 'RP') // a closer reads as a reliever
  // The role reads the log as the view does: before the as-of day, and from October rows when that is all there is.
  assert.equal(roleOf(LOG, '2026-04-07'), 'SP')
  assert.equal(roleOf([app('2026-10-02', 40, { ip: '1.0', bf: 3, gs: 0, type: 'D' })]), 'RP')
  assert.equal(roleOf([]), null)
  assert.equal(roleOf(undefined), null)
  assert.deepEqual(CHIPS.SP, { windows: [3, 5, 10], pick: 5, unit: 'starts' })
  assert.deepEqual(CHIPS.RP, { windows: [10, 15, 20], pick: 15, unit: 'IP' })
})

test('a starter view counts his starts only; too few starts, or an as-of day that cuts them, give no view', () => {
  const v = pformView(LOG, 'SP', 2)
  assert.equal(v.games.length, 5)
  assert.equal(v.points.length, 4)
  assert.deepEqual(v.points.map((p) => p.era), [3.27, 4.09, 7, 5.4])
  assert.equal(pformView(LOG, 'SP', 6), null)
  assert.equal(pformView([], 'SP', 2), null)
  assert.equal(pformView(undefined, 'SP', 2), null)
  // Starts before Apr 13 only: two starts, one point.
  assert.equal(pformView(LOG, 'SP', 2, '2026-04-13').points.length, 1)
  assert.equal(pformView(LOG, 'SP', 2, '2026-04-07'), null)
})

test('a reliever view windows by innings: the chip is IP, the window holds that many outs', () => {
  const pen = [1, 2, 3, 4, 5, 6].map((i) => app(`2026-05-0${i}`, 20 + i, { ip: '1.0', er: i === 3 ? 2 : 0, k: 1, bf: 4, gs: 0 }))
  const v = pformView(pen, 'RP', 3) // 3 IP = 9 outs = 3 outings
  assert.equal(v.points.length, 4)
  assert.deepEqual(v.points.map((p) => p.ip), ['3.0', '3.0', '3.0', '3.0'])
  assert.deepEqual(v.points.map((p) => p.era), [6, 6, 6, 0])
  assert.equal(pformView(pen, 'RP', 7), null) // only 6 IP
})

test('best and worst follow the metric: lowest ERA but highest K% is best; the season line is the regular season', () => {
  const v = pformView(LOG, 'SP', 2)
  const era = chartOf(v, 'era')
  assert.equal(era.better, 'down')
  assert.deepEqual([era.best, era.worst], [0, 2])
  assert.equal(era.points[2].v, 7)
  assert.equal(era.season.toFixed(2), '3.54') // 11 ER in 28 IP: the relief inning counts in his season
  const k = chartOf(v, 'kPct')
  assert.equal(k.better, 'up')
  assert.deepEqual([k.best, k.worst], [3, 0])
  assert.equal(k.format(21.43), '21.4%')
  // An October start moves the chart, not the season line.
  const oct = pformView([...LOG, app('2026-10-02', 7, { ip: '2.0', er: 6, bf: 12, type: 'D' })], 'SP', 2)
  assert.equal(oct.points.length, 5)
  assert.equal(chartOf(oct, 'era').season, era.season)
  // An October-only log has a series and no season line.
  const only = pformView([app('2026-10-02', 8, { ip: '5.0', bf: 20, type: 'F' }), app('2026-10-03', 9, { ip: '5.0', bf: 20, type: 'D' })], 'SP', 2)
  assert.equal(chartOf(only, 'era').season, null)
  assert.equal(cursorText(only, 0, 'era').line2, '')
})

test('the cursor text: the big figure, the game with its summary, the gap to the season', () => {
  const v = pformView(LOG, 'SP', 2)
  const t = cursorText(v, 2, 'era')
  assert.equal(t.big, '7.00')
  assert.equal(t.line1, 'Start 4 · Apr 19 · @ CHC · 3.0 IP, 6 ER, 1 K, 3 BB')
  assert.equal(t.line2, '+3.46 against his season ERA of 3.54')
  assert.match(cursorText(v, 3, 'era').line1, /^Latest · Start 5 · /)
  assert.match(cursorText(v, 0, 'era').line2, /^−0\.27 against/)
  const k = cursorText(v, 3, 'kPct')
  assert.equal(k.big, '22.7%')
  assert.match(k.line2, /^[+−]\d\.\d pts against his season K% of \d\d\.\d%$/)
})

test('the stretch rows: cursor, season, best, worst, each with IP, ERA, K%, BB% and an outcome bar', () => {
  const v = pformView(LOG, 'SP', 2)
  const rows = stretchRows(v, 3, 'era')
  assert.deepEqual(rows.map((r) => r.key), ['cursor', 'season', 'best', 'worst'])
  assert.deepEqual(rows.map((r) => r.at), [null, null, 0, 2])
  const best = rows[2]
  assert.equal(best.sub, '2 starts · Apr 1 to Apr 7')
  assert.equal(best.ip, '11.0')
  assert.equal(best.era, '3.27')
  assert.equal(best.k, '17%') // 8 of 48
  assert.equal(best.bb, '6%') // 3 of 48
  // Extra-base 2 (a double and a homer), singles 6 of the 8 hits, walks 3, outs 29, strikeouts 8: 48 batters.
  assert.deepEqual(best.segs.map((s) => s.n), [2, 6, 3, 29, 8])
  assert.equal(rows[1].sub, '6 games')
  assert.equal(rows[1].ip, '28.0')
  for (const r of rows) assert.equal(Number.parseInt(r.good, 10) + Number.parseInt(r.bad, 10), 100, r.key)
})

test('a reliever row counts the outings in its innings window', () => {
  const pen = [1, 2, 3, 4].map((i) => app(`2026-05-0${i}`, 30 + i, { ip: '2.0', k: 2, bf: 7, gs: 0 }))
  const v = pformView(pen, 'RP', 4) // 12 outs = 2 outings
  assert.equal(stretchRows(v, 0, 'era')[0].sub, '2 games · May 1 to May 2')
  // One long outing fills the window alone, and the walk column leaves hit batters out.
  const one = pformView([app('2026-05-01', 41, { ip: '4.0', bf: 15, bb: 1, gs: 0 })], 'RP', 4)
  assert.equal(stretchRows(one, 0, 'era')[0].sub, '1 game · May 1 to May 1')
  assert.equal(stretchRows(one, 0, 'era')[0].bb, '7%')
})
