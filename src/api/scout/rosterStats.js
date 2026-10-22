// The World Series home's Roster card reads (#2316): each club's Series roster with its starters
// marked, and one player's stat line, read only when his row is opened.
//
// SPOILER FOOTING (ADR-0087, ADR-0088). An open surface, so no seal, but no read may include the
// slate date's game: it is unplayed or in progress, and a total that counts it leaks the result.
// Every byDateRange read ends the day before the slate date (hotBatsUrl's shape,
// postseason/worldSeriesHome.js). Never stats=career or stats=season: both count a game in
// progress. The career line is the yearByYear seasons BEFORE this one plus this season's
// date-bounded line, rates rebuilt from the summed counts (aggregateSplits), the way
// postseason/pitcherCareer.js builds its line. test/world-series/roster-card.test.js pins it.
//
// A failed read throws (the card says so in one line); fetchPersonStats would swallow it as "no games".
// Field paths checked live on 2026-10-22 against the 2025 Series (LAD 119, Freeman 518692, Call 669743).
import { isStarter } from '../../lib/postseason/worldseries/scouting/roster.js'
import { aggregateSplits, withoutMultiTeamAggregate } from '../person/stats.js'
import { dayBefore } from '../postseason/fetch.js'
import { fetchSeriesRoster } from '../postseason/roster.js'
import { getJson } from '../statsapi.js'

const splitsOf = (json) => json?.stats?.[0]?.splits ?? []
const range = (slateDate) => {
  const season = slateDate.slice(0, 4)
  return `season=${season}&startDate=${season}-01-01&endDate=${dayBefore(slateDate)}`
}

// gameType 'P' (the postseason) or 'R' (the regular season).
const personRangeUrl = (personId, group, gameType, slateDate) =>
  `/api/v1/people/${personId}/stats?stats=byDateRange&group=${group}&gameType=${gameType}&${range(slateDate)}`

async function readGroup(personId, group, set, slateDate) {
  if (set !== 'C') return aggregateSplits(splitsOf(await getJson(personRangeUrl(personId, group, set, slateDate))), group)
  const season = Number(slateDate.slice(0, 4))
  const [past, now] = await Promise.all([
    getJson(`/api/v1/people/${personId}/stats?stats=yearByYear&group=${group}&gameType=R`),
    getJson(personRangeUrl(personId, group, 'R', slateDate)),
  ])
  // A traded season answers its club rows and a team-less roll-up: keep the club rows only.
  const earlier = withoutMultiTeamAggregate(splitsOf(past).filter((s) => Number(s.season) < season))
  const thisSeason = aggregateSplits(splitsOf(now), group)
  const rows = [...earlier, ...(thisSeason ? [{ stat: thisSeason }] : [])].map((s) => ({ stat: s.stat }))
  // Different seasons, never the API's duplicate row: no dedupe.
  return aggregateSplits(rows, group, { dedupe: false })
}

// One player's line for a stat set: 'P' postseason, 'R' regular season, 'C' career (regular season).
// -> { hitting?, pitching? }, each a stat object or null. Memoized per player and set; a failure is
// dropped from the memo so the next open reads again.
const lines = new Map()
export function loadRosterLine(personId, { set, groups, slateDate }) {
  const key = `${personId}|${set}|${groups.join(',')}|${slateDate}`
  if (!lines.has(key)) {
    const read = Promise.all(groups.map((g) => readGroup(personId, g, set, slateDate))).then((stats) =>
      Object.fromEntries(groups.map((g, i) => [g, stats[i]])),
    )
    read.catch(() => lines.delete(key))
    lines.set(key, read)
  }
  return lines.get(key)
}

export function resetRosterReads() {
  lines.clear()
}

const ROLE_FIELDS = 'stats,splits,player,id,stat,gamesPlayed,gamesStarted'
const roleUrl = (teamId, gameType, slateDate) =>
  `/api/v1/stats?stats=byDateRange&group=pitching&gameType=${gameType}&teamId=${teamId}&${range(slateDate)}&playerPool=ALL&limit=500&fields=${ROLE_FIELDS}`

// The club's starters (a Set of ids) by the starter rule (scouting/roster.js isStarter).
// ponytail: club-filtered, so a pitcher traded in counts only his games for this club.
export async function loadPitcherRoles(teamId, slateDate) {
  const [ps, rs] = await Promise.all(['P', 'R'].map((t) => getJson(roleUrl(teamId, t, slateDate))))
  const byId = (json) => {
    const m = new Map()
    for (const s of splitsOf(json)) if (s.player?.id && !m.has(s.player.id)) m.set(s.player.id, { g: s.stat?.gamesPlayed ?? 0, gs: s.stat?.gamesStarted ?? 0 })
    return m
  }
  const psBy = byId(ps)
  const rsBy = byId(rs)
  return new Set([...psBy.keys(), ...rsBy.keys()].filter((id) => isStarter({ ps: psBy.get(id), rs: rsBy.get(id) })))
}

// Both Series clubs' rosters: { [teamId]: { positionPlayers, pitchers, declared, starters } }.
// A club with no roster is left out; a failed read throws.
export async function loadSeriesRosters(clubIds, series, slateDate) {
  const each = await Promise.all(
    clubIds.map(async (id) => {
      const [roster, starters] = await Promise.all([fetchSeriesRoster(id, series, slateDate), loadPitcherRoles(id, slateDate)])
      return roster && [id, { ...roster, starters }]
    }),
  )
  return Object.fromEntries(each.filter(Boolean))
}
