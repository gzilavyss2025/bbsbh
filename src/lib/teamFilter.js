// Shared helper for report pages that let a TeamFilterStrip pick restrict the
// page down to one club's rows (a true filter, not just a highlight — see
// LeadersPage/AllStarRostersPage's `effectiveTeamId`/`filtering` for the
// highlight-only convention this deliberately does NOT reuse). `teamId` null
// is the strip's "MLB" pseudo-entry (no filter); any other value keeps only
// rows whose `getTeamId` result matches it.
export function filterByTeam(rows, teamId, getTeamId) {
  if (teamId == null) return rows
  return rows.filter((row) => getTeamId(row) === teamId)
}
