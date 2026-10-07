// The player page's postseason stats, in two shapes. The Stats tab's Postseason
// stats card: one row per October a player reached, newest first, and his career
// postseason line under them. The career register (api/person/careerRegister.js)
// is regular season only, so this is where a player's October shows in a table.
// The Overview's "postseason to date" tile row (`fetchPostseasonSeason` and
// `postseasonTilesView` at the foot): this year's October beside the season tiles.
//
// Both reads are statsapi's own postseason aggregate, gameType=P: `yearByYear`
// gives one row per postseason year with every round folded together, and
// `career` gives the one career line. Checked live 2026-10-05 (Judge: 8 years,
// 65 G career). MLB only: a minor-league postseason code was never checked, so a
// player who has not debuted asks nothing and gets no card. A pitcher's rows come
// back with gameType 'P' too, which is why this does not ask per round
// (docs/MLB_STATS_API.md, the gameType table).
//
// SPOILER FOOTING. A stat line is not a score (ADR-0034): the page is open. A dated
// page (`asOf`) still must not look ahead, and a yearByYear row for the as-of year
// may hold October games after the date, so that season and every later one drop
// out. The API career line then includes games past the date, so the footer is
// rebuilt from the rows that stay.
import { fetchPersonStats, fetchTeamAbbrevs } from '../person-fetch.js'
import { aggregateSplits, hitterTiles, pitcherTiles } from '../person/stats.js'
import { DASH } from '../person/shared.js'
import { registerColumns, yearByYearCells } from '../person/careerRegister.js'
import { postseasonStarted } from '../postseason/started.js'

export async function fetchPostseasonRegister(personId, group, { hasDebuted = true, asOf = null } = {}) {
  if (!personId || !group || !hasDebuted) return null
  // A dated page rebuilds its footer from the rows it keeps, so the career line is never read.
  const [yby, careerSplits] = await Promise.all([
    fetchPersonStats(personId, { type: 'yearByYear', group, gameType: 'P' }),
    asOf ? [] : fetchPersonStats(personId, { type: 'career', group, gameType: 'P' }),
  ])
  return { yby, career: careerSplits[0]?.stat ?? null }
}

// `showSaves` is the closer test (the stat block's role), so a closer's two tables read alike.
export function postseasonRegisterView({ yby, career, group, asOf = null, showSaves = false }) {
  const cutYear = asOf ? Number(String(asOf).slice(0, 4)) : null
  const kept = (yby ?? []).filter((s) => s?.stat && s.season && (cutYear == null || Number(s.season) < cutYear))
  // A traded season carries a synthetic, team-less roll-up beside the real club rows.
  const seasonsWithClubs = new Set(kept.filter((s) => s.team?.id).map((s) => s.season))
  const splits = kept.filter((s) => s.team?.id || !seasonsWithClubs.has(s.season))
  if (!splits.length) return null

  const rows = splits
    .map((s, index) => ({ s, index }))
    .sort((a, b) => Number(b.s.season) - Number(a.s.season) || a.index - b.index)
    .map(({ s }) => ({
      key: `${s.season}-${s.team?.id ?? 'x'}`,
      year: Number(s.season),
      teamIds: s.team?.id ? [s.team.id] : [],
      team: '',
      cells: yearByYearCells(s.stat, group, showSaves),
    }))

  const totals = []
  if (rows.length > 1) {
    const stat = cutYear == null && career ? career : aggregateSplits(splits, group, { dedupe: false })
    if (stat) totals.push({ label: 'Postseason', cells: yearByYearCells(stat, group, showSaves) })
  }
  return { columns: registerColumns(group, showSaves), rows, totals }
}

// Fetch, shape, and name each row's club (the splits carry an id and a name, never
// an abbreviation).
export async function loadPostseasonRegister(personId, group, { hasDebuted = true, asOf = null, showSaves = false } = {}) {
  const raw = await fetchPostseasonRegister(personId, group, { hasDebuted, asOf })
  if (!raw) return null
  const view = postseasonRegisterView({ ...raw, group, asOf, showSaves })
  if (!view) return null
  const abbrevs = await fetchTeamAbbrevs([...new Set(view.rows.flatMap((r) => r.teamIds))])
  for (const r of view.rows) r.team = r.teamIds.map((id) => abbrevs[id]).filter(Boolean).join('/')
  return view
}

// This year's postseason to date, date-cut by the API itself: byDateRange takes
// gameType=P and counts only games inside [startDate, endDate] (checked live
// 2026-10-05). The caller passes the same window as the season tiles beside it, so
// a dated page, or a game in progress, never moves it. MLB only (a player who has
// not debuted asks nothing), and the API emits each row twice, which
// aggregateSplits folds. Not sent before the season's postseason starts (#1675);
// the two reads above hold past Octobers and are never gated.
export async function fetchPostseasonSeason(personId, group, { season, startDate, endDate, hasDebuted = true } = {}) {
  if (!personId || !group || !season || !hasDebuted || !(await postseasonStarted(season))) return []
  return fetchPersonStats(personId, { type: 'byDateRange', group, season, startDate, endDate, gameType: 'P' })
}

// The tile row: the season tiles' own four (WAR is a regular-season figure and
// drops out), then OPS for a bat or WHIP for an arm. Null until he has played a
// postseason game, so the row does not exist before October.
export function postseasonTilesView(splits, group, role = null) {
  const stat = aggregateSplits(splits ?? [], group)
  if (!stat || !(Number(stat.gamesPlayed) > 0)) return null
  const tiles =
    group === 'pitching'
      ? [...pitcherTiles(stat, role).slice(0, 4), { k: 'WHIP', v: stat.whip ?? DASH }]
      : [...hitterTiles(stat).slice(0, 4), { k: 'OPS', v: stat.ops ?? DASH }]
  return { games: Number(stat.gamesPlayed), tiles }
}
