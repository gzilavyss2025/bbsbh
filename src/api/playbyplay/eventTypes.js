// Event-type classification sets shared across the reveal-only modules and
// the playbyplay/ split itself — NON_PA_EVENT_TYPES, GAME_ADVISORY_EVENT_TYPE,
// and BASERUNNING_NOTE_EVENT_TYPES are read by derive.js, pitchers.js,
// callout-notes.js, and gen-fouls.mjs (see ../playbyplay.js's barrel and
// src/api/CLAUDE.md), so this file's exports must not drift from what those
// callers expect. Split (ADR-0038, check-file-size.mjs) out of
// src/api/playbyplay.js.

// Top-level plays that are baserunning events, not plate appearances: the
// batter's at-bat continues (or restarts next inning) as its own later play.
// Shared with derive.js and pitchers.js, whose PA / batters-faced counts must
// skip these or an inning-ending caught stealing mid-count double-counts the
// batter (both files still accumulate the play's PITCHES — those were
// genuinely thrown and are not re-listed in the resumed at-bat).
export const NON_PA_EVENT_TYPES = new Set([
  'stolen_base_2b', 'stolen_base_3b', 'stolen_base_home',
  'caught_stealing_2b', 'caught_stealing_3b', 'caught_stealing_home',
  'pickoff_1b', 'pickoff_2b', 'pickoff_3b',
  'pickoff_caught_stealing_2b', 'pickoff_caught_stealing_3b', 'pickoff_caught_stealing_home',
  'wild_pitch', 'passed_ball', 'balk',
])

// A placeholder top-level play the feed uses to log pregame/mid-game status
// transitions (Pre-Game -> Warmup -> In Progress, or a delay's own "Status
// Change" advisories) as nested "Game Advisory" playEvents. It carries a real
// matchup (whoever is next due up to bat/pitch) but is never an actual plate
// appearance, so it's checked alongside NON_PA_EVENT_TYPES anywhere a play's
// eventType decides PA/BF counting — otherwise it renders as a bogus at-bat
// card with an empty diamond (verified live, gamePk 823440, the half hour
// before first pitch). See api/select.js's selectGameStatus (`isWarmup`) for
// the structural, spoiler-free notice built from the same detailedState.
export const GAME_ADVISORY_EVENT_TYPE = 'game_advisory'

// Two more local-only, NON_PA_EVENT_TYPES-adjacent classifications — kept out
// of the shared set above (also used for PA/BF counting in this file and in
// pitchers.js/derive.js, where neither belongs) but named here rather than
// spelled out inline at each call site, so the two lists below can't drift
// apart from each other without a reader noticing why they differ.
//
// BASERUNNING_NOTE_EVENT_TYPES: playEvents[].details.eventType values with no
// plate appearance of their own that still deserve a baserunning sub-line
// when they carry a description — every NON_PA_EVENT_TYPES code, plus
// `runner_placed` (the automatic extra-innings runner, placed on 2nd to begin
// the half) and `defensive_indiff`. Verified against gamePk 777747's bottom
// of the 10th (Joey Ortiz's placement, Brice Turang's defensive-indifference
// advance) — without this, both fell through with no card and no baserunning
// sub-line, leaving no trace of how a runner got to base.
//
// NO_SLOT_CREDIT_EVENT_TYPES: runners[].details.eventType values that are
// self-driven and credit no batter's plate appearance / lineup slot — every
// NON_PA_EVENT_TYPES code, plus `defensive_indiff` only. `runner_placed` is
// deliberately NOT here, and this is not an oversight: verified against the
// same gamePk 777747, a placed runner's own runners[] movement (when he moves
// at all) always carries the enclosing play's real result eventType (e.g.
// 'single'), never 'runner_placed' itself — there is nothing for this list to
// exclude for that event type.
export const BASERUNNING_NOTE_EVENT_TYPES = new Set([...NON_PA_EVENT_TYPES, 'runner_placed', 'defensive_indiff'])
export const NO_SLOT_CREDIT_EVENT_TYPES = new Set([...NON_PA_EVENT_TYPES, 'defensive_indiff'])

// Non-pitch playEvents that get their own interstitial note in the feed: mound
// visits, pitching changes, ejections, and the fielding-side moves (a fresh
// defender, or a player who stays in the game at a new position — 'X remains
// in the game as the right fielder'). These live INSIDE a play's playEvents,
// at the start of whichever plate appearance follows the stoppage, so they're
// already gated to the half being revealed. Offensive subs are mostly skipped
// — a pinch-hitter shows up as his own batting row — except a pinch-RUNNER,
// which gets its own notification pushed separately below (see the main loop)
// since it happens mid-flow, distinct from the batter-card annotation that
// also strikes the replaced runner's name.
export const STOPPAGE_EVENTS = new Set([
  'mound_visit',
  'pitching_substitution',
  'defensive_substitution',
  'defensive_switch',
  'ejection',
])
