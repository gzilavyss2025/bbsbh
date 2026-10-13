// The Splits slot's loaders (#1886). Open surface (ADR-0034): season and career aggregates, no
// game result. Each loader makes the fewest requests its scope needs; a failed fetch gives no
// rows (the fetchers swallow it), so a part with nothing hides itself.
import { fetchPersonStats } from '../../../../../api/person-fetch.js'
import { loadCareerSplits, loadSeasonSplits } from '../../../../../api/boxlines/splitsLoad.js'
import { fetchCareerSplits, fetchCareerTotal, fetchDoorLabels, mergeCareerSplits } from '../../../../../api/boxlines/careerSplits.js'
import { cardFacetsFor } from '../../../../../api/boxlines/cardFacets.js'
import { SITUATIONAL_SIT_CODES } from '../../../../../api/person/stats.js'
import { fetchVsTeamSplitsForPlayer, vsTeamSplitsFor } from '../../../../../api/vsTeamSplits.js'

const CODES = `vl,vr,${SITUATIONAL_SIT_CODES}`

const size = (st) => Number(st.plateAppearances) || Number(st.battersFaced) || 0

// One stat per code. A traded player's season comes back one row per club plus a combined row:
// the combined row has the most plate appearances, so it wins.
function byCode(rows) {
  const best = new Map()
  for (const s of rows ?? []) {
    const code = s?.split?.code
    if (!code || !s.stat) continue
    if (!best.has(code) || size(s.stat) > size(best.get(code))) best.set(code, s.stat)
  }
  return best
}
const asRows = (map) => [...map].map(([code, stat]) => ({ split: { code }, stat }))

// The hand and situational rows for a season ('2025') or 'career', in scope R (regular), P
// (postseason) or A (both). Requests: R 1, P 1, A 2.
export async function loadSplits(id, group, pick, scope) {
  if (pick === 'career') {
    return scope === 'P' ? asRows(await fetchCareerSplits(id, group, CODES.split(','), 'P')) : loadCareerSplits(id, group, scope)
  }
  const [regular, post] = await Promise.all([
    scope === 'P' ? new Map() : loadSeasonSplits(id, group, pick).then(byCode),
    scope === 'R' ? new Map() : fetchPersonStats(id, { type: 'statSplits', group, sitCodes: CODES, season: pick, gameType: 'P' }).then(byCode),
  ])
  if (scope !== 'A') return asRows(scope === 'P' ? post : regular)
  // A postseason alone is not a season: no regular rows means the request failed.
  if (!regular.size) return []
  const codes = new Set([...regular.keys(), ...post.keys()])
  return asRows(new Map([...codes].map((code) => [code, mergeCareerSplits(regular.get(code), post.get(code), group)])))
}

// His shard of the nightly vs-team file (2 same-origin reads), or null: not in it, or the other
// group of a two-way player.
export async function loadVsTeam(id, group) {
  const vs = vsTeamSplitsFor(await fetchVsTeamSplitsForPlayer(id), id)
  return vs?.group === group ? vs : null
}

// The career regular-season line the vs-team and Game lines rows read against (1 request).
export const loadCareer = (id, group) => fetchCareerTotal(id, group, 'R')

// The Game lines doors' career labels (statsapi: 1 request, +1 for the postseason door, +1 for the
// calendar doors, +1 for a bat's Started and Substitution).
export async function loadGameLines(id, group) {
  const rows = cardFacetsFor(group)
  return rows.length ? { rows, labels: await fetchDoorLabels(id, group, rows) } : null
}
