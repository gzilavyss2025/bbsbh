// Toggle-consent analytics — a single, deliberately narrow event so the site
// owner can see how often the spoilers-off switch is confirmed vs. declined.
//
// SPOILER + PRIVACY GUARD: this must NEVER carry a game-identifying or
// score-revealing value. There is no gamePk, no score, no inning, no
// revealedThrough here — the toggle-honesty copy (Task F) promises the pass does
// not track your scoring, and this keeps that literally true. `buildToggleEventProps`
// is an allowlist choke point (mirroring sanitizeOverrides in the copy store):
// it emits ONLY the three enumerated, coarse props below and drops everything
// else, so a future careless caller cannot smuggle a game key into telemetry.
//
// NO CALLER SINCE THE D1 MASTHEAD (2026-10-18). The slate's consent sheet was
// the only place the event fired, and its sender (`trackToggleConsent`) went
// with it. The allowlist stays, still pinned by test/analytics.test.js, until
// the Scores Unlocked removal PR deletes this module whole.

export const TOGGLES = Object.freeze({
  SCORES_UNLOCKED: 'scores_unlocked',
})

export const ACTIONS = Object.freeze({
  CONFIRM: 'confirm',
  DISMISS: 'dismiss',
})

// Consent is only ever given from the slate — there is no per-game toggle. The
// enum stays so the event shape doesn't change if that ever grows again.
export const SURFACES = Object.freeze({
  SLATE: 'slate',
})

const TOGGLE_VALUES = new Set(Object.values(TOGGLES))
const ACTION_VALUES = new Set(Object.values(ACTIONS))
const SURFACE_VALUES = new Set(Object.values(SURFACES))

// Validate + reduce an input to the exact allowlisted, enumerated props, or
// return null if any of the three is missing or not a known enum value. Pure —
// no side effects — so it can be unit-tested without a browser or the Vercel SDK.
export function buildToggleEventProps(input) {
  if (!input || typeof input !== 'object') return null
  const { toggle, action, surface } = input
  if (!TOGGLE_VALUES.has(toggle)) return null
  if (!ACTION_VALUES.has(action)) return null
  if (!SURFACE_VALUES.has(surface)) return null
  // Rebuild from scratch (never spread `input`) so ONLY the three keys survive,
  // regardless of what else the caller passed.
  return { toggle, action, surface }
}
