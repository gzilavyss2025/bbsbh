// The pure half of scripts/gen-long-at-bats.mjs — which season the note is
// about, and what counts as a plate appearance and a long one.
//
// A generator file RUNS on import, so anything worth a unit test has to live
// here to be testable at all (the scripts/lib convention; test/long-at-bats.test.js).


// WHICH SEASON THE NOTE IS ABOUT, and it is not `new Date().getFullYear()`.
//
// The note is read on the offseason page, which runs from November to the
// following February and names ONE season across that whole span. So on
// January 2 this has to still be building 2026, not opening an empty 2027 —
// the trap #1122 found in gen-minors-leaders.mjs, which named the calendar year
// it ran in and so would have replaced a finished season's board with an empty
// one and held it there until April.
//
// `phase` is offseasonPhase()'s reading of today against statsapi's own season
// row; it already carries `seasonEnded` for both halves of the winter. Outside
// the winter there is no phase and the answer is this year, which is the season
// being played and the one the sweep is filling in as it goes.
export function noteSeasonFor(phase, year) {
  return phase?.seasonEnded ?? year
}

// The eventTypes that END a plate appearance. statsapi's own /api/v1/eventTypes
// list flags each code `plateAppearance: true|false`; this is its true set
// (read 2026-09-30, 74 codes), plus grounded_into_triple_play, which that list
// flags false although a GITP is a batter's PA like the double-play codes.
//
// An ALLOW list, not the NON_PA_EVENT_TYPES block list the reveal-only modules
// use: a top-level play that ends a half without ending the PA can carry codes
// that list never names (other_out, defensive_indiff, pickoff_error_1b, …),
// and each one read as a PA would make a phantom bat-around (review of #1295).
export const PLATE_APPEARANCE_EVENT_TYPES = new Set([
  'single', 'double', 'triple', 'home_run',
  'field_out', 'force_out', 'fielders_choice', 'fielders_choice_out', 'field_error',
  'double_play', 'triple_play', 'grounded_into_double_play', 'grounded_into_triple_play',
  'strikeout', 'strike_out', 'strikeout_double_play', 'strikeout_triple_play',
  'sac_fly', 'sac_fly_double_play', 'sac_bunt', 'sac_bunt_double_play',
  'walk', 'intent_walk', 'hit_by_pitch',
  'catcher_interf', 'batter_interference', 'fan_interference',
  'os_ruling_pending_primary',
])

// A top-level play that is a plate appearance. `result.type` is 'atBat' on
// EVERY play the feed returns — a caught stealing that ends a half is typed
// 'atBat' too (verified across 72 games, 10 such plays) — so the eventType is
// the only thing that separates them.
export function isPlateAppearance(play) {
  return PLATE_APPEARANCE_EVENT_TYPES.has(play?.result?.eventType)
}

// How many pitches were thrown in this play. `pitchIndex` is the feed's own
// list of which playEvents were pitches, so its length is the count without
// fetching the events themselves — which is what lets one trimmed request
// answer for a whole game (28 KB against 555 KB for the full play-by-play).
export function pitchesIn(play) {
  return Array.isArray(play?.pitchIndex) ? play.pitchIndex.length : 0
}

// ONE PLAY IS ONE AT-BAT, and that is the honest rule rather than a shortcut.
//
// A batter left mid-count by an inning-ending caught stealing comes back to
// lead off the next inning on a NEW count, and the feed files that as a new
// play — the pitches he already saw belong to the play that ended the inning
// and are not re-listed (src/api/playbyplay/eventTypes.js records the same
// thing from the scoring side). Baseball agrees: that is a new plate
// appearance. So a play's own pitch count is the at-bat's length, and no
// stitching across plays is wanted or done.
//
// Returns the qualifying plays plus the two counts the note's denominator and
// its honesty both rest on: how many plate appearances the game held, and how
// many of them carried no pitch at all (which would mean the game's pitch
// coverage is not complete and the census cannot claim to be exact).
export function scanGamePlays(plays, threshold) {
  const out = { plateAppearances: 0, withoutPitches: 0, long: [] }
  if (!Array.isArray(plays)) return out
  for (const play of plays) {
    if (!isPlateAppearance(play)) continue
    out.plateAppearances += 1
    const pitches = pitchesIn(play)
    if (pitches === 0) {
      out.withoutPitches += 1
      continue
    }
    if (pitches < threshold) continue
    out.long.push({
      pitches,
      top: play?.about?.halfInning === 'top',
      batter: play?.matchup?.batter ?? null,
      pitcher: play?.matchup?.pitcher ?? null,
    })
  }
  return out
}

// Longest first, and then by the one tiebreak that is not a result: the date.
// Ties are kept, never trimmed to a round number — research.md §7's rule for
// every note in this family.
export function sortRows(rows) {
  return rows.slice().sort((a, b) => {
    if (b.pitches !== a.pitches) return b.pitches - a.pitches
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    return (a.batter?.name ?? '') < (b.batter?.name ?? '') ? -1 : 1
  })
}
