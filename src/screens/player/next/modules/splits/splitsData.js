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

// Splits vs team for a season pick (the nightly shard is the career, regular season only): the
// season's game log, summed per opponent into the shard's own `car` shape so the strip and the
// row read it unchanged. statsapi: R 1, P 1, A 2.
// A dated page (`asOf`) counts only the games before its day, as the door's sheet does.
export async function loadVsTeamSeason(id, group, season, scope, asOf = null) {
  const log = (gameType) => fetchPersonStats(id, { type: 'gameLog', group, season, gameType })
  const [regular, post] = await Promise.all([
    scope === 'P' ? [] : log('R'),
    scope === 'R' ? [] : log('F,D,L,W'),
  ])
  return vsByOpp([...regular, ...post].filter((r) => !asOf || String(r.date) < asOf), group)
}

// Game-log rows -> { [oppId]: { car } }. Rates are divided once from the summed counts.
export function vsByOpp(rows, group) {
  const sums = new Map()
  for (const r of rows ?? []) {
    const opp = r?.opponent?.id
    if (!opp || !r.stat) continue
    sums.set(opp, mergeCareerSplits(sums.get(opp), r.stat, group))
  }
  const out = {}
  for (const [opp, t] of sums) {
    out[String(opp)] = {
      car: group === 'pitching'
        ? { g: t.gamesPlayed, ip: t.inningsPitched, era: t.era, k: t.strikeOuts, bb: t.baseOnBalls }
        : { g: t.gamesPlayed, pa: t.plateAppearances, avg: t.avg, obp: t.obp, slg: t.slg, ops: t.ops, hr: t.homeRuns, so: t.strikeOuts, bb: t.baseOnBalls },
    }
  }
  return out
}

// The career regular-season line the vs-team and Game lines rows read against (1 request).
export const loadCareer = (id, group) => fetchCareerTotal(id, group, 'R')

// The Game lines doors and the line they read against, for the bar's pick: a season ('2026') or
// 'career', in scope R, P or A (#1886 follow-up: the doors used to be the career whatever the bar
// said). statsapi: 2 requests, +1 for scope A's October, +1 per game-type door, +2 for a bat's
// Started and Substitution.
export async function loadGameLines(id, group, pick, scope) {
  // The rows that cannot answer this scope go: the Postseason row under R (it is not regular) and
  // under P (it is the base row again); a bat's Started / Came in under P or A (MLB counts starts
  // for the regular season only).
  const rows = cardFacetsFor(group).filter(
    (r) => !(r.careerGameType === 'P' && scope !== 'A') && !(r.fielding && scope !== 'R'),
  )
  if (!rows.length) return null
  const season = pick === 'career' ? null : pick
  const total = (t) => fetchCareerTotal(id, group, t, season)
  const [labels, regular, post] = await Promise.all([
    fetchDoorLabels(id, group, rows, { season, scope }),
    scope === 'P' ? null : total('R'),
    scope === 'R' ? null : total('P'),
  ])
  const base = scope === 'A' ? (regular ? mergeCareerSplits(regular, post, group) : null) : scope === 'P' ? post : regular
  return { rows, labels, base, only: { season, scope } }
}
