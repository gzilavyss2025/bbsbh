// The World Series hero's spotlight pool (#1906): everyone a tap on the art can show for one club.
// The hero cycles through the club's whole 26-man roster, so each player needs a stat line: his
// postseason line when he has one (hitters come from the hot-bat read the home already makes),
// else his regular-season line, from the three club-wide reads here.
//
// SPOILER FOOTING (ADR-0087). An open surface, so no seal, but no read may count the slate date's
// game: every byDateRange read ends the day before the slate date, in the request, as
// hotBatsUrl does (postseason/worldSeriesHome.js). Never stats=season or stats=career. The roster
// is names, numbers and positions only (postseason/roster.js, spoiler-free). test/postseason/
// spotlight-pool.test.js pins the cutoff on the URLs.
//
// Each read is club-wide (playerPool=ALL), so a club costs three stat requests plus the roster,
// not one per player. A failed read is [] (that line falls back or is left out), never a throw.
import { getJson } from '../../statsapi.js'
import { dayBefore } from '../fetch.js'
import { fetchSeriesRoster } from '../roster.js'

const FIELDS = 'stats,splits,player,id,stat,plateAppearances,ops,inningsPitched,era'

// gameType 'P' (the postseason) or 'R' (the regular season); group 'hitting' or 'pitching'.
export function spotlightUrl(group, gameType, teamId, slateDate) {
  const season = slateDate.slice(0, 4)
  return (
    `/api/v1/stats?stats=byDateRange&group=${group}&gameType=${gameType}&season=${season}&teamId=${teamId}` +
    `&startDate=${season}-01-01&endDate=${dayBefore(slateDate)}&playerPool=ALL&limit=500&fields=${FIELDS}`
  )
}

const splits = async (url, signal) => {
  try {
    return (await getJson(url, { signal }))?.stats?.[0]?.splits ?? []
  } catch {
    return []
  }
}

// -> { roster, hitR, pitP, pitR }: the club's roster (fetchSeriesRoster's shape, or null), and the
// regular-season hitting, postseason pitching and regular-season pitching splits.
export async function fetchSpotlightPool(teamId, series, slateDate, { signal } = {}) {
  const [roster, hitR, pitP, pitR] = await Promise.all([
    fetchSeriesRoster(teamId, series, slateDate, { signal }).catch(() => null),
    splits(spotlightUrl('hitting', 'R', teamId, slateDate), signal),
    splits(spotlightUrl('pitching', 'P', teamId, slateDate), signal),
    splits(spotlightUrl('pitching', 'R', teamId, slateDate), signal),
  ])
  return { roster, hitR, pitP, pitR }
}
