// A player's honors for the trade story (build.js), from the two stored
// files the awards pages already read: awards-history.json (MVP, Cy Young,
// Rookie of the Year and the rest, 2022 on) and all-star-rosters.json (every
// All-Star team since 1933). Pure: the caller hands in both files.

// The awards a story names, best first, and how a sentence says each.
// `major` ones are named with their year and league; the rest are counted.
export const HONORS = [
  { key: 'MVP', words: 'MVP', major: true },
  { key: 'Cy Young', words: 'Cy Young Award', major: true },
  { key: 'Rookie of the Year', words: 'Rookie of the Year Award', major: true },
  { key: 'World Series MVP', words: 'World Series MVP', major: true },
  { key: 'Reliever of the Year', words: 'Reliever of the Year Award', major: true },
  { key: 'Silver Slugger', words: 'Silver Slugger', plural: 'Silver Sluggers' },
  { key: 'Gold Glove', words: 'Gold Glove', plural: 'Gold Gloves' },
  { key: 'All-MLB First Team', words: 'All-MLB First Team', team: true },
]

// [{ key, season, league }] for one player, best award first, newest first within one.
export function honorsOf(playerId, awards) {
  const out = []
  for (const h of HONORS) {
    const family = (awards?.families ?? []).find((f) => f.key === h.key)
    for (const [season, rows] of Object.entries(family?.years ?? {})) {
      for (const r of rows ?? []) {
        if (r.playerId === playerId) out.push({ key: h.key, season: Number(season), league: r.league ?? null })
      }
    }
  }
  const rank = (k) => HONORS.findIndex((h) => h.key === k)
  return out.sort((x, y) => rank(x.key) - rank(y.key) || y.season - x.season)
}

// The seasons he made the All-Star team, from every roster group of both leagues.
export function allStarSeasons(playerId, allStars) {
  const seasons = []
  for (const [season, leagues] of Object.entries(allStars?.rosters ?? {})) {
    const named = Object.values(leagues ?? {}).some((groups) =>
      Object.values(groups ?? {}).some((list) => Array.isArray(list) && list.some((r) => r.playerId === playerId)))
    if (named) seasons.push(Number(season))
  }
  return seasons.sort((x, y) => y - x)
}

// The weight that picks a deal's headline player: a major award outweighs any WAR.
export function honorWeight(honors) {
  const best = honors[0]
  if (!best) return 0
  const h = HONORS.find((x) => x.key === best.key)
  return h?.major ? 100 - HONORS.indexOf(h) : 10
}
