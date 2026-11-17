// The /research filter model (#2234): one definition per chip card, a predicate per
// card over a decoded plate appearance (shard.js), and the URL format that carries
// a query. One model, one URL, so a shared link or a callout deep link rebuilds the
// same answer.
//
// WHICH PITCH A PITCH FILTER READS. Pitch type and horizontal location test the LAST
// pitch of the plate appearance, the one the result came on ("a home run off a
// sinker on the inner third"). Count is the one pitch-level question: a PA matches
// a count if any of its pitches was thrown in it ("passed through 0-2").
//
// DEFINITIONS (Gary, 2026-11-02, decision 7; also docs/research-store.md):
//   Inner third  the third of the 17-inch plate nearest the batter, from plate_x
//                (catcher's view, + toward first base), flipped by the batter's side.
//                A pitch off the plate is in no third.
//   Opp field    a spray angle more than 15 degrees from center toward the batter's
//                opposite side, from hc_x/hc_y in Savant's frame. Pull is the mirror;
//                center is within 15 degrees.
// More cards (#3140, Gary 2026-11-16): Score, Moment, Batted ball, Batting slot, Month,
// Home or road, and the Count card's batter ahead / even / behind (read off the LAST
// pitch's count, not passed through: every PA passes through 0-0).
//   Moment       read from the batting club's margin before and after the PA's last
//                pitch. A run that scores with no PA (a wild pitch walk-off) is not found.
// A card with `v` needs that store version (shard.js VERSIONS); a season built earlier
// blocks it, like `since`.
//
// SPOILER CLASSIFICATION: spoiler-free. Pure functions over the store.

import { PITCH_TYPES } from '../../lib/pitch/pitchTypes.js'
import { countBit } from './shard.js'
import { ordinal } from '../../lib/format.js'
import { monthName } from '../../lib/time/months.js'
import { seriesValues } from './series.js'
import { HISTORY_LAST } from './history.js'
import { ALL_MLB_TEAM_IDS, teamAbbr, teamFullName } from '../../lib/teams.js'

// Savant's club codes are the app's own abbreviations (all 30 matched on 2026-11-13),
// so a code finds its full name through teams.js. An unknown code shows as itself.
const CLUB_NAMES = Object.fromEntries(ALL_MLB_TEAM_IDS.map((id) => [teamAbbr({ id }), teamFullName(id)]))
export const clubName = (code) => CLUB_NAMES[code] ?? code

const HALF_PLATE = 17 / 12 / 2
const THIRD = (17 / 12) / 3
// Savant's hc frame: home plate sits at (125.42, 198.27); y grows toward the plate.
const HOME_X = 125.42
const HOME_Y = 198.27
const FIELD_SPLIT_DEG = 15

// 'inner' | 'middle' | 'outer' | null, for a plate_x and a batter side.
export function horizontalThird(px, stand) {
  if (px == null || Math.abs(px) > HALF_PLATE) return null
  // A right-handed batter stands on the third-base side: negative plate_x.
  const towardBatter = stand === 'R' ? -px : px
  if (towardBatter > HALF_PLATE - THIRD) return 'inner'
  if (towardBatter < -HALF_PLATE + THIRD) return 'outer'
  return 'middle'
}

// Spray angle in degrees, + toward right field, or null with no landing point.
export function sprayAngle(hcX, hcY) {
  if (hcX == null || hcY == null) return null
  return (Math.atan2(hcX - HOME_X, HOME_Y - hcY) * 180) / Math.PI
}

// 'pull' | 'center' | 'oppo' | null.
export function fieldOf(hcX, hcY, stand) {
  const a = sprayAngle(hcX, hcY)
  if (a == null) return null
  const toward = stand === 'R' ? a : -a // + toward the batter's opposite field
  if (toward > FIELD_SPLIT_DEG) return 'oppo'
  if (toward < -FIELD_SPLIT_DEG) return 'pull'
  return 'center'
}

const RESULTS = [
  ['home_run', 'Home run'],
  ['triple', 'Triple'],
  ['double', 'Double'],
  ['single', 'Single'],
  ['walk', 'Walk'],
  ['intent_walk', 'Intentional walk'],
  ['hit_by_pitch', 'Hit by pitch'],
  ['strikeout', 'Strikeout'],
  ['field_out', 'Out in play'],
  ['grounded_into_double_play', 'GIDP'],
  ['double_play', 'Double play'],
  ['triple_play', 'Triple play'],
  ['force_out', 'Force out'],
  ['fielders_choice', "Fielder's choice"],
  ['field_error', 'Reached on error'],
  ['sac_fly', 'Sac fly'],
  ['sac_bunt', 'Sac bunt'],
  ['catcher_interf', 'Catcher interference'],
]
const RESULT_GROUPS = { strikeout: ['strikeout', 'strikeout_double_play'], sac_fly: ['sac_fly', 'sac_fly_double_play'], fielders_choice: ['fielders_choice', 'fielders_choice_out'] }

// The count the last pitch came in, from the batter's side. 3-2 is in no group.
export function countGroup([b, s] = []) {
  if (!Number.isInteger(b) || !Number.isInteger(s) || (b === 3 && s === 2)) return null
  return b > s ? 'ahead' : b === s ? 'even' : 'behind'
}
const COUNT_GROUPS = [['ahead', 'Batter ahead'], ['even', 'Even'], ['behind', 'Batter behind']]

// The batting club's margin as the Score card reads it: ['tied'] or ['ahead', 'up2'].
export function scoreValues(m) {
  if (m == null) return []
  if (m === 0) return ['tied']
  const by = Math.min(Math.abs(m), 3)
  return m > 0 ? ['ahead', `up${by}`] : ['behind', `down${by}`]
}
const SCORES = [['tied', 'Tied'], ['ahead', 'Ahead'], ['behind', 'Behind'], ['up1', 'Up 1'], ['up2', 'Up 2'], ['up3', 'Up 3+'], ['down1', 'Down 1'], ['down2', 'Down 2'], ['down3', 'Down 3+']]

// The moments a PA's last pitch made: 'walkoff', 'ahead', 'tie', plus 'first' / 'last'.
export function momentValues(pa) {
  const out = []
  const { marginLast: before, marginAfter: after } = pa
  if (before != null && after != null) {
    if (before <= 0 && after > 0) out.push('ahead')
    if (before <= 0 && after > 0 && !pa.top && pa.last) out.push('walkoff')
    if (before < 0 && after === 0) out.push('tie')
  }
  if (pa.first) out.push('first')
  if (pa.last) out.push('last')
  return out
}
const MOMENTS = [['walkoff', 'Walk-off'], ['ahead', 'Go-ahead'], ['tie', 'Tying'], ['first', 'First PA of the game'], ['last', 'Last PA of the game']]
const BB_TYPES = [['ground_ball', 'Ground ball'], ['line_drive', 'Line drive'], ['fly_ball', 'Fly ball'], ['popup', 'Popup']]
const MONTHS = ['03', '04', '05', '06', '07', '08', '09', '10', '11'].map((m) => [m, monthName(Number(m) - 1)])

// The Series game card (#3141): values from series.js `seriesValues`.
const SERIES_GAMES = [...[1, 2, 3, 4, 5, 6, 7].map((n) => [`g${n}`, `Game ${n}`]), ['last', 'Series-deciding'], ['sd', 'Sudden death'], ['clinch', 'Potential clinch'], ['elim', 'Potential elimination']]

const COUNTS = ['0-0', '0-1', '0-2', '1-0', '1-1', '1-2', '2-0', '2-1', '2-2', '3-0', '3-1', '3-2']
// Runners: one value per base state, the bases spelled in order ('1-3' = first and
// third). The card draws each as the scorebug's BaseState. The four values the first
// slice used still parse (LEGACY_RUNNERS), so an old link keeps its meaning.
const RUNNER_STATES = [
  ['---', 'Bases empty'],
  ['1--', 'Runner on 1st'],
  ['-2-', 'Runner on 2nd'],
  ['--3', 'Runner on 3rd'],
  ['12-', '1st and 2nd'],
  ['1-3', '1st and 3rd'],
  ['-23', '2nd and 3rd'],
  ['123', 'Bases loaded'],
]
const runnersTag = (r) => `${r & 1 ? '1' : '-'}${r & 2 ? '2' : '-'}${r & 4 ? '3' : '-'}`
const LEGACY_RUNNERS = { empty: ['---'], first: ['1--'], risp: ['-2-', '--3', '12-', '1-3', '-23'], loaded: ['123'] }

// '1-3' -> { first, second, third }, for BaseState.
export const basesOf = (v) => ({ first: v[0] === '1', second: v[1] === '2', third: v[2] === '3' })

// Each card: key (URL), label, options [[value, label]], test(pa) -> the PA's value(s),
// `since` the first season the card can answer (the coverage line), and `multi`.
// A multi card matches if any selected value is among the PA's values; Invert flips it.
// `only` (optional) bounds a card, Invert included: an inverted Series game chip reads
// postseason series games, never the regular season.
export const FILTERS = [
  { key: 'res', label: 'PA result', options: RESULTS, values: (pa) => [Object.keys(RESULT_GROUPS).find((k) => RESULT_GROUPS[k].includes(pa.event)) ?? pa.event] },
  { key: 'gt', label: 'Game type', options: [['R', 'Regular season'], ['P', 'Postseason'], ['A', 'All-Star']], values: (pa) => [pa.gameType === 'R' || pa.gameType === 'A' ? pa.gameType : 'P'] },
  { key: 'sg', label: 'Series game', options: SERIES_GAMES, values: seriesValues, only: (pa) => pa.series != null, info: 'Postseason games. Potential clinch: the batting club takes the series with a win. Potential elimination: the batting club is out with a loss. Sudden death: both clubs one win from taking it. Series-deciding: the game the series ended in.' },
  { key: 'pt', label: 'Pitch type', options: PITCH_TYPES.map((p) => [p.code, p.name]), values: (pa) => [pa.pitchType], since: 2015 },
  { key: 'loc', label: 'Horizontal location', options: [['inner', 'Inner third'], ['middle', 'Middle third'], ['outer', 'Outer third']], values: (pa) => [horizontalThird(pa.px, pa.stand)], since: 2015, info: 'Thirds of the 17-inch plate, from the batter’s side. Inner third is the third nearest the batter. A pitch off the plate is in no third. Reads the last pitch of the plate appearance.' },
  { key: 'fld', label: 'Batted ball location', options: [['pull', 'Pull'], ['center', 'Center'], ['oppo', 'Opp field']], values: (pa) => [fieldOf(pa.hcX, pa.hcY, pa.stand)], since: 2015, info: 'Opp field is a ball hit more than 15° from center toward the batter’s opposite side. Pull is the mirror. Center is within 15°.' },
  { key: 'bh', label: 'Batter hand', single: true, options: [['L', 'Lefty'], ['R', 'Righty']], values: (pa) => [pa.stand] },
  { key: 'ph', label: 'Pitcher hand', single: true, options: [['L', 'Lefty'], ['R', 'Righty']], values: (pa) => [pa.throws] },
  { key: 'cnt', label: 'Count', options: [...COUNT_GROUPS, ...COUNTS.map((c) => [c, c])], values: (pa) => [countGroup(pa.count), ...COUNTS.filter((c) => pa.counts & countBit(Number(c[0]), Number(c[2])))], info: 'A count matches a plate appearance that passed through it on any pitch. Batter ahead, Even and Batter behind read the count of the last pitch instead: ahead is 1-0, 2-0, 3-0, 2-1 or 3-1; even is 0-0, 1-1 or 2-2; behind is 0-1, 0-2 or 1-2. A full count is in none. Before 1988, most plate appearances have no pitch-by-pitch record, so a count finds few of them.' },
  { key: 'out', label: 'Outs', options: [['0', '0 out'], ['1', '1 out'], ['2', '2 out']], values: (pa) => [String(pa.outs)] },
  { key: 'run', label: 'Runners', glyphs: true, options: RUNNER_STATES, values: (pa) => [runnersTag(pa.runners)] },
  { key: 'sc', label: 'Score', options: SCORES, values: (pa) => scoreValues(pa.margin), info: 'The batting club’s margin when the plate appearance began. Up 3+ and Down 3+ are three runs or more.' },
  { key: 'mom', label: 'Moment', options: MOMENTS, values: momentValues, v: 2, info: 'Read from the batting club’s margin before and after the last pitch of the plate appearance. Go-ahead puts the club in front from tied or behind; walk-off is a go-ahead in the bottom half that ends the game. A run that scores with no plate appearance, such as a wild pitch walk-off, is not found. Before 2015, a run that scores between plate appearances counts toward the one before it.' },
  { key: 'bb', label: 'Batted ball type', options: BB_TYPES, values: (pa) => [pa.bbType], since: 2015, v: 2, info: 'Statcast’s batted-ball type for the ball put in play.' },
  { key: 'slot', label: 'Batting slot', options: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [String(n), `Batting ${ordinal(n)}`]), values: (pa) => [pa.slot == null ? null : String(pa.slot)], v: 2, info: 'The batter’s spot in the order, from the MLB box score. A pinch hitter counts in the slot they batted in.' },
  { key: 'mon', label: 'Month', options: MONTHS, values: (pa) => [pa.date.slice(5, 7)] },
  { key: 'ha', label: 'Home or road', single: true, options: [['H', 'Home'], ['R', 'Road']], values: (pa) => [pa.top ? 'R' : 'H'], info: 'Whether the batting club is at home.' },
  { key: 'inn', label: 'Inning', options: [...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => [String(i), `${i}`]), ['x', 'Extras']], values: (pa) => [pa.inning > 9 ? 'x' : String(pa.inning)] },
]

export const FILTER_BY_KEY = Object.fromEntries(FILTERS.map((f) => [f.key, f]))

// An event's name as the PA result card groups it (fielders_choice_out reads
// "Fielder's choice"), for the outcome table and the match rows.
const RESULT_NAMES = Object.fromEntries(RESULTS)
export function resultName(event) {
  const key = FILTER_BY_KEY.res.values({ event })[0]
  return RESULT_NAMES[key] ?? key.replaceAll('_', ' ')
}

// Parse / build the URL. A multi card is `res=home_run.double`, inverted `res=!home_run`.
// People and clubs: `bat`, `pit` (ids), `team` (batting club), `pteam` (pitching club),
// `park` (home club). Seasons: `yr=2019` or `yr=2015-2019` (the Seasons card), oldest first.
export function parseQuery(search) {
  const p = new URLSearchParams(search)
  const chips = {}
  for (const f of FILTERS) {
    const raw = p.get(f.key)
    if (!raw) continue
    const inv = raw.startsWith('!')
    const parts = (inv ? raw.slice(1) : raw).split('.')
    const expanded = f.key === 'run' ? [...new Set(parts.flatMap((v) => LEGACY_RUNNERS[v] ?? [v]))] : parts
    const vals = expanded.filter((v) => f.options.some(([o]) => o === v))
    if (vals.length) chips[f.key] = { vals, inv: inv && !f.single }
  }
  const id = (k) => (/^\d+$/.test(p.get(k) ?? '') ? Number(p.get(k)) : null)
  const club = (k) => (/^[A-Z]{2,3}$/.test(p.get(k) ?? '') ? p.get(k) : null)
  const yr = /^(\d{4})(?:-(\d{4}))?$/.exec(p.get('yr') ?? '')
  const years = yr ? [Number(yr[1]), Number(yr[2] ?? yr[1])].sort((a, b) => a - b) : null
  // "Who most" ranking (#3147): `rank=rate` and its PA minimum `min` (50 when absent).
  const min = parseMin(p.get('min')) ?? RATE_MIN
  return { chips, years, batter: id('bat'), pitcher: id('pit'), team: club('team'), pitchTeam: club('pteam'), park: club('park'), ask: ASKS.some((a) => a.key === p.get('ask')) ? p.get('ask') : 'last', rank: p.get('rank') === 'rate' ? 'rate' : 'count', min }
}

export function buildQuery(q, keep = {}) {
  const p = new URLSearchParams()
  if (q.ask && q.ask !== 'last') p.set('ask', q.ask)
  for (const f of FILTERS) {
    const c = q.chips?.[f.key]
    if (c?.vals?.length) p.set(f.key, `${c.inv ? '!' : ''}${c.vals.join('.')}`)
  }
  if (q.years) p.set('yr', q.years[0] === q.years[1] ? `${q.years[0]}` : q.years.join('-'))
  if (q.batter) p.set('bat', q.batter)
  if (q.pitcher) p.set('pit', q.pitcher)
  if (q.team) p.set('team', q.team)
  if (q.pitchTeam) p.set('pteam', q.pitchTeam)
  if (q.park) p.set('park', q.park)
  if (q.rank === 'rate') p.set('rank', 'rate')
  if (q.rank === 'rate' && q.min && q.min !== RATE_MIN) p.set('min', q.min)
  for (const [k, v] of Object.entries(keep)) if (v) p.set(k, v)
  const s = p.toString()
  return s ? `?${s}` : ''
}

// "Who most" by rate drops a player under this many PAs in the situation (#3147).
export const RATE_MIN = 50
// A PA minimum as typed or in the URL: a whole number above 0, else null.
export const parseMin = (v) => (/^\d+$/.test(v ?? '') && Number(v) > 0 ? Number(v) : null)

export const ASKS = [
  { key: 'last', label: 'Last time' },
  { key: 'often', label: 'How often' },
  { key: 'most', label: 'Who most' },
  { key: 'what', label: 'What happens' },
]

// The query as the search reads it: the "Who most" rank and minimum only re-rank the
// answer on the page, so changing them never re-runs a search or resets the match list.
export const searchKey = ({ rank, min, ...q }) => JSON.stringify(q) // eslint-disable-line no-unused-vars

// The query is blank: no chip, person or club. The page shows presets, not an answer.
export const isBlank = (q) => !Object.values(q.chips ?? {}).some((c) => c.vals.length) && !q.batter && !q.pitcher && !q.team && !q.pitchTeam && !q.park

// The predicate for a whole query. `cutoff` ('YYYY-MM-DD', optional) holds out that day and later.
export function matcher(q, cutoff) {
  // A card with nothing picked stays on screen until its ✕, and filters nothing.
  const tests = Object.entries(q.chips ?? {}).filter(([, c]) => c.vals.length).map(([k, c]) => {
    const f = FILTER_BY_KEY[k]
    const want = new Set(c.vals)
    const hit = (pa) => f.values(pa).some((v) => want.has(v)) !== Boolean(c.inv)
    return f.only ? (pa) => f.only(pa) && hit(pa) : hit
  })
  // An All-Star PA (#3141) counts only when the Game type card picks All-Star, so a default
  // count or leader board stays official games.
  const gt = q.chips?.gt
  if (!(gt && !gt.inv && gt.vals.includes('A'))) tests.push((pa) => pa.gameType !== 'A')
  if (q.batter) tests.push((pa) => pa.batter === q.batter)
  if (q.pitcher) tests.push((pa) => pa.pitcher === q.pitcher)
  if (q.team) tests.push((pa) => pa.batTeam === q.team)
  if (q.pitchTeam) tests.push((pa) => pa.fieldTeam === q.pitchTeam)
  if (q.park) tests.push((pa) => pa.home === q.park)
  if (cutoff) tests.push((pa) => pa.date < cutoff)
  return (pa) => tests.every((t) => t(pa))
}

// Cards a season range cannot answer: [{ key, label, since }], or { key, label, rebuild:
// true } for a card whose store version (`v`) a searched season was not built with yet.
// `version`: the lowest store version among the searched seasons (store.js storeVersion).
export function unsupported(firstSeason, version = Infinity) {
  return FILTERS.filter((f) => (f.since && firstSeason < f.since) || (f.v && version < f.v)).map(({ key, label, since }) =>
    since && firstSeason < since ? { key, label, since } : { key, label, rebuild: true },
  )
}

// THE SEASONS A QUERY SEARCHES (Gary, 2026-11-13, scope #2), newest first. `seasons`: the
// seasons on file. A season after `?d=`'s year is out. With a Seasons range, its seasons.
// Without one, "Last time" searches every season (newest first, until Stop) and the other
// three questions read the latest season, so a rate or a leader board is one season's.
// The history seasons (1961-2014) are searched only by a range that reaches them (Gary,
// 2026-11-17, #3150): an open "Last time" stays on the Savant seasons.
export function seasonsFor(q, seasons, cutoff) {
  const open = seasons.filter((s) => !cutoff || s <= Number(cutoff.slice(0, 4))).sort((a, b) => b - a)
  if (q.years) return open.filter((s) => s >= q.years[0] && s <= q.years[1])
  const recent = open.filter((s) => s > HISTORY_LAST)
  return q.ask === 'last' ? recent : recent.slice(0, 1)
}

// Can `season` hold a match? Only a PA result card answers from the index alone: with
// result counts on file (`events`, { event: n }) and none of the picked results among
// them, the season is skipped unfetched. No counts (an older index) means maybe.
export function mayMatch(q, events) {
  const res = q.chips?.res
  if (!events || !res?.vals.length || res.inv) return true
  return Object.entries(events).some(([ev, n]) => n > 0 && res.vals.includes(FILTER_BY_KEY.res.values({ event: ev })[0]))
}
