import { similarPitchers } from '../lib/pitcherSimilarity.js'

// Season pitch-type mix per pitcher, read from a static same-origin file
// (public/data/pitch-arsenal.json) precomputed nightly by
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
// Cached in-memory for the session (the file changes once a day).
let cached

export async function fetchPitchArsenal() {
  if (cached !== undefined) return cached
  try {
    const res = await fetch('/data/pitch-arsenal.json')
    if (!res.ok) throw new Error(`pitch-arsenal.json ${res.status}`)
    cached = await res.json()
  } catch {
    cached = null
  }
  return cached
}

// A minimum sample so a two-pitch relief cameo doesn't render a misleadingly
// confident-looking mix — the same idea as the foul tracker's qualifier
// floors (src/api/fouls.js).
export const MIN_ARSENAL_PITCHES = 15

// One pitcher's pitch-type mix for the level the game he's starting is being
// played at, each entry carrying its share of pitches thrown + average
// velocity, sorted most-thrown first. Null when the file hasn't loaded, he
// isn't in it (no MLB/AAA innings logged this season), or his sample is
// below the qualifier floor (e.g. a September call-up with three pitches on
// file) — the card simply doesn't render.
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
// should be another AAA arm, not a big leaguer he happens to resemble.
//
// Spoiler footing is unchanged from the rest of this module: a completed-game
// season aggregate, no SealBox. Returns [] whenever it can't answer — file not
// loaded, subject not in it, or subject under the similarity floor — so the
// card simply doesn't render.
export function similarPitchersFor(data, personId, isMlb, opts) {
  const entries = data?.pit
  if (!entries) return []
  const key = isMlb ? 'mlb' : 'aaa'
  const pool = []
  for (const [id, entry] of Object.entries(entries)) {
    const types = entry?.[key]
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
