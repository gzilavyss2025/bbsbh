import { pitchFamily, pitchLabel } from '../../api/pitchArsenal.js'
import { gamePath } from '../route.js'
import { SPORT_LABEL } from '../teams.js'

// The Now Pitching card's view model (#1344): the role rule, the stat rows, the
// pitch tiles and the last-appearance heading. Pure, so `npm test` pins it
// (test/pitcher-card-model.test.js). Every input is spoiler-free: season lines
// that end the day before the game, a last appearance strictly before it, and
// completed-game pitch mixes (ADR-0088).

// The API has no role field. This rule is a design decision, not data:
// starter when he started at least half his games, else closer when his saves
// reach his holds, else setup. An opener with more relief games than starts
// reads as a reliever. Null with no games (a debut).
export function pitcherRole(line) {
  if (!line?.games) return null
  if (line.gamesStarted >= line.games / 2) return 'starter'
  return line.saves >= line.holds ? 'closer' : 'setup'
}

const FIRST = { starter: 'GS', closer: 'G', setup: 'G' }
const DECISION = { starter: 'W-L', closer: 'SV', setup: 'HLD' }

// Seven cells, { label, value }. In the postseason row the decision column is
// a dash: a W, SV or HLD there says how an earlier game of the same series
// ended.
export function seasonCells(role, line, { postseason = false } = {}) {
  const decision = {
    starter: `${line.wins}-${line.losses}`,
    closer: String(line.saves),
    setup: String(line.holds),
  }[role]
  return [
    { label: FIRST[role], value: String(role === 'starter' ? line.gamesStarted : line.games) },
    { label: DECISION[role], value: postseason ? '–' : decision },
    { label: 'ERA', value: line.era || '–' },
    { label: 'IP', value: line.inningsPitched || '–' },
    { label: 'K', value: String(line.strikeOuts) },
    { label: 'BB', value: String(line.baseOnBalls) },
    { label: 'WHIP', value: line.whip || '–' },
  ]
}

const ROUND = { F: 'WC', D: 'DS', L: 'LCS', W: 'WS' }

export function isPostseason(gameType) {
  return Object.hasOwn(ROUND, gameType ?? '')
}

// Only in a postseason game, and only once he has a postseason game before it.
export function showPostseasonRow(gameType, post) {
  return isPostseason(gameType) && (post?.games ?? 0) > 0
}

// The all-time postseason row: in a postseason game, when it covers more games
// than this year's row (so a pitcher with earlier Octobers but none this year
// still gets it). Same rule as the live series page.
export function showCareerRow(gameType, career, post) {
  return isPostseason(gameType) && (career?.games ?? 0) > (post?.games ?? 0)
}

const FOLD_UNDER = 3 // percent

// One tile per pitch, most-thrown first, from pitchArsenalFor's rows. A pitch
// under 3% folds into one "Other" tile, last. Percents are rounded by largest
// remainder so the tiles add to 100; "Other" reads "<1" when its share rounds
// to 0 (Fuentes 2026: a 0.7% curveball). Each tile: { code, name, family,
// pct, mph, velo, other }. `code` is null on "Other".
export function pitchTiles(rows) {
  if (!rows?.length) return []
  const total = rows.reduce((n, r) => n + r.pitches, 0)
  if (!total) return []
  const kept = []
  let otherPitches = 0
  for (const r of rows) {
    if ((r.pitches / total) * 100 < FOLD_UNDER) otherPitches += r.pitches
    else kept.push({ code: r.code, name: pitchLabel(r.code), family: pitchFamily(r.code), pitches: r.pitches, velo: r.avgVelo ?? 0, other: false })
  }
  if (otherPitches > 0) kept.push({ code: null, name: 'Other', family: 'other', pitches: otherPitches, velo: 0, other: true })
  const pcts = largestRemainder(kept.map((t) => (t.pitches / total) * 100))
  return kept.map((t, i) => ({
    code: t.code,
    name: t.name,
    family: t.family,
    pct: t.other && pcts[i] === 0 ? '<1' : String(pcts[i]),
    mph: t.other ? '–' : t.velo.toFixed(1),
    velo: t.velo,
    other: t.other,
  }))
}

// Integer percents that add to 100: floor each, then hand the missing points to
// the largest remainders.
function largestRemainder(shares) {
  const out = shares.map(Math.floor)
  let left = 100 - out.reduce((a, b) => a + b, 0)
  const order = shares.map((s, i) => [s - Math.floor(s), i]).sort((a, b) => b[0] - a[0])
  for (const [, i] of order) {
    if (left <= 0) break
    out[i] += 1
    left -= 1
  }
  return out
}

// 5 tiles or fewer sit in one row; more wrap to two rows of ceil(n / 2).
export function tileColumns(n) {
  return n <= 5 ? n : Math.ceil(n / 2)
}

// Whole days from one YYYY-MM-DD to another, in UTC so no DST edge moves it.
function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
}

// The flag under his name. "Pitched yesterday" for a reliever who pitched the
// day before this game; else "Starter in relief" for a starter by role who
// enters in relief. One flag at most; the first is the fresher fact.
export function entryFlag({ role, relief, last, officialDate }) {
  if (relief && last?.date && officialDate && daysBetween(last.date, officialDate) === 1) return 'Pitched yesterday'
  if (relief && role === 'starter') return 'Starter in relief'
  return null
}

// "4 days' rest" — starters only: full days between his last game and this one.
export function restLabel(role, last, officialDate) {
  if (role !== 'starter' || !last?.date || !officialDate) return ''
  const n = Math.max(0, daysBetween(last.date, officialDate) - 1)
  return n === 1 ? '1 day’s rest' : `${n} days’ rest`
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// The heading's parts for fetchPitcherLastGame's result:
//   when  — "Tue 9/29 vs PHI" (the link text)
//   round — "WC Gm 1" for a postseason game, else ''
//   tag   — the level and/or year when either is not this game's
//   path  — that game's box score
export function lastAppearanceHeading(last, season, sportId = 1) {
  const [y, m, d] = last.date.split('-').map(Number)
  const weekday = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const tag = [
    (last.sportId ?? 1) !== (sportId ?? 1) ? SPORT_LABEL[last.sportId ?? 1] ?? '' : '',
    String(y) !== String(season) ? String(y) : '',
  ]
    .filter(Boolean)
    .join(' ')
  const away = last.home ? last.opponent : last.team
  const home = last.home ? last.team : last.opponent
  return {
    when: `${weekday} ${m}/${d} ${last.home ? 'vs' : '@'} ${last.opponent}`,
    round: ROUND[last.gameType] && last.seriesGameNumber ? `${ROUND[last.gameType]} Gm ${last.seriesGameNumber}` : '',
    tag,
    path: gamePath(last.date, away, home, 'boxscore', last.gameNumber ?? 1),
  }
}

// Eight cells in the box score's order without R/L. No decision.
export function lastAppearanceCells(last) {
  return [
    ['IP', last.inningsPitched || '–'],
    ['P', last.pitches],
    ['BF', last.battersFaced],
    ['H', last.hits],
    ['R', last.runs],
    ['ER', last.earnedRuns],
    ['BB', last.baseOnBalls],
    ['K', last.strikeOuts],
  ].map(([label, value]) => ({ label, value: String(value) }))
}
