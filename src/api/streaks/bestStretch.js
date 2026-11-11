// Best Stretch (/best-stretch): a hitter's best run of N games in a row (162 by
// default), the "his best 162 games" card, or a pitcher's best 32 starts / 65
// relief appearances. Read live from the player's MLB regular-season game log,
// his whole career in one request. A window
// runs across seasons, as the card's does (Yelich: 7/15/2018 to 7/27/2019).
// Not a scoring surface, so nothing is sealed (ADR-0034).

import { getJson } from '../statsapi.js'

const BAT = ['atBats', 'plateAppearances', 'hits', 'doubles', 'triples', 'homeRuns', 'runs', 'rbi', 'baseOnBalls', 'hitByPitch', 'sacFlies', 'stolenBases', 'totalBases', 'strikeOuts']

const PITCH = ['outs', 'earnedRuns', 'hits', 'baseOnBalls', 'hitByPitch', 'strikeOuts', 'homeRuns', 'wins', 'losses', 'saves', 'completeGames', 'shutouts', 'gamesStarted']
const FIELDS = { hitting: BAT, pitching: PITCH }

// What "best" means. Each ranks one number from a window's summed line; `lower`
// marks one where less is better (ERA, WHIP).
export const BAT_MEASURES = [
  { key: 'ops', label: 'OPS', of: (t) => obp(t) + slg(t) },
  { key: 'avg', label: 'Batting average', of: (t) => avg(t) },
  { key: 'hr', label: 'Home runs', of: (t) => t.homeRuns },
  { key: 'h', label: 'Hits', of: (t) => t.hits },
  { key: 'rbi', label: 'RBI', of: (t) => t.rbi },
  { key: 'sb', label: 'Stolen bases', of: (t) => t.stolenBases },
]
export const PITCH_MEASURES = [
  { key: 'era', label: 'ERA', lower: true, of: (t) => era(t) },
  { key: 'whip', label: 'WHIP', lower: true, of: (t) => whip(t) },
  { key: 'k', label: 'Strikeouts', of: (t) => t.strikeOuts },
  { key: 'kbb', label: 'K minus BB', of: (t) => t.strikeOuts - t.baseOnBalls },
]
export const measuresFor = (group) => (group === 'pitching' ? PITCH_MEASURES : BAT_MEASURES)
export const measureByKey = (key, group = 'hitting') => measuresFor(group).find((m) => m.key === key) ?? measuresFor(group)[0]

const div = (a, b) => (b > 0 ? a / b : 0)
export const avg = (t) => div(t.hits, t.atBats)
export const obp = (t) => div(t.hits + t.baseOnBalls + t.hitByPitch, t.atBats + t.baseOnBalls + t.hitByPitch + t.sacFlies)
export const slg = (t) => div(t.totalBases, t.atBats)
// No outs is the worst ERA and WHIP, not a perfect one: Infinity ranks last.
const perOut = (a, outs) => (outs > 0 ? a / outs : a > 0 ? Infinity : 0)
export const era = (t) => perOut(t.earnedRuns * 27, t.outs)
export const whip = (t) => perOut((t.hits + t.baseOnBalls) * 3, t.outs)
export const ip = (t) => `${Math.floor(t.outs / 3)}.${t.outs % 3}`

// One game log split -> a dated row of counting stats (a missing field is 0).
export function toGame(split, group = 'hitting') {
  const COUNTS = FIELDS[group]
  // The club's name rides along: teamFullName knows only today's 30 clubs.
  const row = { date: split.date, gameNumber: split.game?.gameNumber ?? 1, teamId: split.team?.id ?? null, teamName: split.team?.name ?? '' }
  for (const k of COUNTS) row[k] = typeof split.stat?.[k] === 'number' ? split.stat[k] : 0
  return row
}

// The best n-game window by `measure`, or null with fewer than n games. A tie keeps
// the earlier window. Returns the window's summed line and its first and last game.
export function bestStretch(games, n, measure, group = 'hitting') {
  const COUNTS = FIELDS[group]
  if (!games.length || games.length < n) return null
  const sorted = [...games].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.gameNumber - b.gameNumber))
  // Prefix sums: window [i, i+n) is pre[i+n] - pre[i], so the search is one pass.
  const pre = [Object.fromEntries(COUNTS.map((k) => [k, 0]))]
  for (const g of sorted) {
    const last = pre[pre.length - 1]
    pre.push(Object.fromEntries(COUNTS.map((k) => [k, last[k] + g[k]])))
  }
  const sum = (i) => Object.fromEntries(COUNTS.map((k) => [k, pre[i + n][k] - pre[i][k]]))
  let best = null
  for (let i = 0; i + n <= sorted.length; i++) {
    const totals = sum(i)
    const value = measure.of(totals)
    if (!best || (measure.lower ? value < best.value : value > best.value)) best = { i, value, totals }
  }
  const window = sorted.slice(best.i, best.i + n)
  return {
    ...best.totals,
    value: best.value,
    games: n,
    first: window[0].date,
    last: window[n - 1].date,
    teams: [...new Set(window.map((g) => g.teamName).filter(Boolean))],
    careerGames: sorted.length,
  }
}

// Starter or reliever: a starter if at least half his outings were starts.
export const isStarter = (games) => games.filter((g) => g.gamesStarted > 0).length * 2 >= games.length

// The player's whole MLB regular-season log for one group ('hitting' or
// 'pitching'). The endpoint takes one date range for a career, so this is a
// single request. { name, games }.
export async function loadCareerLog(playerId, signal, group = 'hitting') {
  const data = await getJson(
    `/api/v1/people/${playerId}/stats?stats=gameLog&group=${group}&sportId=1&gameType=R&startDate=1871-01-01&endDate=${new Date().getFullYear()}-12-31`,
    { signal },
  )
  const splits = data.stats?.[0]?.splits ?? []
  return { name: splits[0]?.player?.fullName ?? '', games: splits.map((x) => toGame(x, group)) }
}
