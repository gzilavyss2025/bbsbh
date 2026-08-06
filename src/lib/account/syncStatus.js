// What the four cross-device sync channels are actually doing — pure, so the
// rules below are pinned by test/sync-status.test.js rather than inferred from
// a component's effect ordering. The React seam is
// src/components/sync/SyncStatusProvider.jsx; the surface that renders it is My
// Tally's sync receipt.
//
// WHY THIS EXISTS. Every sync component in this app swallows its own errors and
// leaves localStorage authoritative. That is correct — it is the offline-first
// contract — and it is also exactly how ADR-0022's total production failure hid
// for weeks: "a graceful degrade can mask a hard failure indefinitely." A 500, a
// 501, an expired token and a deploy with no backend at all were indistinguishable
// from the outside, and the user had no way to see any of it. This module is the
// other half of that lesson: the catches stay, they just stop being silent.
//
// It reports on the MECHANISM and never on the data. A channel record holds a
// phase and two timestamps. There is no room in it for a game, a score, or a
// count of anything — by construction, not by discipline.

// The four things that cross devices. Ordered as the receipt reads them.
export const SYNC_CHANNELS = Object.freeze(['reveal', 'spoiledDays', 'stamps', 'prefs'])

// off          this deploy configures no account at all (no Clerk publishable
//              key) — there is nothing to sync and nothing is wrong.
// local        signed out. Everything works; it lives on this device.
// pulling      a fetch is in flight.
// synced       the last exchange with the server succeeded.
// unavailable  the endpoint answered 501 — this deploy has no store. A
//              SUPPORTED state (docs/development.md), deliberately not an error,
//              so the UI never shows red for a correctly-configured absence.
// error        a real, recoverable failure: offline, a rejected token, a 5xx.
export const SYNC_PHASES = Object.freeze([
  'off',
  'local',
  'pulling',
  'synced',
  'unavailable',
  'error',
])

// Worst first. The page-level word is the worst channel's, so it can never say
// "synced" while something is failing. `error` outranks `unavailable` because
// one is actionable (sign in again, get back on wifi) and the other is a
// property of the deployment. `local`/`off` outrank the in-flight and happy
// states because they are the truthful headline when nothing is syncing at all.
const SEVERITY = Object.freeze(['error', 'unavailable', 'local', 'off', 'pulling', 'synced'])

export function isSyncChannel(value) {
  return typeof value === 'string' && SYNC_CHANNELS.includes(value)
}

export function isSyncPhase(value) {
  return typeof value === 'string' && SYNC_PHASES.includes(value)
}

// Only an `error` is worth offering a user any hope about. `unavailable` is the
// deployment's shape, `local` and `off` are the user's own situation, and
// neither is a fault to recover from.
export function isRecoverable(phase) {
  return phase === 'error'
}

// A channel that has never reported. `syncedAt` is kept separately from `at` so
// a receipt can still say "last checked 4 minutes ago" WHILE showing an error —
// which is the one moment that sentence is worth reading.
function blankChannel(phase) {
  return { phase, at: null, syncedAt: null, reason: null }
}

// `enabled` is `isClerkEnabled`: false means this deploy has no account feature,
// so every channel starts (and stays) `off` rather than claiming to be local
// storage waiting for a sign-in that can never happen.
export function initialSyncState(enabled = false) {
  const phase = enabled ? 'local' : 'off'
  const out = {}
  for (const channel of SYNC_CHANNELS) out[channel] = blankChannel(phase)
  return out
}

// Fold one report in. Returns the SAME object when nothing would change, so the
// store can skip notifying its subscribers — an unchanged phase re-reported on
// every focus must not re-render the receipt.
//
// An unknown channel or phase is ignored rather than stored. A reporter that
// got it wrong should not be able to invent a fifth channel that the receipt
// would then have to render a label for.
export function reduceSync(state, event) {
  const current = state && typeof state === 'object' ? state : {}
  const channel = event?.channel
  const phase = event?.phase
  if (!isSyncChannel(channel) || !isSyncPhase(phase)) return current

  const prev = current[channel] ?? blankChannel('off')
  const at = Number.isInteger(event.at) && event.at > 0 ? event.at : null
  const reason = typeof event.reason === 'string' && event.reason ? event.reason : null
  const syncedAt = phase === 'synced' ? (at ?? prev.syncedAt) : prev.syncedAt

  if (
    prev.phase === phase &&
    prev.at === at &&
    prev.syncedAt === syncedAt &&
    prev.reason === reason
  ) {
    return current
  }
  return { ...current, [channel]: { phase, at, syncedAt, reason } }
}

// The one word for the whole account. Worst channel wins; a state with no
// channels at all reads `off`, which is the safest thing to say about nothing.
export function rollupSync(state) {
  const channels = state && typeof state === 'object' ? Object.values(state) : []
  if (channels.length === 0) return 'off'
  for (const phase of SEVERITY) {
    if (channels.some((c) => c?.phase === phase)) return phase
  }
  return 'off'
}

// Give a channel that has NEVER reported the account's own phase, so silence
// cannot be mistaken for failure.
//
// `RevealCloudSync` mounts inside InningViewer, not app-wide. On every other
// surface — /profile, and the slate — the `reveal` channel has therefore never
// spoken and is still sitting on `initialSyncState`'s opening phase. Left
// alone, `rollupSync` (worst channel wins) reads that silence as `local` and
// the whole page lies to a signed-in user whose sync is perfectly healthy.
//
// A channel that has never reported is exactly `{ at: null }` — `report()`
// always stamps a clock — so a silent channel inherits the phase of the `prefs`
// channel, which IS app-wide and Clerk-gated and is therefore the faithful
// signed-in/out signal. It inherits the PHASE only, never a `syncedAt`, so
// nothing can claim a "last checked" time it never had.
//
// Both readers of the store must use this. Phase 5 found the slate's merge
// strip gated on the raw rollup and therefore permanently dead, which is why
// this lives here as one tested function instead of privately on the page.
export function normalizeSilentChannels(state) {
  const account = state?.prefs?.phase ?? 'off'
  const out = {}
  for (const channel of SYNC_CHANNELS) {
    const record = state?.[channel] ?? blankChannel(account)
    out[channel] = record.at == null ? { ...record, phase: account } : record
  }
  return out
}

// The most recent moment ANY channel last succeeded — "last synced" for the
// page as a whole. Null when nothing ever has.
export function lastSyncedAt(state) {
  const channels = state && typeof state === 'object' ? Object.values(state) : []
  let best = null
  for (const c of channels) {
    if (Number.isInteger(c?.syncedAt) && (best == null || c.syncedAt > best)) best = c.syncedAt
  }
  return best
}

// The phase a failed fetch should report, from whatever the attempt produced.
// One place, so every sync component classifies a 501 the same way — the
// distinction that docs/development.md's curl probe rests on, and that ADR-0022
// says was worth a Vercel log query to recover.
export function phaseForResponse(status) {
  if (status === 501) return 'unavailable'
  if (Number.isInteger(status) && status >= 200 && status < 300) return 'synced'
  return 'error'
}

// A short, non-diagnostic reason string for an error phase. Deliberately coarse
// — a user cannot act on a status code, and the operator has the server log
// (api/_lib/auth.js's header explains why the detail belongs there and not here).
export function reasonForResponse(status) {
  if (status === 401 || status === 403) return 'auth'
  if (Number.isInteger(status) && status >= 500) return 'server'
  if (!Number.isInteger(status)) return 'network'
  return 'unknown'
}
