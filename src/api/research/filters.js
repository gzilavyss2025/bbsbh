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
//
// SPOILER CLASSIFICATION: spoiler-free. Pure functions over the store.

import { PITCH_TYPES } from '../../lib/pitch/pitchTypes.js'
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

const lastPitch = (pa) => pa.pitches[pa.pitches.length - 1]
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
export const FILTERS = [
  { key: 'res', label: 'PA result', options: RESULTS, values: (pa) => [Object.keys(RESULT_GROUPS).find((k) => RESULT_GROUPS[k].includes(pa.event)) ?? pa.event] },
  { key: 'gt', label: 'Game type', options: [['R', 'Regular season'], ['P', 'Postseason']], values: (pa) => [pa.gameType === 'R' ? 'R' : 'P'] },
  { key: 'pt', label: 'Pitch type', options: PITCH_TYPES.map((p) => [p.code, p.name]), values: (pa) => [lastPitch(pa).type], since: 2008 },
  { key: 'loc', label: 'Horizontal location', options: [['inner', 'Inner third'], ['middle', 'Middle third'], ['outer', 'Outer third']], values: (pa) => [horizontalThird(lastPitch(pa).px, pa.stand)], since: 2008, info: 'Thirds of the 17-inch plate, from the batter’s side. Inner third is the third nearest the batter. A pitch off the plate is in no third. Reads the last pitch of the plate appearance.' },
  { key: 'fld', label: 'Batted ball location', options: [['pull', 'Pull'], ['center', 'Center'], ['oppo', 'Opp field']], values: (pa) => [fieldOf(pa.hcX, pa.hcY, pa.stand)], since: 2008, info: 'Opp field is a ball hit more than 15° from center toward the batter’s opposite side. Pull is the mirror. Center is within 15°.' },
  { key: 'bh', label: 'Batter hand', single: true, options: [['L', 'Lefty'], ['R', 'Righty']], values: (pa) => [pa.stand] },
  { key: 'ph', label: 'Pitcher hand', single: true, options: [['L', 'Lefty'], ['R', 'Righty']], values: (pa) => [pa.throws] },
  { key: 'cnt', label: 'Count (passed through)', options: ['0-0', '0-1', '0-2', '1-0', '1-1', '1-2', '2-0', '2-1', '2-2', '3-0', '3-1', '3-2'].map((c) => [c, c]), values: (pa) => pa.pitches.map((p) => `${p.balls}-${p.strikes}`) },
  { key: 'out', label: 'Outs', options: [['0', '0 out'], ['1', '1 out'], ['2', '2 out']], values: (pa) => [String(pa.outs)] },
  { key: 'run', label: 'Runners', glyphs: true, options: RUNNER_STATES, values: (pa) => [runnersTag(pa.runners)] },
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
// `park` (home club).
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
  return { chips, batter: id('bat'), pitcher: id('pit'), team: club('team'), pitchTeam: club('pteam'), park: club('park'), ask: ASKS.some((a) => a.key === p.get('ask')) ? p.get('ask') : 'last' }
}

export function buildQuery(q, keep = {}) {
  const p = new URLSearchParams()
  if (q.ask && q.ask !== 'last') p.set('ask', q.ask)
  for (const f of FILTERS) {
    const c = q.chips?.[f.key]
    if (c?.vals?.length) p.set(f.key, `${c.inv ? '!' : ''}${c.vals.join('.')}`)
  }
  if (q.batter) p.set('bat', q.batter)
  if (q.pitcher) p.set('pit', q.pitcher)
  if (q.team) p.set('team', q.team)
  if (q.pitchTeam) p.set('pteam', q.pitchTeam)
  if (q.park) p.set('park', q.park)
  for (const [k, v] of Object.entries(keep)) if (v) p.set(k, v)
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const ASKS = [
  { key: 'last', label: 'Last time' },
  { key: 'often', label: 'How often' },
  { key: 'most', label: 'Who most' },
  { key: 'what', label: 'What happens' },
]

// The query is blank: no chip, person or club. The page shows presets, not an answer.
export const isBlank = (q) => !Object.values(q.chips ?? {}).some((c) => c.vals.length) && !q.batter && !q.pitcher && !q.team && !q.pitchTeam && !q.park

// The predicate for a whole query. `cutoff` ('YYYY-MM-DD', optional) holds out that day and later.
export function matcher(q, cutoff) {
  // A card with nothing picked stays on screen until its ✕, and filters nothing.
  const tests = Object.entries(q.chips ?? {}).filter(([, c]) => c.vals.length).map(([k, c]) => {
    const f = FILTER_BY_KEY[k]
    const want = new Set(c.vals)
    return (pa) => f.values(pa).some((v) => want.has(v)) !== Boolean(c.inv)
  })
  if (q.batter) tests.push((pa) => pa.batter === q.batter)
  if (q.pitcher) tests.push((pa) => pa.pitcher === q.pitcher)
  if (q.team) tests.push((pa) => pa.batTeam === q.team)
  if (q.pitchTeam) tests.push((pa) => pa.fieldTeam === q.pitchTeam)
  if (q.park) tests.push((pa) => pa.home === q.park)
  if (cutoff) tests.push((pa) => pa.date < cutoff)
  return (pa) => tests.every((t) => t(pa))
}

// Cards a season range cannot answer: [{ key, label, since }].
export function unsupported(firstSeason) {
  return FILTERS.filter((f) => f.since && firstSeason < f.since).map(({ key, label, since }) => ({ key, label, since }))
}
