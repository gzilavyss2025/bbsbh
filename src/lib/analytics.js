// Toggle-consent analytics — a single, deliberately narrow event so the site
// owner can see how often the spoiler-departure toggles (Scores Unlocked,
// Follow Live) are confirmed vs. declined, and from which surface.
//
// SPOILER + PRIVACY GUARD: this must NEVER carry a game-identifying or
// score-revealing value. There is no gamePk, no score, no inning, no
// revealedThrough here — the toggle-honesty copy (Task F) promises the pass does
// not track your scoring, and this keeps that literally true. `buildToggleEventProps`
// is an allowlist choke point (mirroring sanitizeOverrides in the copy store):
// it emits ONLY the three enumerated, coarse props below and drops everything
// else, so a future careless caller cannot smuggle a game key into telemetry.
//
// Inert when unconfigured: `track` from @vercel/analytics is a no-op unless the
// <Analytics/> component (main.jsx) is live on a Vercel deploy, so importing and
// calling this off-platform (dev, tests, a self-host) does nothing.
import { track } from '@vercel/analytics'

export const TOGGLES = Object.freeze({
  SCORES_UNLOCKED: 'scores_unlocked',
  FOLLOW_LIVE: 'follow_live',
})

export const ACTIONS = Object.freeze({
  CONFIRM: 'confirm',
  DISMISS: 'dismiss',
})

export const SURFACES = Object.freeze({
  SLATE: 'slate',
  INGAME: 'ingame',
})

// The ONLY keys that can ever reach the analytics payload. Anything not in this
// set is dropped — the guarantee that no game-identifying field escapes.
export const ALLOWED_PROP_KEYS = Object.freeze(['toggle', 'action', 'surface'])

const TOGGLE_VALUES = new Set(Object.values(TOGGLES))
const ACTION_VALUES = new Set(Object.values(ACTIONS))
const SURFACE_VALUES = new Set(Object.values(SURFACES))

// The single event name. One event, distinguished by its `action` prop, so the
// Vercel dashboard shows one confirm/decline funnel per toggle rather than a
// sprawl of event names.
export const TOGGLE_CONSENT_EVENT = 'toggle_consent'

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

// Fire the event if — and only if — the props validate. A malformed call is
// silently dropped rather than emitting a partial/garbage event.
export function trackToggleConsent(input) {
  const props = buildToggleEventProps(input)
  if (!props) return
  try {
    track(TOGGLE_CONSENT_EVENT, props)
  } catch {
    // Never let telemetry break a user action.
  }
}
