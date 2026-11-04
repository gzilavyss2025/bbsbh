// The prospect lists' names, from the Stats API person rather than the scrape.
// The mlb.com Pipeline page spells a name with or without its accents from one
// fetch to the next (Joshua Báez / Joshua Baez, 2026-11), so every flip
// committed and deployed top-prospects.json. The Stats API's fullName is one
// spelling. A player it did not return keeps the scraped name.
export const withStatsapiNames = (rows, nameById) =>
  rows.map((r) => (nameById.has(r.playerId) ? { ...r, name: nameById.get(r.playerId) } : r))
