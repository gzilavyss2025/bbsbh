// "Matchup edges" on the series primer (ADR-0087): which hitters have beaten
// today's starter, and which the starter has beaten, over their careers. Rows
// are the batters of starterMatchupsFor (src/api/careerMatchups.js), one side
// per club. The rows hold ab, h, hr, bb, hbp, k and pa and no total bases, so
// the line prints no OPS.
//
// PLACEHOLDER THRESHOLDS. Gary tunes these in the PR.
export const HITTER_MIN_PA = 8 // a hitter edge needs this many PA …
export const HITTER_MIN_AVG = 0.35 // … and this average, or
export const HITTER_MIN_HR = 2 // … this many home runs
export const PITCHER_MIN_AB = 10 // a pitcher edge needs this many AB …
export const PITCHER_MAX_AVG = 0.15 // … and an average this low or lower
export const MAX_HITTER_EDGES = 2
export const MAX_PITCHER_EDGES = 1

const avg = (r) => (r.ab > 0 ? r.h / r.ab : null)

// "3-for-8, 1 HR · 9 PA"
export function matchupEdgeLine(r) {
  return `${r.h}-for-${r.ab}${r.hr > 0 ? `, ${r.hr} HR` : ''} · ${r.pa} PA`
}

// sides: starterMatchupsFor results (null for a side with no file row).
// -> [{ kind: 'hitter' | 'pitcher', id, name, vs, line }], hitters first.
export function matchupEdges(sides) {
  const hitters = []
  const pitchers = []
  for (const side of sides ?? []) {
    for (const r of side?.batters ?? []) {
      const a = avg(r)
      const edge = { id: r.id, name: r.name, vs: side.pitcher?.name ?? '', line: matchupEdgeLine(r) }
      if (r.pa >= HITTER_MIN_PA && (a >= HITTER_MIN_AVG || r.hr >= HITTER_MIN_HR)) hitters.push({ a, pa: r.pa, edge: { kind: 'hitter', ...edge } })
      else if (a != null && r.ab >= PITCHER_MIN_AB && a <= PITCHER_MAX_AVG) pitchers.push({ a, ab: r.ab, edge: { kind: 'pitcher', ...edge } })
    }
  }
  hitters.sort((x, y) => y.a - x.a || y.pa - x.pa)
  pitchers.sort((x, y) => x.a - y.a || y.ab - x.ab)
  return [...hitters.slice(0, MAX_HITTER_EDGES), ...pitchers.slice(0, MAX_PITCHER_EDGES)].map((e) => e.edge)
}
