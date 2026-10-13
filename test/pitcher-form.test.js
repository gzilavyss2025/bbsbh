import assert from 'node:assert/strict'
import test from 'node:test'
import { pitcherRollingSeries } from '../src/api/player/pitcherForm.js'

// The pitcher Form trend's series (#1930). Fixtures are the 2026 game logs of
// Robert Gasser (starter) and Aaron Ashby (reliever), regular season and
// October, one row per appearance: [date, gamePk, IP, ER, K, BB, BF, GS, game#, type].
// Fetched live 2026-10-13 from statsapi gameLog, group pitching.

const row = ([date, gamePk, ip, er, k, bb, bf, gs, gameNumber, gameType]) => ({
  date,
  gameType,
  isHome: true,
  opponent: { id: 142 },
  game: { gamePk, gameNumber },
  stat: {
    summary: [`${ip} IP`, er && `${er} ER`, k && `${k} K`, bb && `${bb} BB`].filter(Boolean).join(', '),
    inningsPitched: ip, era: '1.29', earnedRuns: er, strikeOuts: k, baseOnBalls: bb, battersFaced: bf,
    gamesPlayed: 1, gamesStarted: gs,
  },
})

const GASSER = [
  ["2026-05-17", 823708, "4.0", 2, 3, 2, 20, 1, 1, "R"],
  ["2026-05-23", 823787, "4.1", 4, 4, 4, 21, 1, 1, "R"],
  ["2026-06-03", 823780, "5.0", 1, 5, 1, 21, 1, 1, "R"],
  ["2026-06-09", 824999, "5.0", 6, 7, 2, 25, 1, 1, "R"],
  ["2026-06-16", 823775, "5.2", 0, 5, 2, 20, 1, 1, "R"],
  ["2026-06-21", 824908, "6.0", 2, 7, 1, 23, 1, 1, "R"],
  ["2026-06-29", 823771, "5.2", 3, 5, 1, 24, 1, 1, "R"],
  ["2026-07-07", 823035, "7.2", 2, 4, 1, 29, 1, 2, "R"],
  ["2026-07-12", 823358, "3.0", 7, 3, 0, 18, 1, 1, "R"],
  ["2026-07-19", 823764, "5.0", 1, 5, 0, 18, 1, 1, "R"],
  ["2026-07-25", 823758, "6.0", 2, 4, 0, 23, 1, 1, "R"],
  ["2026-08-01", 824000, "5.0", 1, 6, 2, 21, 1, 1, "R"],
  ["2026-08-08", 823752, "4.2", 3, 3, 2, 23, 1, 1, "R"],
  ["2026-08-14", 823913, "6.1", 3, 7, 1, 28, 1, 1, "R"],
  ["2026-08-20", 823747, "3.2", 4, 4, 4, 20, 1, 1, "R"],
  ["2026-08-26", 823584, "5.1", 1, 6, 2, 24, 0, 1, "R"],
  ["2026-09-01", 824633, "4.1", 2, 4, 2, 19, 1, 1, "R"],
  ["2026-09-07", 823742, "4.2", 1, 5, 2, 20, 1, 1, "R"],
  ["2026-09-13", 823734, "5.0", 1, 5, 2, 20, 1, 1, "R"],
  ["2026-09-19", 824788, "7.0", 0, 2, 3, 26, 1, 1, "R"],
  ["2026-09-25", 823735, "6.0", 1, 9, 1, 20, 1, 1, "R"],
  ["2026-10-07", 849827, "4.0", 1, 3, 1, 17, 1, 1, "D"],]

const ASHBY = [
  ["2026-03-26", 823812, "1.0", 0, 2, 0, 3, 0, 1, "R"],
  ["2026-03-28", 823811, "1.2", 0, 4, 2, 7, 0, 1, "R"],
  ["2026-03-30", 823809, "2.0", 1, 3, 0, 7, 0, 1, "R"],
  ["2026-04-01", 823806, "1.0", 0, 0, 1, 3, 0, 1, "R"],
  ["2026-04-04", 824132, "1.2", 2, 3, 1, 10, 0, 1, "R"],
  ["2026-04-06", 824783, "1.1", 0, 0, 1, 6, 0, 1, "R"],
  ["2026-04-08", 824779, "1.0", 0, 2, 0, 3, 0, 1, "R"],
  ["2026-04-10", 823808, "2.1", 2, 4, 0, 10, 1, 1, "R"],
  ["2026-04-12", 823804, "0.2", 0, 1, 0, 3, 0, 1, "R"],
  ["2026-04-15", 823803, "1.0", 0, 3, 1, 5, 0, 1, "R"],
  ["2026-04-16", 823801, "0.1", 0, 0, 0, 2, 0, 1, "R"],
  ["2026-04-21", 824290, "1.0", 0, 2, 2, 5, 0, 1, "R"],
  ["2026-04-23", 824288, "0.1", 0, 0, 1, 3, 0, 1, "R"],
  ["2026-04-25", 823799, "2.0", 0, 4, 0, 7, 0, 1, "R"],
  ["2026-04-26", 823797, "1.0", 0, 2, 2, 6, 0, 1, "R"],
  ["2026-05-01", 822744, "2.2", 1, 4, 2, 12, 0, 1, "R"],
  ["2026-05-06", 823063, "2.0", 0, 1, 1, 7, 0, 1, "R"],
  ["2026-05-09", 823792, "2.0", 0, 3, 1, 7, 0, 1, "R"],
  ["2026-05-10", 823793, "1.0", 0, 3, 0, 4, 0, 1, "R"],
  ["2026-05-13", 823791, "1.0", 0, 2, 0, 3, 0, 1, "R"],
  ["2026-05-15", 823707, "2.0", 1, 1, 0, 8, 0, 1, "R"],
  ["2026-05-19", 824677, "0.2", 1, 2, 1, 7, 0, 1, "R"],
  ["2026-05-22", 823788, "1.1", 0, 0, 1, 6, 0, 1, "R"],
  ["2026-05-25", 823784, "2.0", 0, 1, 0, 6, 0, 1, "R"],
  ["2026-05-27", 823783, "2.0", 0, 2, 1, 7, 0, 1, "R"],
  ["2026-05-29", 824191, "1.0", 0, 2, 0, 4, 0, 1, "R"],
  ["2026-06-02", 823782, "1.1", 1, 1, 0, 7, 0, 1, "R"],
  ["2026-06-05", 824350, "1.0", 1, 1, 1, 5, 0, 1, "R"],
  ["2026-06-08", 824998, "1.2", 3, 3, 0, 9, 0, 1, "R"],
  ["2026-06-10", 824996, "1.0", 0, 0, 1, 5, 0, 1, "R"],
  ["2026-06-14", 823777, "2.0", 0, 3, 0, 7, 0, 1, "R"],
  ["2026-06-16", 823775, "1.0", 1, 2, 2, 6, 0, 1, "R"],
  ["2026-06-17", 823774, "1.0", 0, 0, 0, 3, 0, 1, "R"],
  ["2026-06-20", 824909, "0.1", 2, 1, 0, 3, 0, 1, "R"],
  ["2026-06-22", 824502, "1.0", 0, 2, 0, 3, 0, 1, "R"],
  ["2026-06-23", 824501, "1.0", 0, 2, 0, 3, 0, 1, "R"],
  ["2026-06-26", 823773, "1.0", 1, 0, 2, 5, 0, 1, "R"],
  ["2026-06-28", 823769, "0.2", 1, 1, 2, 5, 0, 1, "R"],
  ["2026-06-29", 823771, "1.0", 0, 1, 0, 4, 0, 1, "R"],
  ["2026-07-01", 823767, "1.1", 0, 2, 0, 5, 0, 1, "R"],
  ["2026-07-03", 825062, "1.0", 0, 0, 1, 4, 0, 1, "R"],
  ["2026-07-05", 825061, "0.1", 1, 0, 1, 4, 0, 1, "R"],
  ["2026-07-07", 823062, "1.0", 0, 1, 0, 5, 0, 1, "R"],
  ["2026-07-09", 823034, "1.0", 0, 1, 1, 5, 0, 1, "R"],
  ["2026-07-11", 823357, "1.0", 3, 3, 0, 6, 0, 1, "R"],
  ["2026-07-17", 823766, "1.0", 0, 2, 0, 4, 0, 1, "R"],
  ["2026-07-19", 823764, "1.0", 0, 1, 0, 5, 0, 1, "R"],
  ["2026-07-22", 823761, "2.0", 0, 4, 1, 7, 0, 1, "R"],
  ["2026-07-26", 823755, "0.1", 0, 0, 0, 1, 0, 1, "R"],
  ["2026-07-28", 823193, "0.1", 0, 0, 0, 1, 0, 1, "R"],
  ["2026-07-29", 823192, "0.1", 4, 1, 1, 6, 0, 1, "R"],
  ["2026-08-03", 823757, "2.0", 0, 3, 1, 8, 0, 1, "R"],
  ["2026-08-06", 823754, "1.0", 0, 3, 0, 4, 0, 1, "R"],
  ["2026-08-08", 823752, "1.0", 0, 2, 0, 3, 0, 1, "R"],
  ["2026-08-09", 823751, "1.0", 0, 3, 1, 6, 0, 1, "R"],
  ["2026-08-12", 823263, "0.2", 0, 1, 0, 4, 0, 1, "R"],
  ["2026-08-15", 823914, "2.0", 0, 2, 1, 8, 0, 1, "R"],
  ["2026-08-16", 823912, "0.2", 0, 0, 0, 1, 0, 1, "R"],
  ["2026-08-20", 823747, "2.0", 0, 4, 2, 8, 0, 1, "R"],
  ["2026-08-22", 823743, "1.0", 0, 0, 0, 4, 0, 1, "R"],
  ["2026-08-23", 823745, "1.0", 1, 1, 0, 4, 0, 1, "R"],
  ["2026-08-25", 823585, "1.0", 0, 0, 0, 3, 0, 1, "R"],
  ["2026-08-28", 823744, "1.0", 0, 2, 1, 5, 0, 1, "R"],
  ["2026-09-01", 824633, "1.0", 0, 1, 0, 3, 0, 1, "R"],
  ["2026-09-02", 824634, "1.0", 0, 0, 0, 3, 0, 1, "R"],
  ["2026-09-04", 824471, "1.0", 0, 2, 1, 4, 0, 1, "R"],
  ["2026-09-05", 824468, "1.0", 1, 2, 0, 5, 0, 1, "R"],
  ["2026-09-07", 823742, "1.0", 1, 0, 1, 6, 0, 1, "R"],
  ["2026-09-08", 823738, "0.1", 0, 0, 0, 1, 0, 1, "R"],
  ["2026-09-12", 823737, "1.0", 0, 0, 0, 4, 0, 1, "R"],
  ["2026-09-15", 823333, "2.0", 0, 2, 1, 8, 0, 1, "R"],
  ["2026-09-17", 823334, "1.0", 2, 0, 1, 6, 0, 1, "R"],
  ["2026-09-19", 824788, "1.0", 0, 1, 0, 3, 0, 1, "R"],
  ["2026-09-24", 823411, "2.0", 0, 2, 0, 7, 0, 1, "R"],
  ["2026-09-26", 823733, "2.0", 0, 2, 0, 6, 0, 1, "R"],
  ["2026-10-03", 849830, "1.2", 0, 1, 0, 5, 0, 1, "D"],
  ["2026-10-04", 849825, "1.0", 0, 1, 0, 4, 0, 1, "D"],
  ["2026-10-07", 849827, "3.0", 0, 3, 2, 10, 0, 1, "D"],
  ["2026-10-11", 849809, "2.0", 0, 1, 1, 7, 0, 1, "L"],
  ["2026-10-12", 849812, "1.2", 0, 2, 0, 5, 0, 1, "L"],]

const gasser = GASSER.map(row)
const ashby = ASHBY.map(row)
const eras = (s) => s.points.map((p) => p.era)

test('Gasser, 5 starts: best 1.35 (Sep 7 to Oct 7), worst 5.32 (Jul 12 to Aug 8), season 3.87', () => {
  const s = pitcherRollingSeries(gasser, { by: 'apps', w: 5 })
  assert.equal(s.points.length, gasser.length - 4)
  assert.equal(s.best.era, 1.35)
  assert.deepEqual([s.best.startDate, s.best.endDate], ['2026-09-07', '2026-10-07'])
  assert.equal(s.worst.era, 5.32)
  assert.deepEqual([s.worst.startDate, s.worst.endDate], ['2026-07-12', '2026-08-08'])
  assert.equal(s.season.era, 3.87)
})

test('Ashby, 15 IP: ERA runs 0.55 to 6.00 and no window is 0.00', () => {
  const s = pitcherRollingSeries(ashby, { by: 'outs', w: 45 })
  assert.equal(s.best.era, 0.55)
  assert.equal(s.worst.era, 6)
  assert.ok(eras(s).every((e) => e > 0))
})

test('a point carries the chart fields; the summary is the game line of the window\'s last game', () => {
  const [first] = pitcherRollingSeries(gasser, { by: 'apps', w: 3 }).points
  assert.deepEqual(Object.keys(first), ['date', 'gamePk', 'opp', 'isHome', 'summary', 'era', 'kPct', 'bbPct', 'ip'])
  assert.equal(first.gamePk, gasser[2].game.gamePk)
  assert.equal(first.summary, gasser[2].stat.summary)
  assert.equal(first.opp, 'MIN')
  assert.equal(first.ip, '13.1') // 4.0 + 4.1 + 5.0
})

test("the game line prints a count of one: the feed's own summary leaves the number out", () => {
  // Gasser 2026-09-25, as the feed writes it: "6.0 IP, ER, 9 K, BB" with 1 ER and 1 BB. A zero reads "0 ER".
  const feed = row(['2026-09-25', 9, '6.0', 1, 9, 1, 24, 1, 1, 'R'])
  feed.stat.summary = '6.0 IP, ER, 9 K, BB'
  const zero = row(['2026-09-30', 10, '7.0', 0, 8, 0, 25, 1, 1, 'R'])
  zero.stat.summary = '7.0 IP, 0 ER, 8 K, 0 BB'
  const [a, b] = pitcherRollingSeries([feed, zero], { by: 'apps', w: 1 }).points
  assert.equal(a.summary, '6.0 IP, 1 ER, 9 K, 1 BB')
  assert.equal(b.summary, '7.0 IP, 0 ER, 8 K, 0 BB')
})

test('K% and BB% are shares of batters faced over the window', () => {
  const [p] = pitcherRollingSeries([row(['2026-04-01', 1, '6.0', 2, 6, 2, 25, 1, 1, 'R']), row(['2026-04-07', 2, '5.0', 1, 4, 1, 20, 1, 1, 'R'])], { by: 'apps', w: 2 }).points
  assert.equal(p.kPct, (10 / 45) * 100)
  assert.equal(p.bbPct, (3 / 45) * 100)
})

test('a window by outs holds the trailing appearances until it reaches w outs', () => {
  const log = [['2026-04-01', 1, '1.0'], ['2026-04-02', 2, '2.0'], ['2026-04-03', 3, '1.0'], ['2026-04-04', 4, '3.0']].map(([d, pk, ip]) =>
    row([d, pk, ip, 1, 0, 0, 5, 0, 1, 'R']))
  const s = pitcherRollingSeries(log, { by: 'outs', w: 9 })
  // 9 outs is 3 IP: game 1 (1.0 IP) is short, games 1-2 are the first full window
  assert.deepEqual(s.points.map((p) => [p.gamePk, p.ip]), [[2, '3.0'], [3, '3.0'], [4, '3.0']])
})

test('order is date, then game number, then gamePk; a short log has no series', () => {
  const a = row(['2026-04-01', 9, '1.0', 0, 0, 0, 3, 0, 2, 'R'])
  const b = row(['2026-04-01', 8, '1.0', 0, 0, 0, 3, 0, 1, 'R'])
  assert.deepEqual(pitcherRollingSeries([a, b], { by: 'apps', w: 1 }).points.map((p) => p.gamePk), [8, 9])
  assert.equal(pitcherRollingSeries([a, b], { by: 'apps', w: 3 }), null)
  assert.equal(pitcherRollingSeries(null, { by: 'apps', w: 3 }), null)
})

test('an October-only log has a series and no season line', () => {
  const post = gasser.filter((g) => g.gameType !== 'R')
  const s = pitcherRollingSeries([...post, ...post.map((g) => ({ ...g, game: { ...g.game, gamePk: g.game.gamePk + 1 } }))], { by: 'apps', w: 2 })
  assert.equal(s.season, null)
})

test('a one-game window reports that game\'s ERA, not the cumulative season ERA on the split', () => {
  const [p] = pitcherRollingSeries([row(['2026-04-01', 1, '6.0', 3, 6, 2, 25, 1, 1, 'R'])], { by: 'apps', w: 1 }).points
  assert.equal(p.era, 4.5)
  assert.equal(p.kPct, 24)
})

test('an appearance with an out and no batter faced (a pickoff, 0.1 IP) still counts', () => {
  const log = [row(['2026-04-01', 1, '2.2', 1, 2, 0, 9, 0, 1, 'R']), row(['2026-04-02', 2, '0.1', 0, 0, 0, 0, 0, 1, 'R'])]
  const s = pitcherRollingSeries(log, { by: 'apps', w: 2 })
  assert.equal(s.points[0].ip, '3.0')
  assert.equal(s.points[0].era, 3)
  assert.equal(s.season.ip, '3.0')
})
