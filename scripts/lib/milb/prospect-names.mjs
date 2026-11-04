// The prospect lists' names, from the Stats API person rather than the scrape.
// The mlb.com Pipeline page spells a name with or without its accents from one
// fetch to the next (Joshua Báez / Joshua Baez, 2026-11), so every flip
// committed and deployed top-prospects.json. The Stats API's fullName is one
// spelling. A player it did not return keeps the scraped name.
export const withStatsapiNames = (rows, nameById) =>
  rows.map((r) => (nameById.has(r.playerId) ? { ...r, name: nameById.get(r.playerId) } : r))

// The names to use: this run's Stats API names, and for a player whose batch
// FAILED (`failedIds`), the name already in top-prospects.json (`onDisk`), which
// a previous run took from the Stats API. Without it a failed batch put the
// scraped spelling back for up to 150 players for one night (and a deploy). An
// id the API answered without a person keeps the scrape: a stale disk name must
// not stick to it forever.
export function namesWithFallback(fresh, onDisk, failedIds = new Set()) {
  const names = new Map()
  for (const r of [...(onDisk?.players ?? []), ...(onDisk?.orgProspects ?? [])]) {
    if (failedIds.has(r.playerId) && r.name) names.set(r.playerId, r.name)
  }
  for (const [id, name] of fresh) names.set(id, name)
  return names
}
