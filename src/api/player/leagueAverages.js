import { staticJson } from '../staticJson.js'
import { getJson } from '../statsapi.js'
import { leagueAveragesOf } from '../../../scripts/lib/stats/league-averages.mjs'

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

// The "vs lg" cell: the season's own rate (the register's printed string, ".282"
// or "3.48") minus the league's, signed. AVG prints as .034, ERA as 0.42.
// Either side missing is an em dash.
export function vsLeague(rate, league, group) {
  const own = parseFloat(rate)
  if (!Number.isFinite(own) || league == null) return '—'
  const pitching = group === 'pitching'
  const gap = Number((own - league).toFixed(pitching ? 2 : 3))
  const text = pitching ? Math.abs(gap).toFixed(2) : Math.abs(gap).toFixed(3).slice(1)
  return `${gap > 0 ? '+' : gap < 0 ? '-' : ''}${text}`
}
