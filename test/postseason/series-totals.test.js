import assert from 'node:assert/strict'
import test from 'node:test'
import { foldTeamTotals, totalsRows } from '../../src/lib/postseason/seriesTotals.js'

// teamStats as the real boxscore carries them (checked against gamePk 849845).
const side = (id, bat, pit) => ({ team: { id }, teamStats: { batting: bat, pitching: pit } })
const box = (away, home) => ({ teams: { away, home } })

const g1 = box(
  side(143, { runs: 3, hits: 6, homeRuns: 0, baseOnBalls: 1, strikeOuts: 10, atBats: 31 }, { outs: 24, earnedRuns: 5, strikeOuts: 9, baseOnBalls: 1 }),
  side(144, { runs: 5, hits: 7, homeRuns: 1, baseOnBalls: 1, strikeOuts: 9, atBats: 30 }, { outs: 27, earnedRuns: 3, strikeOuts: 10, baseOnBalls: 1 }),
)
const g2 = box(
  side(144, { runs: 2, hits: 5, homeRuns: 0, baseOnBalls: 2, strikeOuts: 8, atBats: 30 }, { outs: 27, earnedRuns: 4, strikeOuts: 7, baseOnBalls: 3 }),
  side(143, { runs: 4, hits: 8, homeRuns: 2, baseOnBalls: 0, strikeOuts: 6, atBats: 32 }, { outs: 27, earnedRuns: 2, strikeOuts: 8, baseOnBalls: 2 }),
)

test('totals add across games for each club, whichever side it was on', () => {
  const t = foldTeamTotals([g1, g2, null])
  assert.equal(t[143].games, 2)
  assert.equal(t[143].batting.runs, 7)
  assert.equal(t[143].batting.homeRuns, 2)
  assert.equal(t[143].pitching.outs, 51)
  assert.equal(t[144].batting.runs, 7)
  assert.equal(t[144].pitching.earnedRuns, 7)
})

test('rates come from the sums, not an average of games', () => {
  const t = foldTeamTotals([g1, g2])
  const rows = totalsRows(t, 143, 144)
  const byCode = Object.fromEntries(rows.flatMap((g) => g.rows).map((r) => [`${r.code}`, r]))
  // 143: 14 hits / 63 AB = .222 ; 144: 12 / 60 = .200
  assert.equal(byCode.AVG.a, '.222')
  assert.equal(byCode.AVG.b, '.200')
  assert.equal(byCode.AVG.better, 'a')
  // 143: 7 ER over 51 outs = 3.71 ERA ; 144: 7 over 54 = 3.50
  assert.equal(byCode.ERA.a, '3.71')
  assert.equal(byCode.ERA.b, '3.50')
  assert.equal(byCode.ERA.better, 'b')
})

test('innings print as thirds and never lead', () => {
  const rows = totalsRows(foldTeamTotals([g1, g2]), 143, 144)
  const ip = rows.flatMap((g) => g.rows).find((r) => r.code === 'IP')
  assert.equal(ip.a, '17.0')
  assert.equal(ip.b, '18.0')
  assert.equal(ip.better, null)
})

test('lower is better for walks allowed, earned runs and batter strikeouts; a tie leads nowhere', () => {
  const rows = totalsRows(foldTeamTotals([g1, g2]), 143, 144)
  const at = (group, code) => rows.find((g) => g.group === group).rows.find((r) => r.code === code)
  // Batting strikeouts: 143 struck out 16 times, 144 17, so 143 leads.
  assert.equal(at('Batting', 'SO').better, 'a')
  // Walks allowed: 143 gave up 3, 144 gave up 4 (1 + 3), so 143 leads.
  assert.equal(at('Pitching', 'BB').better, 'a')
  // Earned runs 7 to 7 and pitching strikeouts 17 to 17 are ties.
  assert.equal(at('Pitching', 'ER').better, null)
  assert.equal(at('Pitching', 'SO').better, null)
})

test('a missing club gives no rows', () => {
  assert.deepEqual(totalsRows(foldTeamTotals([g1]), 143, 999), [])
})
