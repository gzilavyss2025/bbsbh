// Best Stretch (/best-stretch): a hitter's best run of N games in a row (162 by
// default), the "his best 162 games" card, or a pitcher's best 32 starts / 65
// relief appearances. Read live from the player's MLB regular-season game log,
// his whole career in one request. A window
// runs across seasons, as the card's does (Yelich: 7/15/2018 to 7/27/2019).
// Not a scoring surface, so nothing is sealed (ADR-0034).

import { getJson } from '../statsapi.js'

const BAT = ['atBats', 'plateAppearances', 'hits', 'doubles', 'triples', 'homeRuns', 'runs', 'rbi', 'baseOnBalls', 'hitByPitch', 'sacFlies', 'stolenBases', 'totalBases', 'strikeOuts']

const PITCH = ['outs', 'earnedRuns', 'hits', 'baseOnBalls', 'hitByPitch', 'strikeOuts', 'homeRuns', 'wins', 'losses', 'saves', 'completeGames', 'shutouts', 'gamesStarted', 'saveOpportunities', 'holds', 'blownSaves', 'gamesFinished', 'inheritedRunners', 'inheritedRunnersScored', 'battersFaced']
const FIELDS = { hitting: BAT, pitching: PITCH }

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
export const era = (t) => perOut(t.earnedRuns * 27, t.outs)
export const whip = (t) => perOut((t.hits + t.baseOnBalls) * 3, t.outs)
export const kRate = (t) => div(t.strikeOuts, t.battersFaced)
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
    mainTeamId: mostCommon(window.map((g) => g.teamId).filter(Boolean)),
    careerGames: sorted.length,
  }
}

// ---- One club only (Club Stretch, and Best Stretch's ?club=). A run counts his games for the
// club, crosses seasons, and ends at a game for another club; a return starts a new run. AVG and
// OPS need 3.1 plate appearances per game (the batting-title rule).
export const PA_PER_GAME = 3.1
const RATES = new Set(['avg', 'ops'])

// Old logs can leave plateAppearances at 0: rebuild it from its parts.
const paOf = (t) => t.plateAppearances || t.atBats + t.baseOnBalls + t.hitByPitch + t.sacFlies

// A measure with the rate floor: a run short of it ranks below every real one.
export function flooredMeasure(m, n) {
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
export const playerBest = (games, teamId, n, measure) => bestInStints(stintsFor(games, teamId), n, measure)

// The same over stints already split, so a caller ranking many stats splits them once.
export function bestInStints(stints, n, measure) {
  const m = flooredMeasure(measure, n)
  let best = null
  for (const stint of stints) {
    const b = bestStretch(stint, n, m)
    if (b && b.value !== -Infinity && (!best || b.value > best.value)) best = b
  }
  return best
}

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

// The seasons to ask for: MLB debut through the last game played (an active player has no
// lastPlayedDate yet, so through this year). No debut is no MLB games: nothing to ask for.
export function careerSeasons(person, thisYear) {
  const from = Number(person?.mlbDebutDate?.slice(0, 4))
  if (!from) return []
  const to = Number(person.lastPlayedDate?.slice(0, 4)) || thisYear
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)
}

// The player's whole MLB regular-season log for one group ('hitting' or 'pitching'),
// ONE SEASON PER CALL, four at a time. A career's log in a single call can take the feed
// 40 s to build for a player it has not cached; season by season the same games take about
// a second (measured 2026-11-16, scripts/franchise/gen-club-stretch.mjs). { name, games }.
export async function loadCareerLog(playerId, signal, group = 'hitting') {
  const p = await getJson(`/api/v1/people/${playerId}?fields=people,fullName,mlbDebutDate,lastPlayedDate`, { signal })
  const person = p.people?.[0]
  const seasons = careerSeasons(person, new Date().getFullYear())
  const logs = []
  for (let i = 0; i < seasons.length; i += 4) {
    logs.push(...(await Promise.all(seasons.slice(i, i + 4).map((y) =>
      getJson(`/api/v1/people/${playerId}/stats?stats=gameLog&group=${group}&sportId=1&gameType=R&season=${y}`, { signal })
        .then((d) => d.stats?.[0]?.splits ?? [])))))
  }
  return { name: person?.fullName ?? '', games: logs.flat().map((x) => toGame(x, group)) }
}
