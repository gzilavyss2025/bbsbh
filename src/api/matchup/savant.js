import { staticJson } from '../staticJson.js'

// Season Statcast rates for the MATCHUP callouts, read from a static
// same-origin file (public/data/savant-matchup.json) regenerated nightly by
// scripts/gen-savant-matchup.mjs. This module only reads it.
//
// Keyed by MLB Stats API personId (Savant's player_id is the same MLBAM id), so
// a caller indexes straight off a roster entry or a due-up slot.
//
// SPOILER FOOTING: season aggregates off a nightly file — completed games only,
// nothing from tonight, no SealBox. Same footing as war.js and
// savantPercentiles.js. The matchup NOTES built on this are equally free of
// tonight's game; what gates them is which half a surface may stage, not this
// data (see ./notes.js).
//
// Degrades to empty maps before the file exists or on any fetch failure — the
// notes simply never build. MLB only; Savant has no minor-league board, so a
// MiLB game finds no rows and builds nothing.
export const fetchSavantMatchup = staticJson('/data/savant-matchup.json', {
  fallback: {
    season: null,
    league: { bat: {}, pit: {}, arsenal: { bat: {}, pit: {} } },
    bat: {}, pit: {}, arsenal: { bat: {}, pit: {} },
  },
})

// One player's rate row for one role, or null when he is not in the file —
// a MiLB game, a September call-up, or anyone under the generator's own PA
// floor. Every caller treats null as "no note", never as zero.
export function matchupRatesFor(data, personId, role) {
  const key = role === 'pitching' ? 'pit' : 'bat'
  return data?.[key]?.[personId] ?? null
}

// The league mean and spread one rate is scored against, for one role. Null
// when the nightly run could not compute a usable spread for that metric, which
// is the signal to build no note on that axis rather than to invent a baseline.
export function leagueFor(data, metric, role) {
  const key = role === 'pitching' ? 'pit' : 'bat'
  const entry = data?.league?.[key]?.[metric]
  return entry && Number.isFinite(entry.m) && Number.isFinite(entry.sd) && entry.sd > 0
    ? entry
    : null
}

// How far a value sits from its own role's league mean, in standard deviations.
// The two roles are scored against their OWN spreads, which matters: pitchers
// vary far less than hitters on these rates (chase SD 3.6 vs 6.9, hard-hit 5.1
// vs 9.6), so a shared raw-percentage threshold would fire constantly on
// hitters and almost never on pitchers.
export function zScore(data, metric, role, value) {
  const lg = leagueFor(data, metric, role)
  if (lg == null || !Number.isFinite(value)) return null
  return (value - lg.m) / lg.sd
}

// --- Family C — the arsenal matchup (one hitter against one pitch type) ----
// Joined on (player_id, pitch_type), written by gen-savant-matchup.mjs's
// arsenal section. A pitcher's row exists only for a pitch already past the
// usage/thrown gate; a batter's row only past the PA floor — so absence here
// IS the gate, and every reader below degrades to null on a miss like its
// season-axis siblings above.

// A player's whole arsenal record, keyed by pitch type — the pitcher's
// qualifying pitches, or the batter's record against every type he has faced
// enough of. Null when he is not in the file at all (a MiLB game, a
// September call-up, anyone under the generator's own floors).
export function arsenalFor(data, personId, role) {
  const key = role === 'pitching' ? 'pit' : 'bat'
  return data?.arsenal?.[key]?.[personId] ?? null
}

// One (player, pitch type) row, or null on a miss — never zero.
export function arsenalRatesFor(data, personId, pitchType, role) {
  return arsenalFor(data, personId, role)?.[pitchType] ?? null
}

// The league whiff mean/spread for ONE pitch type, one board per role — the
// same "each role scored against its own board" rule leagueFor uses above,
// with a pitch-type key added.
export function arsenalLeagueFor(data, pitchType, role) {
  const key = role === 'pitching' ? 'pit' : 'bat'
  const entry = data?.league?.arsenal?.[key]?.[pitchType]
  return entry && Number.isFinite(entry.m) && Number.isFinite(entry.sd) && entry.sd > 0
    ? entry
    : null
}

export function arsenalZScore(data, pitchType, role, value) {
  const lg = arsenalLeagueFor(data, pitchType, role)
  if (lg == null || !Number.isFinite(value)) return null
  return (value - lg.m) / lg.sd
}
