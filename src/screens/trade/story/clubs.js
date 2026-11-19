// Each club's season for the trade story (build.js): record and division
// finish from the standings, and how its postseason ended from
// postseason-history.json. Pure: the caller hands in both.

// statsapi /standings records (hydrate=division) → { season, w, l, rank, division } or null.
function standingOf(id, records) {
  for (const r of records ?? []) {
    const row = (r.teamRecords ?? []).find((t) => t.team?.id === id)
    if (row) return { w: row.wins, l: row.losses, rank: Number(row.divisionRank) || null, division: r.division?.name ?? null }
  }
  return null
}

// 'champion', the series he lost ("NL Championship Series"), 'out', or null
// when the file has no such season (a season still being played).
export function postseasonOf(id, history, season) {
  const year = (history?.seasons ?? []).find((s) => s.year === season)
  if (!year) return null
  if (year.championTeamId === id) return 'champion'
  let last = null
  for (const round of year.rounds ?? []) {
    for (const s of round.series ?? []) {
      if (s.teamA?.teamId === id || s.teamB?.teamId === id) last = s
    }
  }
  return last ? last.label : 'out'
}

export function clubSeason(id, season, records, history) {
  const standing = standingOf(id, records)
  if (!standing) return null
  return { season, ...standing, postseason: postseasonOf(id, history, season) }
}
