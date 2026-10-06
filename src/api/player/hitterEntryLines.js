// Hitters' regular-season lines entering a game — one request for a whole lineup.
//
// WHY THE POSTER CANNOT READ THE FEED FOR THIS. In a postseason game a boxscore
// player's `seasonStats` holds the POSTSEASON only: Chase DeLauter, 2026 ALDS Gm 2
// (gamePk 849834), reads 2 G / 8 AB / .250 there, against 133 G / 495 AB / .287
// for the regular season (`stats=season&gameType=R`). Printed as a "season" line
// it is a two-game October sample under the wrong label. `byDateRange` with
// `gameType=R` is the regular season, and ending it the day before the game keeps
// it clear of a game in progress, the same cutoff ADR-0088 sets for pitchers.
//
// Verified against the people endpoint on 2026-10-06:
//   /api/v1/people?personIds=…&hydrate=stats(group=[hitting],type=[byDateRange],
//     startDate=…,endDate=…,gameType=R,season=…)
// A traded hitter gets one split per club PLUS a combined split with no `team`
// key (Nathaniel Lowe 2026: CIN, CLE, combined). Pick by the missing key, never
// by position; a one-club hitter has no keyless split and any split is his line.
import { getJson } from '../statsapi.js'
import { dayBefore } from '../game.js'

const keep = (stat) => ({
  avg: stat.avg ?? '',
  obp: stat.obp ?? '',
  slg: stat.slg ?? '',
  ops: stat.ops ?? '',
  atBats: stat.atBats ?? 0,
  homeRuns: stat.homeRuns ?? null,
  rbi: stat.rbi ?? null,
  stolenBases: stat.stolenBases ?? null,
})

// Resolves to `{ [personId]: line }`. A hitter with no line is left out; any
// failure resolves to `{}` so the poster drops the stat rather than mislabel it.
export async function fetchHitterEntryLines(personIds, season, officialDate, sportId = 1) {
  const ids = [...new Set((personIds ?? []).filter(Boolean))]
  if (!ids.length || !season || !officialDate) return {}
  try {
    const sport = sportId && sportId !== 1 ? `&sportId=${sportId}` : ''
    const hydrate =
      `stats(group=[hitting],type=[byDateRange],startDate=${season}-01-01,` +
      `endDate=${dayBefore(officialDate)},gameType=R,season=${season})`
    const data = await getJson(
      `/api/v1/people?personIds=${ids.join(',')}&hydrate=${encodeURIComponent(hydrate)}${sport}`,
    )
    const out = {}
    for (const person of data.people ?? []) {
      const splits = person.stats?.find((s) => s.type?.displayName === 'byDateRange')?.splits ?? []
      const stat = (splits.find((s) => !s.team) ?? splits[0])?.stat
      if (stat) out[person.id] = keep(stat)
    }
    return out
  } catch {
    return {}
  }
}
