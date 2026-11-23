// One player as the trade tools need him, from one statsapi read: name,
// position, age, current club, his MLB playing time by season (plate
// appearances, or batters faced for a pitcher), his role, and last season's
// line. The wire's trade grade (wireGrade.js) and a player placed on a side by
// link (side.js addPlacedPlayers) both read him here. Memoized per session.
import { getJson } from '../statsapi.js'
import { roleFromCounts } from '../../lib/roster/pitcherRole.js'

const PITCHER = new Set(['P', 'SP', 'RP', 'TWP'])
const loads = new Map()

export function fetchTradePerson(id) {
  const key = Number(id)
  if (!loads.has(key)) {
    loads.set(key, read(key).catch((e) => { loads.delete(key); throw e }))
  }
  return loads.get(key)
}

async function read(id) {
  const data = await getJson(`/api/v1/people/${id}?hydrate=currentTeam,currentAge,stats(type=yearByYear,group=[hitting,pitching],sportId=1)`)
  const p = data.people?.[0]
  if (!p) throw new Error(`no person ${id}`)
  const pitcher = PITCHER.has(p.primaryPosition?.abbreviation)
  const group = (p.stats ?? []).find((g) => g.group?.displayName === (pitcher ? 'pitching' : 'hitting'))
  const pa = {}
  let last = null
  for (const s of group?.splits ?? []) {
    if (!s.team) continue
    pa[s.season] = (pa[s.season] ?? 0) + (Number(pitcher ? s.stat?.battersFaced : s.stat?.plateAppearances) || 0)
    if (!last || s.season >= last.season) last = s
  }
  const role = pitcher && last ? roleFromCounts(last.stat?.gamesStarted, last.stat?.gamesPitched, last.stat?.saves) : null
  // His latest MLB line, the shape the roster's hydrate gives (side.js lineOf).
  const line = !last ? null : pitcher
    ? { era: last.stat?.era ?? null, ip: last.stat?.inningsPitched ?? null, role }
    : { ops: last.stat?.ops ?? null, pa: last.stat?.plateAppearances ?? null }
  return {
    id,
    name: p.fullName,
    pos: p.primaryPosition?.abbreviation ?? '',
    age: p.currentAge ?? null,
    currentTeamId: p.currentTeam?.parentOrgId ?? p.currentTeam?.id ?? null,
    pitcher,
    pa,
    role,
    line,
  }
}
