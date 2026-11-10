// The elimination rule for gen-eliminated.mjs: which clubs in one league's
// standings are mathematically out of the postseason.
//
// A club is out when it has not clinched and EITHER
//   - its division AND wild-card elimination numbers are both 'E', or
//   - other clubs have already clinched every postseason berth in its league.
// The second test exists because the feed's elimination numbers ignore
// tiebreakers: on 2022-10-04 the Brewers' wild-card number still read 1, but the
// Phillies had clinched the last NL spot on Oct 3 holding the tiebreaker.

// Postseason berths per league: 5 through 2021 (2020's 16-team field was 8), 6 from 2022.
export const berthsPerLeague = (season) => (season === 2020 ? 8 : season >= 2022 ? 6 : 5)

export function eliminatedIds(teamRecords, season) {
  const clinched = new Set(teamRecords.filter((t) => t.clinched).map((t) => t.team.id))
  const allBerthsTaken = clinched.size >= berthsPerLeague(season)
  const out = new Set()
  for (const t of teamRecords) {
    if (clinched.has(t.team.id)) continue
    const byNumbers = t.eliminationNumber === 'E' && (t.wildCardEliminationNumber ?? 'E') === 'E'
    if (byNumbers || allBerthsTaken) out.add(t.team.id)
  }
  return out
}
