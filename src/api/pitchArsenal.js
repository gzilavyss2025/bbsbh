import { similarPitchers } from '../lib/pitcherSimilarity.js'
import { shardKey100 } from '../lib/shardKey.js'

// Season pitch-type mix per pitcher, read from static same-origin files
// precomputed nightly by
// scripts/gen-pitch-arsenal.mjs (the build-time-fetch pattern — see
// src/api/CLAUDE.md and war.js). Pitch mix isn't pre-totaled anywhere in the
// API, so the generator sweeps completed games' play-by-play; this module
// just reads the shaped file and derives view models.
//
// Spoiler note: this is a COMPLETED-GAME season aggregate — pitch counts from
// games already Final — so it carries no live game's score, on the same
// footing as war.js / savantPercentiles.js. Spoiler-FREE, no SealBox needed;
// renders pregame on TeamInfo's OpposingStarterCard.
//
// MLB + AAA only (`mlb`/`aaa` keys) — AA and below carry no Hawk-Eye
// pitch-type tracking, so a MiLB-below-AAA starter just gets an empty list,
// same graceful degradation as everywhere else in the app.
//
// TWO SHAPES, because the two readers want opposite things and the one file
// that served both cost 692 KB either way (cached in-memory for the session —
// the files change once a day):
//
//   • ONE PITCHER, everything about him — the opposing-starter card's mix bar.
//     public/data/pitch-arsenal/{NN}.json, bucketed on `personId % 100`
//     (shardKey100, the same join the rookie records use). ~12 KB.
//   • THE WHOLE LEVEL, slimmed — the player page's "Pitches like" card, which
//     ranks a man against every arm at his level and so genuinely needs a pool.
//     public/data/pitch-arsenal-pool/{mlb,aaa}.json: ONE level (an MLB arm is
//     never compared to a AAA arm), only arms past the similarity floor (an arm
//     under it can never be a candidate), and no `description` strings (the
//     ranking reads codes). 149 KB for MLB, 194 KB for AAA.
const shards = new Map()

export async function fetchPitchArsenalFor(personId) {
  if (personId == null) return null
  const key = shardKey100(personId)
  if (!shards.has(key)) {
    shards.set(
      key,
      fetch(`/data/pitch-arsenal/${key}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    )
  }
  return shards.get(key)
}

const pools = new Map()

export async function fetchPitchArsenalPool(isMlb) {
  const level = isMlb ? 'mlb' : 'aaa'
  if (!pools.has(level)) {
    pools.set(
      level,
      fetch(`/data/pitch-arsenal-pool/${level}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    )
  }
  return pools.get(level)
}

// A minimum sample so a two-pitch relief cameo doesn't render a misleadingly
// confident-looking mix — the same idea as the foul tracker's qualifier
// floors (src/api/fouls.js).
export const MIN_ARSENAL_PITCHES = 15

// The two velocity bars the "century club" / veloVariety / veloPeak callout
// families (src/api/pitcherHealth.js, pitcher-callouts.js,
// callout-notes/liveAtBat.js, scripts/gen-pitch-arsenal.mjs) all share, so
// the numbers live once. CENTURY_MPH is the floor a pitch has to clear to
// count at all; ELITE_VELO_MPH is the higher bar a single pitch has to clear
// on its own (regardless of season-high) to earn a standalone spotlight —
// set a couple mph above the century floor since 100-101 is unremarkable for
// a real flamethrower, while 102+ still isn't.
export const CENTURY_MPH = 100
export const ELITE_VELO_MPH = 102

// One pitcher's pitch-type mix for the level the game he's starting is being
// played at, each entry carrying its share of pitches thrown + average
// velocity, sorted most-thrown first. Each entry also carries `century`
// (pitches at CENTURY_MPH+ this season) and `maxVelo` (his fastest of that
// type) straight from the generator — the century-club/veloPeak callout
// families read those off gen-callouts.mjs's own join, not through here, but
// they ride along on this same file since they're gathered by the same sweep.
// Null when the file hasn't loaded, he isn't in it (no MLB/AAA innings logged
// this season), or his sample is below the qualifier floor (e.g. a September
// call-up with three pitches on file) — the card simply doesn't render.
export function pitchArsenalFor(data, personId, isMlb) {
  const entry = data?.pit?.[personId]
  const types = isMlb ? entry?.mlb : entry?.aaa
  if (!types || types.length === 0) return null
  const total = types.reduce((sum, t) => sum + t.pitches, 0)
  if (total < MIN_ARSENAL_PITCHES) return null
  return types
    .map((t) => ({ ...t, pct: Math.round((t.pitches / total) * 1000) / 10 }))
    .sort((a, b) => b.pitches - a.pitches)
}

// "Pitches like" — the closest arms in ARSENAL space to one pitcher, for the
// player page's SimilarPitchers card. The ranking model is pure and lives in
// src/lib/pitcherSimilarity.js; this is only the part that knows how
// pitch-arsenal.json is SHAPED, flattening its per-level entries into the flat
// pool that module ranks.
//
// The pool is the SAME LEVEL as the subject, never both. MLB and AAA are kept
// separate everywhere else this data is used (and in gen-pitch-arsenal.mjs
// itself) because they're different peer pools — a AAA arm's nearest neighbour
// should be another AAA arm, not a big leaguer he happens to resemble. That
// split is now the FILE: the caller picks a level by picking a pool file, and
// this function ranks whatever it is handed.
//
// Spoiler footing is unchanged from the rest of this module: a completed-game
// season aggregate, no SealBox. Returns [] whenever it can't answer — file not
// loaded, subject not in it, or subject under the similarity floor — so the
// card simply doesn't render.
export function similarPitchersFor(data, personId, opts) {
  const entries = data?.pit
  if (!entries) return []
  const pool = []
  for (const [id, entry] of Object.entries(entries)) {
    const types = entry?.types
    if (!types || types.length === 0) continue
    pool.push({
      personId: Number(id),
      name: entry.name ?? '',
      teamId: entry.teamId ?? null,
      throws: entry.throws,
      types,
    })
  }
  return similarPitchers(pool, personId, opts)
}

// Coarse pitch family for the mix bar's color coding (tokens/colors.css's
// --arsenal-fastball/--breaking/--offspeed/--other) — grouped by what the
// pitch is FOR, not its raw velocity band, so a slow show-me fastball still
// reads as a fastball. Codes per MLB Stats API's playEvents[].details.type.code.
const PITCH_FAMILY = {
  FF: 'fastball', SI: 'fastball', FC: 'fastball', FA: 'fastball', FT: 'fastball',
  SL: 'breaking', CU: 'breaking', KC: 'breaking', ST: 'breaking', SV: 'breaking', SC: 'breaking',
  CH: 'offspeed', FS: 'offspeed', FO: 'offspeed', SF: 'offspeed',
}

export function pitchFamily(code) {
  return PITCH_FAMILY[code] ?? 'other'
}
