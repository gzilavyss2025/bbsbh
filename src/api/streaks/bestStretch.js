// Best Stretch (/best-stretch): a hitter's best run of N games in a row (162 by
// default), the "his best 162 games" card, or a pitcher's best 32 starts / 65
// relief appearances. Read live from the player's MLB regular-season game log,
// his whole career in one request. A window
// runs across seasons, as the card's does (Yelich: 7/15/2018 to 7/27/2019).
// Not a scoring surface, so nothing is sealed (ADR-0034).

import { getJson } from '../statsapi.js'

const BAT = ['atBats', 'plateAppearances', 'hits', 'doubles', 'triples', 'homeRuns', 'runs', 'rbi', 'baseOnBalls', 'hitByPitch', 'sacFlies', 'stolenBases', 'totalBases', 'strikeOuts']

const PITCH = ['outs', 'earnedRuns', 'hits', 'baseOnBalls', 'hitByPitch', 'strikeOuts', 'homeRuns', 'wins', 'losses', 'saves', 'completeGames', 'shutouts', 'gamesStarted', 'saveOpportunities', 'holds', 'blownSaves', 'gamesFinished', 'inheritedRunners', 'inheritedRunnersScored', 'battersFaced']
// noEarnedRuns counts games whose log leaves earnedRuns out (seen live 2026-11-16: Jack
// Taylor has it in 1902, not 1903; 1908 and 1911 lack it too). ER was not official before
// 1912 (NL) and 1913 (AL). Hits, walks and outs were present in every season checked.
const FIELDS = { hitting: BAT, pitching: [...PITCH, 'noEarnedRuns'] }

// How a rate reads: .352 (no leading zero), 2.12, and an infinite ERA or WHIP
// (a line with no outs) as a dash, not the word Infinity.
export const rate3 = (v) => v.toFixed(3).replace(/^0/, '')
export const dec2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—')

// What "best" means. Each ranks one number from a window's summed line; `lower`
// marks one where less is better (ERA, WHIP); `format` is how the card prints it.
export const BAT_MEASURES = [
  { key: 'ops', label: 'OPS', of: (t) => obp(t) + slg(t), format: rate3 },
  { key: 'avg', label: 'Batting average', of: (t) => avg(t), format: rate3 },
  { key: 'hr', label: 'Home runs', of: (t) => t.homeRuns },
  { key: 'h', label: 'Hits', of: (t) => t.hits },
  { key: 'rbi', label: 'RBI', of: (t) => t.rbi },
  { key: 'sb', label: 'Stolen bases', of: (t) => t.stolenBases },
]
export const PITCH_MEASURES = [
  { key: 'era', label: 'ERA', lower: true, of: (t) => era(t), format: dec2 },
  { key: 'whip', label: 'WHIP', lower: true, of: (t) => whip(t), format: dec2 },
  { key: 'k', label: 'Strikeouts', of: (t) => t.strikeOuts },
  { key: 'kbb', label: 'K minus BB', of: (t) => t.strikeOuts - t.baseOnBalls },
]
export const measuresFor = (group) => (group === 'pitching' ? PITCH_MEASURES : BAT_MEASURES)
const asCount = (v) => String(v)
for (const m of [...BAT_MEASURES, ...PITCH_MEASURES]) m.format ??= asCount
export const measureByKey = (key, group = 'hitting') => measuresFor(group).find((m) => m.key === key) ?? measuresFor(group)[0]

const div = (a, b) => (b > 0 ? a / b : 0)
export const avg = (t) => div(t.hits, t.atBats)
export const obp = (t) => div(t.hits + t.baseOnBalls + t.hitByPitch, t.atBats + t.baseOnBalls + t.hitByPitch + t.sacFlies)
export const slg = (t) => div(t.totalBases, t.atBats)
// No outs is the worst ERA and WHIP, not a perfect one: Infinity ranks last.
const perOut = (a, outs) => (outs > 0 ? a / outs : a > 0 ? Infinity : 0)
// A window with any game missing earned runs has no ERA (NaN): it is never best, never 0.00.
export const era = (t) => (t.noEarnedRuns > 0 ? NaN : perOut(t.earnedRuns * 27, t.outs))
export const whip = (t) => perOut((t.hits + t.baseOnBalls) * 3, t.outs)
export const kRate = (t) => div(t.strikeOuts, t.battersFaced)
export const ip = (t) => `${Math.floor(t.outs / 3)}.${t.outs % 3}`

// One game log split -> a dated row of counting stats (a missing field is 0).
export function toGame(split, group = 'hitting') {
  const COUNTS = FIELDS[group]
  // The club's name rides along: teamFullName knows only today's 30 clubs.
  const row = { date: split.date, gameNumber: split.game?.gameNumber ?? 1, teamId: split.team?.id ?? null, teamName: split.team?.name ?? '' }
  for (const k of COUNTS) row[k] = typeof split.stat?.[k] === 'number' ? split.stat[k] : 0
  if (group === 'pitching') row.noEarnedRuns = typeof split.stat?.earnedRuns === 'number' ? 0 : 1
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
    if (Number.isNaN(value)) continue // no data for this measure (an early ERA)
    if (!best || (measure.lower ? value < best.value : value > best.value)) best = { i, value, totals }
  }
  if (!best) return null
  const window = sorted.slice(best.i, best.i + n)
  return {
    ...best.totals,
    value: best.value,
    games: n,
    first: window[0].date,
    last: window[n - 1].date,
    teams: [...new Set(window.map((g) => g.teamName).filter(Boolean))],
    mainTeamId: mostCommon(window.map((g) => g.teamId).filter(Boolean)),
    careerGames: sorted.length,
  }
}

// ---- One club only (Club Stretch, and Best Stretch's ?club=). A run counts his games for the
// club, crosses seasons, and ends at a game for another club; a return starts a new run. AVG and
// OPS need 3.1 plate appearances per game (the batting-title rule); pitching has no floor.
const PA_PER_GAME = 3.1
const RATES = new Set(['avg', 'ops'])

// Old logs can leave plateAppearances at 0: rebuild it from its parts.
const paOf = (t) => t.plateAppearances || t.atBats + t.baseOnBalls + t.hitByPitch + t.sacFlies

// A measure with the rate floor: a run short of it ranks below every real one.
function flooredMeasure(m, n) {
  if (!RATES.has(m.key)) return m
  const need = Math.ceil(PA_PER_GAME * n)
  return { ...m, of: (t) => (paOf(t) >= need ? m.of(t) : -Infinity) }
}

const clubByDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.gameNumber - b.gameNumber)

// A career log -> the unbroken runs of games for one club, in order.
export function stintsFor(games, teamId) {
  const out = []
  let cur = null
  for (const g of [...games].sort(clubByDate)) {
    if (g.teamId === teamId) (cur ??= out[out.push([]) - 1]).push(g)
    else cur = null
  }
  return out
}

// One player's best run with the club, or null when no stint is long enough (or none
// clears the rate floor).
export const playerBest = (games, teamId, n, measure, group = 'hitting') => bestInStints(stintsFor(games, teamId), n, measure, group)

// The same over stints already split, so a caller ranking many stats splits them once.
// Pitching has no rate floor (Gary, 2026-11-16): a run of starts or relief outings is long
// enough as it is, and a lower ERA or WHIP wins.
export function bestInStints(stints, n, measure, group = 'hitting') {
  const m = group === 'hitting' ? flooredMeasure(measure, n) : measure
  let best = null
  for (const stint of stints) {
    const b = bestStretch(stint, n, m, group)
    if (b && b.value !== -Infinity && (!best || (m.lower ? b.value < best.value : b.value > best.value))) best = b
  }
  return best
}

// Club Stretch's pitching lengths: 32 counts his starts, 65 his relief outings. The other
// kind of outing is set aside first, so it neither counts nor ends a run.
export const CLUB_PITCH_LENGTHS = { starts: 32, relief: 65 }
export const clubPitchPool = (games, n) => games.filter((g) => (n === CLUB_PITCH_LENGTHS.relief ? !(g.gamesStarted > 0) : g.gamesStarted > 0))

// The club he played the most of the window for: the card wears its colours.
function mostCommon(ids) {
  const n = new Map()
  for (const id of ids) n.set(id, (n.get(id) ?? 0) + 1)
  let best = null
  for (const [id, c] of n) if (best == null || c > n.get(best)) best = id
  return best
}

// The length presets a reader can tap, and the default (the season-length one).
export function presetsFor(role) {
  if (role === 'starter') return { options: [5, 10, 32], season: 32 }
  if (role === 'reliever') return { options: [10, 30, 65], season: 65 }
  return { options: [10, 30, 81, 162], season: 162 }
}

// A reliever's saves tile shows holds instead when he set up more than he closed.
export const showsHolds = (t) => t.holds > t.saves

// Starter or reliever: a starter if at least half his outings were starts.
export const isStarter = (games) => games.filter((g) => g.gamesStarted > 0).length * 2 >= games.length

// The player's whole MLB regular-season log for one group ('hitting' or
// 'pitching'). One season per request: the single career-range query takes
// ~45 s cold at MLB and blew our timeout, while a season answers in under a
// second. The season list comes from yearByYear. { name, games }.
export async function loadCareerLog(playerId, signal, group = 'hitting', get = getJson) {
  const base = `/api/v1/people/${playerId}/stats?group=${group}&sportId=1&gameType=R`
  const years = await get(`${base}&stats=yearByYear`, { signal })
  const seasons = [...new Set((years.stats?.[0]?.splits ?? []).map((x) => x.season))].sort()
  // Four at a time: the feed answers about five requests at once and stalls the rest for ~80 s
  // (measured 2026-11-16), so a 25-season career sent all together took over a minute.
  const logs = []
  for (let i = 0; i < seasons.length; i += 4) {
    logs.push(...(await Promise.all(seasons.slice(i, i + 4).map((season) => get(`${base}&stats=gameLog&season=${season}`, { signal })))))
  }
  const splits = logs.flatMap((data) => data.stats?.[0]?.splits ?? [])
  return { name: splits[0]?.player?.fullName ?? '', games: splits.map((x) => toGame(x, group)) }
}
