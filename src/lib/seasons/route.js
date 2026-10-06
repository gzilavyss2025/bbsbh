// A SEASON VIEW's address (#1202), parsed and built. lib/route.js owns the
// routes; this owns the one segment and the one query every season view adds,
// so the five pages that take it cannot spell it five ways.

// A SEASON VIEW's season (#1202). The season is a path segment ('/fouls/2026',
// '/fouls/all') and a compare season is a query ('/fouls/2027?vs=2026'), the
// same split '/trade-deadline/{year}' and '/logbook/{season}' make. The address
// cannot know which seasons a store has on file, so a well-formed year rides
// through and the page resolves it (lib/seasons/view.js): a year not on file
// is the current season there, the same rule staticJson.js's seasonFolderOf
// keeps. A malformed one is dropped here. Nothing is the current season, so
// each key is ABSENT rather than null and the bare address keeps its old shape.
// 'all' takes no `vs`: it is already every season. Neither does a season
// compared with itself.
const seasonYearOf = (seg) => {
  if (!/^\d{4}$/.test(seg ?? '')) return null
  const year = Number(seg)
  return year >= 1876 && year <= 2200 ? year : null
}
function seasonParams(segment, q) {
  const seasonYear = segment === 'all' ? 'all' : seasonYearOf(segment)
  const vs = seasonYear === 'all' ? null : seasonYearOf(q.get('vs'))
  return {
    ...(seasonYear != null && { seasonYear }),
    ...(vs != null && vs !== seasonYear && { vs }),
  }
}

// A SEASON VIEW's address (#1202): `seasonYear` a year or 'all' as the last
// segment, `vs` a compare year as the query. Neither is written when absent,
// and `vs` is dropped for 'all' and for a season compared with itself, the
// same rules seasonParams() parses by.
function seasonSegment(base, { seasonYear, vs } = {}) {
  const path = seasonYear != null ? `${base}/${seasonYear}` : base
  const compare = seasonYear !== 'all' && vs != null && vs !== seasonYear ? vs : null
  return { path, vs: compare }
}
// The player Analytics tab's pitch scope (#1503): `?scope=post|all`. Regular is
// the bare address, so it is never written and a value we do not know is dropped.
const PITCH_SCOPES = new Set(['post', 'all'])
export const pitchScopeOf = (v) => (PITCH_SCOPES.has(v) ? v : null)

// `query` is a query the address already carries ('?d=…&s=…', a player
// page's cutoff hints); `vs` joins it.
export function seasonPath(base, season, query = '') {
  const { path, vs } = seasonSegment(base, season)
  const q = new URLSearchParams(query.replace(/^\?/, ''))
  if (vs != null) q.set('vs', String(vs))
  const scope = pitchScopeOf(season?.scope)
  if (scope) q.set('scope', scope)
  const qs = q.toString()
  return `${path}${qs ? `?${qs}` : ''}`
}

// The season views (#1202), or null for any other address. lib/route.js
// calls this before its own branches. A bare address keeps the exact shape it
// had before #1202; a season segment or `?vs=` only adds keys.
//
// The player hub's Analytics tab is the one season view on the hub: its
// season cards read the season stores. Its route keeps the hub's id, cutoff
// and level, as lib/route.js's PLAYER_TAB_ROUTES branch builds them.
// `standings` and `postseason-race` take a season too ('/standings/2024') but no
// `vs`: one year's table is not compared with another's here.
const SEASON_PAGES = {
  fouls: 'fouls',
  umpires: 'umpire-rankings',
  'abs-challenges': 'abs-challenges',
  standings: 'standings',
  'postseason-race': 'postseason-race',
}
export function parseSeasonRoute(parts, q, { asOf, sportId, idFromSlug }) {
  const [head, second, third, fourth] = parts
  if (parts.length <= 2 && SEASON_PAGES[head]) return { name: SEASON_PAGES[head], ...seasonParams(second, q) }
  if ((parts.length === 2 || parts.length === 3) && head === 'umpire')
    return { name: 'umpire', id: idFromSlug(second), ...seasonParams(third, q) }
  if ((parts.length === 3 || parts.length === 4) && head === 'player' && third === 'analytics')
    return {
      name: 'player-analytics',
      id: idFromSlug(second),
      asOf,
      sportId,
      ...(pitchScopeOf(q.get('scope')) && { scope: pitchScopeOf(q.get('scope')) }),
      ...seasonParams(fourth, q),
    }
  return null
}
