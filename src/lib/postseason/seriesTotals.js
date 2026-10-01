// A series' team totals, summed over its COUNTED games' box scores
// (loadSeriesStats already fetches them, so this adds no request). Pure.
//
// Field paths: `teams.{away,home}.teamStats.batting` (runs, hits, homeRuns,
// baseOnBalls, strikeOuts, atBats) and `.pitching` (outs, earnedRuns,
// strikeOuts, baseOnBalls, hits, runs), checked against gamePk 849845 on
// 2026-10-01. A rate is recomputed from the sums, never averaged: AVG is
// hits / atBats, ERA is earnedRuns * 27 / outs.

import { outsToIp } from '../math/innings.js'

const EMPTY = () => ({
  batting: { atBats: 0, runs: 0, hits: 0, homeRuns: 0, baseOnBalls: 0, strikeOuts: 0 },
  pitching: { outs: 0, earnedRuns: 0, strikeOuts: 0, baseOnBalls: 0 },
})

const add = (into, from, keys) => {
  for (const k of keys) into[k] += Number(from?.[k]) || 0
}

// boxscores: raw /boxscore bodies, nulls allowed (a failed read is skipped).
// Returns { [teamId]: { batting, pitching, games } }.
export function foldTeamTotals(boxscores) {
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
  return [
    {
      group: 'Batting',
      rows: [
        row('R', 'Runs', a.batting.runs, b.batting.runs),
        row('H', 'Hits', a.batting.hits, b.batting.hits),
        row('HR', 'Home runs', a.batting.homeRuns, b.batting.homeRuns),
        row('BB', 'Walks', a.batting.baseOnBalls, b.batting.baseOnBalls),
        row('SO', 'Strikeouts', a.batting.strikeOuts, b.batting.strikeOuts, { lower: true }),
        row('AVG', 'Batting average', avgOf(a), avgOf(b), {
          display: (v) => (Number.isFinite(v) ? v.toFixed(3).replace(/^0\./, '.') : '—'),
        }),
      ],
    },
    {
      group: 'Pitching',
      rows: [
        row('IP', 'Innings pitched', a.pitching.outs, b.pitching.outs, { lead: false, display: (v) => outsToIp(v) }),
        row('ER', 'Earned runs', a.pitching.earnedRuns, b.pitching.earnedRuns, { lower: true }),
        row('SO', 'Strikeouts', a.pitching.strikeOuts, b.pitching.strikeOuts),
        row('BB', 'Walks', a.pitching.baseOnBalls, b.pitching.baseOnBalls, { lower: true }),
        row('ERA', 'Earned run average', eraOf(a), eraOf(b), {
          lower: true,
          display: (v) => (Number.isFinite(v) ? v.toFixed(2) : '—'),
        }),
      ],
    },
  ]
}
