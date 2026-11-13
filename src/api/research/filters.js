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
const runnersTag = (r) => (r === 0 ? 'empty' : r === 7 ? 'loaded' : r & 6 ? 'risp' : 'first')

// Each card: key (URL), label, options [[value, label]], test(pa) -> the PA's value(s),
// `since` the first season the card can answer (the coverage line), and `multi`.
// A multi card matches if any selected value is among the PA's values; Invert flips it.
export const FILTERS = [
  { key: 'res', label: 'PA result', options: RESULTS, values: (pa) => [Object.keys(RESULT_GROUPS).find((k) => RESULT_GROUPS[k].includes(pa.event)) ?? pa.event] },
  { key: 'gt', label: 'Game type', options: [['R', 'Regular season'], ['P', 'Postseason']], values: (pa) => [pa.gameType === 'R' ? 'R' : 'P'] },
  { key: 'pt', label: 'Pitch type', options: PITCH_TYPES.map((p) => [p.code, p.name]), values: (pa) => [lastPitch(pa).type], since: 2008 },
  { key: 'loc', label: 'Horizontal location', options: [['inner', 'Inner third'], ['middle', 'Middle third'], ['outer', 'Outer third']], values: (pa) => [horizontalThird(lastPitch(pa).px, pa.stand)], since: 2008 },
  { key: 'fld', label: 'Batted ball location', options: [['pull', 'Pull'], ['center', 'Center'], ['oppo', 'Opp field']], values: (pa) => [fieldOf(pa.hcX, pa.hcY, pa.stand)], since: 2008 },
  { key: 'bh', label: 'Batter hand', single: true, options: [['L', 'Lefty'], ['R', 'Righty']], values: (pa) => [pa.stand] },
  { key: 'ph', label: 'Pitcher hand', single: true, options: [['L', 'Lefty'], ['R', 'Righty']], values: (pa) => [pa.throws] },
  { key: 'cnt', label: 'Count (passed through)', options: ['0-0', '0-1', '0-2', '1-0', '1-1', '1-2', '2-0', '2-1', '2-2', '3-0', '3-1', '3-2'].map((c) => [c, c]), values: (pa) => pa.pitches.map((p) => `${p.balls}-${p.strikes}`) },
  { key: 'out', label: 'Outs', options: [['0', '0 out'], ['1', '1 out'], ['2', '2 out']], values: (pa) => [String(pa.outs)] },
  { key: 'run', label: 'Runners', options: [['empty', 'Bases empty'], ['first', 'Runner on 1st only'], ['risp', 'Scoring position'], ['loaded', 'Loaded']], values: (pa) => [runnersTag(pa.runners)] },
  { key: 'inn', label: 'Inning', options: [...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => [String(i), `${i}`]), ['x', 'Extras']], values: (pa) => [pa.inning > 9 ? 'x' : String(pa.inning)] },
]

export const FILTER_BY_KEY = Object.fromEntries(FILTERS.map((f) => [f.key, f]))

// Parse / build the URL. A multi card is `res=home_run.double`, inverted `res=!home_run`.
// People and clubs: `bat`, `pit` (ids), `team` (batting club), `park` (home club).
export function parseQuery(search) {
  const p = new URLSearchParams(search)
  const chips = {}
  for (const f of FILTERS) {
    const raw = p.get(f.key)
    if (!raw) continue
    const inv = raw.startsWith('!')
    const vals = (inv ? raw.slice(1) : raw).split('.').filter((v) => f.options.some(([o]) => o === v))
    if (vals.length) chips[f.key] = { vals, inv: inv && !f.single }
  }
  const id = (k) => (/^\d+$/.test(p.get(k) ?? '') ? Number(p.get(k)) : null)
  const club = (k) => (/^[A-Z]{2,3}$/.test(p.get(k) ?? '') ? p.get(k) : null)
  return { chips, batter: id('bat'), pitcher: id('pit'), team: club('team'), park: club('park'), ask: ASKS.some((a) => a.key === p.get('ask')) ? p.get('ask') : 'last' }
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
  if (q.park) p.set('park', q.park)
  for (const [k, v] of Object.entries(keep)) if (v) p.set(k, v)
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const ASKS = [
  { key: 'last', label: 'When did this last happen?' },
  { key: 'often', label: 'How often does it happen?' },
  { key: 'most', label: 'Who does it most?' },
  { key: 'what', label: 'What happens when…?' },
]

// The predicate for a whole query. `cutoff` ('YYYY-MM-DD', optional) holds out that day and later.
export function matcher(q, cutoff) {
  const tests = Object.entries(q.chips ?? {}).map(([k, c]) => {
    const f = FILTER_BY_KEY[k]
    const want = new Set(c.vals)
    return (pa) => f.values(pa).some((v) => want.has(v)) !== Boolean(c.inv)
  })
  if (q.batter) tests.push((pa) => pa.batter === q.batter)
  if (q.pitcher) tests.push((pa) => pa.pitcher === q.pitcher)
  if (q.team) tests.push((pa) => pa.batTeam === q.team)
  if (q.park) tests.push((pa) => pa.home === q.park)
  if (cutoff) tests.push((pa) => pa.date < cutoff)
  return (pa) => tests.every((t) => t(pa))
}

// Cards a season range cannot answer: [{ key, label, since }].
export function unsupported(firstSeason) {
  return FILTERS.filter((f) => f.since && firstSeason < f.since).map(({ key, label, since }) => ({ key, label, since }))
}
