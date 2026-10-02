// A series' team totals, summed over its COUNTED games' box scores
// (loadSeriesStats already fetches them). Pure.
//
// Field paths: `teams.{away,home}.teamStats.batting` (runs, hits, doubles,
// triples, homeRuns, baseOnBalls, strikeOuts, atBats, leftOnBase, stolenBases,
// caughtStealing) and `.pitching` (outs, earnedRuns, strikeOuts, baseOnBalls,
// hits, numberOfPitches, strikes), checked against gamePk 849845 on
// 2026-10-01. A rate is recomputed from the sums, never averaged: AVG is
// hits / atBats, ERA is earnedRuns * 27 / outs, WHIP is (walks + hits) * 3 /
// outs, K/9 and BB/9 are per 27 outs, strike % is strikes / pitches.
//
// Whiffs are not in a box score. The caller counts them from the games' pitch
// feeds (api/postseasonSeries.js `foldWhiffs`) and passes `{ [clubId]: n }`;
// a club with no count shows "—" rather than a false zero.

import { outsToIp } from '../math/innings.js'

const EMPTY = () => ({
  batting: {
    atBats: 0, runs: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0, baseOnBalls: 0, strikeOuts: 0,
    leftOnBase: 0, stolenBases: 0, caughtStealing: 0,
  },
  pitching: { outs: 0, earnedRuns: 0, strikeOuts: 0, baseOnBalls: 0, hits: 0, numberOfPitches: 0, strikes: 0 },
})

const add = (into, from, keys) => {
  for (const k of keys) into[k] += Number(from?.[k]) || 0
}

// boxscores: raw /boxscore bodies, nulls allowed (a failed read is skipped).
// whiffs: { [teamId]: n } swings-and-misses by that club's pitchers, or null.
// Returns { [teamId]: { batting, pitching, games, whiffs } }.
export function foldTeamTotals(boxscores, whiffs = null) {
  const out = {}
  for (const box of boxscores ?? []) {
    if (!box) continue
    for (const side of ['away', 'home']) {
      const team = box.teams?.[side]
      const id = team?.team?.id
      if (!id || !team.teamStats) continue
      const t = (out[id] ??= { ...EMPTY(), games: 0 })
      add(t.batting, team.teamStats.batting, Object.keys(t.batting))
      add(t.pitching, team.teamStats.pitching, Object.keys(t.pitching))
      t.games += 1
    }
  }
  for (const [id, t] of Object.entries(out)) t.whiffs = whiffs?.[id] ?? null
  return out
}

// The two-club table, one row per stat code. `better` is which club's value
// leads ('a', 'b' or null on a tie or a missing value), with lower-is-better
// for pitching walks, earned runs, ERA and a hitter's strikeouts. Innings
// pitched leads nowhere: more innings is not better, only longer.
export function totalsRows(totals, aId, bId) {
  const a = totals?.[aId]
  const b = totals?.[bId]
  if (!a || !b) return []
  const row = (code, label, av, bv, { lower = false, lead = true, display = (v) => String(v) } = {}) => {
    const an = Number(av)
    const bn = Number(bv)
    let better = null
    if (lead && Number.isFinite(an) && Number.isFinite(bn) && an !== bn) better = (an < bn) === lower ? 'a' : 'b'
    return { code, label, a: display(av), b: display(bv), better }
  }
  const avgOf = (t) => (t.batting.atBats > 0 ? t.batting.hits / t.batting.atBats : NaN)
  const eraOf = (t) => (t.pitching.outs > 0 ? (t.pitching.earnedRuns * 27) / t.pitching.outs : NaN)
  const per = (t, n, k) => (t.pitching.outs > 0 ? (n * k) / t.pitching.outs : NaN)
  const whipOf = (t) => per(t, t.pitching.baseOnBalls + t.pitching.hits, 3)
  const strikePctOf = (t) => (t.pitching.numberOfPitches > 0 ? t.pitching.strikes / t.pitching.numberOfPitches : NaN)
  const xbhOf = (t) => t.batting.doubles + t.batting.triples + t.batting.homeRuns
  const fixed = (d) => (v) => (Number.isFinite(v) ? v.toFixed(d) : '—')
  const rate3 = (v) => (Number.isFinite(v) ? v.toFixed(3).replace(/^0\./, '.') : '—')
  const pct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—')
  // Stolen bases lead; the caught-stealing count rides in brackets.
  const sb = row('SB (CS)', 'Stolen bases (caught stealing)', a.batting.stolenBases, b.batting.stolenBases)
  sb.a = `${a.batting.stolenBases} (${a.batting.caughtStealing})`
  sb.b = `${b.batting.stolenBases} (${b.batting.caughtStealing})`
  const num = (v) => v ?? NaN
  return [
    {
      group: 'Batting',
      rows: [
        row('R', 'Runs', a.batting.runs, b.batting.runs),
        row('H', 'Hits', a.batting.hits, b.batting.hits),
        row('XBH', 'Extra-base hits', xbhOf(a), xbhOf(b)),
        row('HR', 'Home runs', a.batting.homeRuns, b.batting.homeRuns),
        row('BB', 'Walks', a.batting.baseOnBalls, b.batting.baseOnBalls),
        row('SO', 'Strikeouts', a.batting.strikeOuts, b.batting.strikeOuts, { lower: true }),
        row('LOB', 'Runners left on base', a.batting.leftOnBase, b.batting.leftOnBase, { lower: true }),
        sb,
        row('AVG', 'Batting average', avgOf(a), avgOf(b), { display: rate3 }),
      ],
    },
    {
      group: 'Pitching',
      rows: [
        row('IP', 'Innings pitched', a.pitching.outs, b.pitching.outs, { lead: false, display: (v) => outsToIp(v) }),
        row('ER', 'Earned runs', a.pitching.earnedRuns, b.pitching.earnedRuns, { lower: true }),
        row('ERA', 'Earned run average', eraOf(a), eraOf(b), { lower: true, display: fixed(2) }),
        row('WHIP', 'Walks plus hits per inning pitched', whipOf(a), whipOf(b), { lower: true, display: fixed(2) }),
        row('SO', 'Strikeouts', a.pitching.strikeOuts, b.pitching.strikeOuts),
        row('K/9', 'Strikeouts per nine innings', per(a, a.pitching.strikeOuts, 27), per(b, b.pitching.strikeOuts, 27), {
          display: fixed(1),
        }),
        row('BB', 'Walks', a.pitching.baseOnBalls, b.pitching.baseOnBalls, { lower: true }),
        row('BB/9', 'Walks per nine innings', per(a, a.pitching.baseOnBalls, 27), per(b, b.pitching.baseOnBalls, 27), {
          lower: true,
          display: fixed(1),
        }),
        row('P', 'Pitches thrown', a.pitching.numberOfPitches, b.pitching.numberOfPitches, { lead: false }),
        row('STR%', 'Strike percentage', strikePctOf(a), strikePctOf(b), { display: pct }),
        row('Whiffs', 'Swings and misses', num(a.whiffs), num(b.whiffs), { display: (v) => (Number.isFinite(v) ? String(v) : '—') }),
      ],
    },
  ]
}
