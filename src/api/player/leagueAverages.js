import { staticJson } from '../staticJson.js'
import { getJson } from '../statsapi.js'
import { leagueAveragesOf } from '../../lib/math/leagueAverages.js'

// League batting average and ERA for one MLB season. Season rates, not scores:
// spoiler-free, open data, no SealBox. Seasons up to the last complete one come
// from public/data/league-averages.json (scripts/gen-league-averages.mjs, hand-run).
// The season after that is still in play, so it is fetched live, ONE request for
// both groups, and kept in memory for the session. It is "to date": the caller
// asks lastCompleteSeason() to know which figures are.
//
//   file: { lastSeason, seasons: { [year]: { avg, era } } }  (null = not recorded)
const file = staticJson('/data/league-averages.json', { fallback: null })
const liveByYear = new Map()

export async function lastCompleteSeason() {
  return (await file())?.lastSeason ?? null
}

// A number, or null when the figure does not exist.
export async function leagueAverage(season, group) {
  const f = await file()
  const year = Number(season)
  if (!f || !year) return null
  const row = year > f.lastSeason
    ? await liveSeason(year)
    : f.seasons?.[year]
  return row?.[group === 'pitching' ? 'era' : 'avg'] ?? null
}

function liveSeason(year) {
  if (!liveByYear.has(year)) {
    const request = getJson(`/api/v1/teams/stats?season=${year}&group=hitting,pitching&stats=season&sportIds=1`)
      .then((data) => {
        const splits = (name) => data?.stats?.find((s) => s.group?.displayName === name)?.splits
        return leagueAveragesOf({ hitting: splits('hitting'), pitching: splits('pitching') })
      })
      // A failed request is not kept: the next ask tries again.
      .catch(() => (liveByYear.delete(year), null))
    liveByYear.set(year, request)
  }
  return liveByYear.get(year)
}
