// The /eliminated page's data: for each MLB club and season, the date it was
// mathematically eliminated and every game it played from then on. Static
// public/data/eliminated.json, written by the hand-run scripts/gen-eliminated.mjs.
// Records and dates only, no scores, and the page is a standalone report outside
// the four scoring surfaces (ADR-0034). No file resolves to null.

import { staticJson } from '../staticJson.js'

export const loadEliminated = staticJson('/data/eliminated.json', { shape: (d) => d, fallback: null })

// One club per row for the seasons from..to: games played, games played after
// elimination, and each season's elimination date and games. Fewest games out
// first, ties by most games played. Pure, so the unit suite covers it.
export function summarize(data, from, to) {
  const clubs = new Map()
  for (let y = from; y <= to; y++) {
    for (const [id, c] of Object.entries(data?.seasons?.[y] ?? {})) {
      const teamId = Number(id)
      if (!clubs.has(teamId)) clubs.set(teamId, { teamId, games: 0, outGames: 0, seasons: [] })
      const row = clubs.get(teamId)
      row.games += c.games
      row.outGames += c.rows.length
      row.seasons.push({ season: y, out: c.out, rows: c.rows })
    }
  }
  const list = [...clubs.values()].sort((a, b) => a.outGames - b.outGames || b.games - a.games)
  // Rank with ties sharing a place: 0, 1, 1, 3 → 1, 2, 2, 4.
  list.forEach((c, i) => (c.rank = i && c.outGames === list[i - 1].outGames ? list[i - 1].rank : i + 1))
  return list
}
