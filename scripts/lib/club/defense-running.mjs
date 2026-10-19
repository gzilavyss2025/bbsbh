// The roll-ups behind public/data/club-defense-running.json (gen-club-defense-
// running.mjs). Pure, so test/club-defense-running.test.js can pin them with
// small fixtures. Rows come from Savant CSVs (string cells) and statsapi team
// stats; every blank cell reads as absent, never as 0.
import { num, round1 } from '../savant.mjs'

// Part over whole, in percent, one decimal. Null when the whole is empty.
export function pct(part, whole) {
  if (part == null || !whole) return null
  return round1((part / whole) * 100)
}

// Sum one column per club. A traded player is already one row PER CLUB in the
// per-club Savant fetches (his share with each), so he counts once in each;
// the same stint listed twice counts once. A club with no usable row is left
// out, so the caller reads null.
export function sumByClub(rows, key) {
  const seen = new Set()
  const out = {}
  for (const r of rows) {
    const id = `${r.playerId}:${r.teamId}`
    const v = num(r[key])
    if (seen.has(id) || v == null) continue
    seen.add(id)
    out[r.teamId] = (out[r.teamId] ?? 0) + v
  }
  return out
}

// Sprint speed (ft/s) per club: mean weighted by competitive runs. Savant lists
// a player once, under one club, so a traded player counts once; a repeat row
// is dropped (first wins). No speed or no runs: no weight.
export function sprintByClub(rows) {
  const seen = new Set()
  const acc = {}
  for (const r of rows) {
    if (seen.has(r.player_id)) continue
    seen.add(r.player_id)
    const speed = num(r.sprint_speed)
    const w = num(r.competitive_runs)
    if (speed == null || !w) continue
    const a = (acc[r.team_id] ??= { sum: 0, w: 0 })
    a.sum += speed * w
    a.w += w
  }
  return Object.fromEntries(Object.entries(acc).map(([id, a]) => [id, round1(a.sum / a.w)]))
}

// One row per club, six measures, null where a source gave the club nothing.
// `oaa` rows: Savant Fielding_Team. `framing` and `baserunning` rows carry the
// club they were fetched for as `teamId`. `stats`: statsapi team hitting.
export function buildClubs({ teamIds, oaa, framing, sprint, stats, baserunning }) {
  const oaaBy = Object.fromEntries(oaa.map((r) => [r.team_id, num(r.outs_above_average)]))
  const framingBy = sumByClub(framing, 'rv_tot')
  const sprintBy = sprintByClub(sprint)
  const safeBy = sumByClub(baserunning, 'n_safe')
  const oppBy = sumByClub(baserunning, 'n_opp_xb')
  const statsBy = Object.fromEntries(stats.map((s) => [s.teamId, s]))
  const clubs = {}
  for (const id of teamIds) {
    const s = statsBy[id]
    clubs[id] = {
      oaa: oaaBy[id] ?? null,
      framingRuns: id in framingBy ? round1(framingBy[id]) : null,
      sprintSpeed: sprintBy[id] ?? null,
      stolenBases: s?.stolenBases ?? null,
      stolenBaseSuccess: s ? pct(s.stolenBases, s.stolenBases + s.caughtStealing) : null,
      extraBasesTaken: pct(safeBy[id], oppBy[id]),
    }
  }
  return clubs
}
