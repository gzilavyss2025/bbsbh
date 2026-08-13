// FOCUS MODE'S BEATS — every timing the scoring loop's punctuation runs on, as
// literal numbers in one file, plus the one predicate that decides whether the
// game's last rule is a double one.
//
// ===========================================================================
// THE RULE THIS FILE EXISTS TO ENFORCE (ADR-0046)
// ===========================================================================
// NO TIMING BEFORE A REVEAL MAY BE A FUNCTION OF THE REVEAL.
//
// A duration the reader can perceive is a channel. If the hold before a
// scorebook denotation prints were longer for a grand slam than for a
// strikeout — by pitch count, by RBI, by whether the play scored, by anything
// read out of the play — then the length of the pause would ANNOUNCE the play
// before the mark landed, and a reader learns to read it inside one inning.
// That is a spoiler built out of time instead of out of DOM, and every seal in
// this app would still be intact while it leaked.
//
// So: these are constants. They are identical for a walk, a strikeout, a
// grand slam and a caught stealing. Nothing in this file imports anything —
// deliberately, and `test/scoring-beats.test.js` asserts it stays that way,
// because the cheapest way to break the rule is one innocent-looking import of
// `derive.js` or `linescore.js` and one `? 240 : 180`.
//
// Weighting a big play is not forbidden outright; it is forbidden BEFORE the
// mark is legible. Once the denotation has printed, the reader already knows
// what happened, so anything keyed off it after that point leaks nothing. Any
// such effect must start from the ink-set's END, never from the hold's start.
//
// ===========================================================================
// TUNING
// ===========================================================================
// Every number here is meant to be felt and adjusted. They are the single
// source of truth for BOTH halves of each beat: the JS timers read them
// directly, and the CSS reads them through inline custom properties the
// components set (`--ink-set`, `--close-draw`, `--close-step`), so there is no
// second copy in a stylesheet to drift out of step with these.

// (1) THE BEAT — the hold between an at-bat card arriving and its scorebook
// denotation printing. The pitch ladder and the batter's name are up for this
// whole window; only the denotation cell is blank. Start here and adjust by
// feel; nothing else depends on the exact value.
export const DENOTATION_HOLD_MS = 180

// The ink-set that lands the mark: a 3% scale overshoot settling to rest, no
// colour change. Short enough to read as a press rather than a bounce.
export const INK_SET_MS = 40

// (2) THE RULE — the hairline drawing itself left to right across the stage
// when the half commits.
export const RULE_DRAW_MS = 420

// …then the half's R / H / E / LOB inking in behind it, one figure at a time.
export const TALLY_STAGGER_MS = 90

// Four figures: R, H, E, LOB. Named rather than typed as a bare 4 below,
// because CLOSE_SEQUENCE_MS and HalfCloseRule's own list have to agree about
// it or the sequence ends before its last figure is in.
export const TALLY_FIGURE_COUNT = 4

// The whole close, end to end: the rule draws, then the last figure starts one
// stagger after the second-to-last. The forward action on the bar is held for
// exactly this long (or until any tap cuts it short) and no longer.
export const CLOSE_SEQUENCE_MS = RULE_DRAW_MS + (TALLY_FIGURE_COUNT - 1) * TALLY_STAGGER_MS

// (3) THE DOUBLE RULE — whether the book is closed: the reader has revealed
// every half that was actually played.
//
// THE ARGUMENT KEYS ON THE READER'S OWN MARK, NEVER ON `selectIsFinal`. A rule
// that thickened because the FEED says the game is over would, at the bottom
// of the 9th, be answering the one question the reader has not asked yet — is
// there a 10th? `finalHalfIndex` is null until the game ends and is the index
// of the last half actually played once it does (selectFinalHalfIndex), so
// this can only return true after the reader has themselves revealed that
// half. A game headed for extras keeps drawing the ordinary single rule at the
// bottom of the 9th, exactly as a game headed for a 10th-inning walk-off does,
// because at that moment `revealedThrough` (17) has not reached
// `finalHalfIndex` (19 or 21) and the two are indistinguishable from here.
//
// Pure and unit-tested (`test/scoring-beats.test.js`) rather than inlined at
// the call site, because the inequality is the whole spoiler argument and a
// `>` typed as `===` would quietly stop drawing the double rule on every game
// that ended on a skipped bottom half.
export function bookIsClosed(revealedThrough, finalHalfIndex) {
  if (!Number.isInteger(finalHalfIndex)) return false
  if (!Number.isInteger(revealedThrough)) return false
  return revealedThrough >= finalHalfIndex
}
