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

// How many CENTURY_MPH+ pitches a season has to hold before either surface
// says anything about it: the Margin Notes `centuryClub` callout
// (pitcher-callouts.js, which owned this number privately until the player
// page's heat band wanted the same floor) and heatView below. A one-off 100
// mph touch is unremarkable for a real flamethrower, and a band reading "1
// pitch at 100+" is noise rather than a fact worth a gold bar.
export const CENTURY_CLUB_MIN = 5

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
//
// `stand` picks the side the BATTER stood on — 'L' or 'R', or null for every
// side, which is what every caller asked for before the split existed. A side
// is its OWN denominator, the same rule the times-through split follows: a
// slider thrown a third of the time to lefties is the fact, and dividing by
// the whole season would bury it.
export function pitchArsenalFor(data, personId, isMlb, stand = null) {
  const entry = data?.pit?.[personId]
  const all = isMlb ? entry?.mlb : entry?.aaa
  if (!all || all.length === 0) return null
  const types = stand ? all.map((t) => sideRow(t, stand)).filter(Boolean) : all
  if (types.length === 0) return null
  const total = types.reduce((sum, t) => sum + t.pitches, 0)
  if (total < MIN_ARSENAL_PITCHES) return null
  return types
    .map((t) => ({ ...t, pct: Math.round((t.pitches / total) * 1000) / 10 }))
    .sort((a, b) => b.pitches - a.pitches)
}

// One pitch type as ONE side of the plate saw it, unpacked from the `vs` pair
// the generator writes: [pitches, avgVelo] and, when that side reached past a
// first look, its own times-through pairs. Null for a side he never threw this
// pitch to, and null for a file written before sides were counted.
//
// `century` and `maxVelo` are deliberately dropped rather than carried over:
// both are season facts about the pitch, not about the side, and a heat band
// reading a side's row would quote the whole year's hardest pitch as though he
// had thrown it to lefties.
function sideRow(type, stand) {
  const v = type.vs?.[stand]
  if (!v) return null
  return {
    code: type.code,
    description: type.description,
    pitches: v[0],
    avgVelo: v[1],
    tto: v[2],
  }
}

// The two sides of the plate, each shaped exactly like what the unfiltered
// card already reads — `rows` from pitchArsenalFor, `tto` from arsenalTtoView
// — so a component swaps one for the other and changes nothing else.
//
// Null when the file carries no side split at all (a row swept before sides
// were counted), and null when EITHER side sits under the qualifier floor: one
// side is no split, the same rule arsenalTtoView follows for a single look. A
// reliever who has faced four lefties all year gets no side filter rather than
// a tab that draws a plan out of four pitches.
export function arsenalSidesView(data, personId, isMlb) {
  const entry = data?.pit?.[personId]
  const all = isMlb ? entry?.mlb : entry?.aaa
  if (!all || all.length === 0) return null
  const counts = { L: 0, R: 0 }
  for (const t of all) {
    counts.L += t.vs?.L?.[0] ?? 0
    counts.R += t.vs?.R?.[0] ?? 0
  }
  if (counts.L < MIN_ARSENAL_PITCHES || counts.R < MIN_ARSENAL_PITCHES) return null
  return {
    counts,
    L: { rows: pitchArsenalFor(data, personId, isMlb, 'L'), tto: arsenalTtoView(data, personId, isMlb, 'L') },
    R: { rows: pitchArsenalFor(data, personId, isMlb, 'R'), tto: arsenalTtoView(data, personId, isMlb, 'R') },
  }
}

// The "heat" band at the foot of the player page's Pitches card: how many
// pitches at CENTURY_MPH+ this pitcher has thrown this season, and his
// hardest reading of the year. Both were already gathered by
// scripts/gen-pitch-arsenal.mjs's sweep and already ride the same shard file
// the mix does (`century` / `maxVelo`, per pitch type) — this is a sum over
// the types he actually threw, not a second fetch. Same completed-game
// season-aggregate spoiler footing as the rest of this module.
//
// Same level rule as pitchArsenalFor: MLB and AAA are separate bodies of work
// and are never pooled. Null when the file hasn't loaded, when he isn't in
// it, or when he sits under CENTURY_CLUB_MIN — in which case the band simply
// doesn't render, which is the right answer for the large majority of arms
// who never touch triple digits.
//
// `rank`/`of` come from the generator's own league pass (`centuryRank`, keyed
// by level): ranking him needs the whole level and the shard he rides in is
// one hundredth of it, so the reader cannot derive it. `of` is the size of the
// CENTURY CLUB at his level, not of the league — second of the 58 arms who
// have been to triple digits, which is the only denominator that says
// anything. Both stay null on a file written before that pass existed, and
// the band then renders the two facts it does have.
export function heatView(data, personId, isMlb) {
  const entry = data?.pit?.[personId]
  const types = isMlb ? entry?.mlb : entry?.aaa
  if (!types || types.length === 0) return null
  const count = types.reduce((n, t) => n + (t.century ?? 0), 0)
  if (count < CENTURY_CLUB_MIN) return null
  let maxVelo = null
  for (const t of types) {
    if (t.maxVelo != null && (maxVelo == null || t.maxVelo > maxVelo)) maxVelo = t.maxVelo
  }
  const place = entry.centuryRank?.[isMlb ? 'mlb' : 'aaa']
  return {
    count,
    maxVelo: maxVelo == null ? null : Math.round(maxVelo * 10) / 10,
    rank: place?.rank ?? null,
    of: place?.of ?? null,
  }
}

// The same season's mix, split by TIMES THROUGH THE ORDER — his first look at
// a batter, his second, and his third or later. gen-pitch-arsenal.mjs counts
// these in the sweep it already runs (the MLB Stats API publishes no such
// split), so they ride the same shard file as everything else here.
//
// Returns one entry per look that clears MIN_ARSENAL_PITCHES, most recent
// look last, or null when the file carries no split at all — which is the
// case for any row ingested before the sweep started counting.
//
// Null ALSO when only one look qualifies, which is every closer: a filter
// offering "All" and "1st" is not a choice, and the two would differ only by
// the handful of pitches that fell outside a qualifying look, which reads as
// a bug rather than a split. One look is no split; the card hides the filter
// and shows the season, which is the same thing said once.
//
// Each look is its OWN denominator: `usage` is the share of the pitches he
// threw on that look, not of his season. That is the whole point of the
// split — a starter who goes to his slider a third of the time the third
// time through is the fact, and dividing by the season would bury it.
//
// Each row also carries `delta`: the change in that pitch's usage from the
// look BEFORE it, in share (0.043 is up 4.3 points), so a reader can see
// which way an arm is drifting without holding two tabs in his head. Null on
// the first look, and null for a pitch the previous look has no row for —
// a pitch first thrown the third time through has nothing to be up from, and
// "up from zero" would be the loudest arrow on the card for the rarest pitch
// on it. Compared against the previous QUALIFYING look (the array's own
// neighbour), so a dropped middle look doesn't silently pair 1st with 3rd.
//
// `stand` narrows the whole split to one side of the plate — the two cross, so
// "third time through, to lefties" is a real answer rather than two filters
// that cancel. Null is every side, which is what every caller asked for before
// the split existed.
export function arsenalTtoView(data, personId, isMlb, stand = null) {
  const entry = data?.pit?.[personId]
  const all = isMlb ? entry?.mlb : entry?.aaa
  if (!all || all.length === 0) return null
  const types = stand ? all.map((t) => sideRow(t, stand)).filter(Boolean) : all
  if (types.length === 0) return null
  if (!types.some((t) => t.tto)) return null
  const looks = []
  for (let i = 0; i < 3; i += 1) {
    const rows = []
    for (const t of types) {
      // Each bucket is a [pitches, avgVelo] pair, and the array is trimmed of
      // trailing empty looks — see exportPitchArsenal on why it is not
      // spelled out. A missing bucket is a look he never reached.
      const bucket = t.tto?.[i]
      if (!bucket || bucket[0] <= 0) continue
      rows.push({ code: t.code, name: t.description || t.code, count: bucket[0], velo: bucket[1] })
    }
    const total = rows.reduce((n, r) => n + r.count, 0)
    if (total < MIN_ARSENAL_PITCHES) continue
    const prev = looks.length ? looks[looks.length - 1] : null
    const before = prev ? new Map(prev.rows.map((r) => [r.code, r.usage])) : null
    looks.push({
      look: i + 1,
      total,
      rows: rows
        .map((r) => {
          const usage = r.count / total
          const was = before?.get(r.code)
          return { ...r, usage, delta: was == null ? null : usage - was }
        })
        .sort((a, b) => b.count - a.count),
    })
  }
  return looks.length > 1 ? looks : null
}

// How far a pitch's usage has to move between two looks before the card draws
// an arrow beside it. Under a couple of points the move is the ordinary
// wobble of a few hundred pitches split three ways, and an arrow on it claims
// a plan the pitcher does not have. Share, not percent: 0.02 is two points.
export const MIN_LOOK_SHIFT = 0.02

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
