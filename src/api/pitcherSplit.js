// Splits a club's pitchers into Starting Pitchers / Bullpen — by ROLE, never
// by rank-and-truncate. Every pitcher who started at least one game in the
// window is a starter; everyone else who's appeared is a reliever. Both
// loadRoster.js (season) and recentForm.js (last-10-games) used to run their
// own top-5-starters / top-8-bullpen cut, ranked and sliced independently —
// so a pitcher could rank below BOTH cutoffs at once and vanish from the page
// entirely. That's exactly what happened to a 6th man in an expanded
// rotation (Brewers, 6-man rotation, August 2026): too few starts for the
// 5-deep Starting Pitchers cut, and too few relief appearances to crack an
// 8-deep Bullpen ranked by appearance count. Partitioning by role instead of
// capping each side closes that gap for any rotation size, not just 5.
export function splitPitchingStaff(entries, { compareStarters, compareRelievers }) {
  const starters = entries.filter((e) => e.starts > 0).sort(compareStarters)
  const startingIds = new Set(starters.map((e) => e.id))
  const relievers = entries.filter((e) => !startingIds.has(e.id) && e.appearances > 0)
  const maxSaves = relievers.reduce((max, e) => Math.max(max, e.saves), 0)
  const closer = maxSaves > 0 ? relievers.find((e) => e.saves === maxSaves) : null
  const setupCrew = relievers.filter((e) => e !== closer).sort(compareRelievers)
  return { starters, bullpen: closer ? [closer, ...setupCrew] : setupCrew }
}
