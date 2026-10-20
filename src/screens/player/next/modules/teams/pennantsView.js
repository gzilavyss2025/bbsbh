// Team history's pennants (the band under the ledger): the seasons a player played in the
// majors for a club that won its league that year. `file` is the league-pennants store
// (api/history/leaguePennants.js), `splits` his MLB year-by-year rows. A season counts when he
// has games for THAT club in THAT year; a club he only sat on the roster of does not. A
// mid-season trade counts both clubs if both won, and a player on a pennant club for one game
// counts, as the ledger's games show. On a dated page (`asOfSeason`) the page's own season
// and later ones are left out: that pennant may not be won yet. Newest first.
export function playerPennants(file, splits, asOfSeason) {
  const seen = new Set()
  const out = []
  for (const s of splits ?? []) {
    const season = Number(s.season)
    const teamId = s.team?.id
    if (!teamId || !(Number(s.stat?.gamesPlayed) > 0)) continue
    if (asOfSeason && season >= asOfSeason) continue
    const key = `${season}|${teamId}`
    if (seen.has(key)) continue
    const won = file?.teams?.[teamId]?.find((p) => p.season === season)
    if (!won) continue
    seen.add(key)
    out.push({ ...won, teamId })
  }
  return out.sort((a, b) => b.season - a.season || a.teamId - b.teamId)
}
