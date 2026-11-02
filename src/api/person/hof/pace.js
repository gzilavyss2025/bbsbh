// Hall of Fame pace — the nearest Hall of Famers to a player at the same AGE
// (MLB's June 30 rule), by one headline stat. Pure: the caller hands in
// public/data/hof-pace.json's players and the player's MLB yearByYear splits.
// Open surface (ADR-0034); .scratch/hof-pace/spec.md, #1857.

import { ipToOuts } from '../../../lib/math/innings.js'
import { num } from '../shared.js'
import { aggregateSplits } from '../stats.js'

// stat -> [column in the hof-pace row, value off an aggregated season stat]
const STATS = {
  h: [0, (s) => num(s.hits)],
  hr: [1, (s) => num(s.homeRuns)],
  w: [0, (s) => num(s.wins)],
  so: [1, (s) => num(s.strikeOuts)],
  outs: [2, (s) => ipToOuts(s.inningsPitched)],
  sv: [3, (s) => num(s.saves)],
}
// WAR is last in a row (hitters 2, pitchers 4) and read by season from `war`
// (warByYearFor). Null in the file for a pre-1901 career: never a comp.
const WAR_COL = { hitting: 2, pitching: 4 }

// `splits`: MLB yearByYear rows (stints and the numTeams roll-up allowed;
// aggregateSplits counts a traded season once, as the career register does:
// stints summed, the roll-up dropped).
// `cutoff` ({ season, stat }) is the `?d=` date-cut season line: it replaces
// that season's live row, keeping the row's age; stat null drops the season. Seasons
// after `cutoff.season` are dropped, and a row with no age is skipped.
// Never `stats=career`, which is always live (see mlbCareerThroughCutoff).
// `war` ({ [season]: war }) is needed for stat 'war'; WAR is null under a cutoff (no
// date-cut WAR exists) and for a career that began before 1901.
// Null when there is no card: under two seasons, or a start after age 30.
export function hofPaceView({ players, splits, group, stat, war = null, cutoff = null, count = 3 }) {
  const isWar = stat === 'war'
  if (isWar && (cutoff || !war)) return null
  const [col, read] = isWar ? [WAR_COL[group], null] : STATS[stat]
  const bySeason = new Map()
  for (const s of splits ?? []) {
    if (s.stat?.age == null || (cutoff && Number(s.season) > Number(cutoff.season))) continue
    bySeason.set(s.season, [...(bySeason.get(s.season) ?? []), s])
  }
  const played = []
  for (const [season, rows] of bySeason) {
    const live = Number(cutoff?.season) === Number(season) ? cutoff.stat : aggregateSplits(rows, group)
    if (live) played.push({ season: Number(season), age: Math.max(...rows.map((r) => num(r.stat.age))), stat: live })
  }
  played.sort((a, b) => a.age - b.age)
  if (played.length < 2 || played[0].age > 30) return null
  const age = played.at(-1).age
  if (isWar && played[0].season < 1901) return null
  const sum = played.reduce((t, s) => t + (isWar ? num(war[s.season]) : read(s.stat)), 0)
  const value = isWar ? Math.round(sum * 10) / 10 : sum

  const pitcher = group === 'pitching'
  const comps = players
    .filter((p) => p.pitcher === pitcher && p.first <= age)
    .map((p) => ({ id: p.id, name: p.name, value: p.rows[Math.min(age - p.first, p.rows.length - 1)][col] }))
    .filter((c) => c.value != null)
    .sort((a, b) => Math.abs(a.value - value) - Math.abs(b.value - value) || a.id - b.id)
  // One above and one below where possible, then fill by gap.
  const pick = [comps.find((c) => c.value >= value), comps.find((c) => c.value < value)].filter(Boolean)
  for (const c of comps) if (pick.length < count && !pick.includes(c)) pick.push(c)
  return { age, value, comps: pick.sort((a, b) => b.value - a.value) }
}
