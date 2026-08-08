// Pure logic for the site-wide "Scores Unlocked" day pass — the home-screen
// toggle that ungates every score for the rest of the day and then re-seals
// itself at the next 8:00am LOCAL time. Kept dependency-free and React-free so
// the 8am/timezone/DST behavior can be pinned by the unit suite (see
// test/scores-unlocked.test.js); the hook (useScoresUnlocked.js) and the UI are
// thin wrappers over these.
//
// The stored value is an EXPIRY timestamp (epoch ms), never a boolean. That is
// the whole safety design: "unlocked" is only ever true while now < expiry, so
// a tab left open overnight, a device that slept through 8am, or a corrupted
// value all resolve to sealed by default. isUnlocked() is the single predicate
// every reader goes through, and it fails closed.

// The one import: toApiDate, so `gameDayAt` below can answer in the same
// YYYY-MM-DD vocabulary spoiledDays.js stores and the feed's `officialDate`
// carries. dates.js is itself dependency-free, so the unit suite still loads
// this module in plain Node with nothing else pulled in.
import { toApiDate } from './dates.js'

// The reset hour, in local time. Hard-coded for v1 (see the spec's open
// questions); a game-day mentally ends in the small hours, so 8am both covers a
// west-coast night game watched the next morning and guarantees the pass never
// silently survives into a genuinely new day of baseball.
export const RESET_HOUR = 8

// A hard ceiling on how far in the future a stored expiry may sit: any valid
// "next 8am" is at most 24h out, so 26h leaves room for a DST fall-back night
// (25h) plus slack, while still rejecting a hand-mangled far-future value that
// would otherwise pin the site unlocked. Malformed storage must never be able
// to OVER-reveal — the same posture as parseRevealMark in revealProgressCore.js.
export const MAX_WINDOW_MS = 26 * 60 * 60 * 1000

// The next local RESET_HOUR strictly after `now`. Uses setHours on a local Date
// so it lands on the wall-clock hour regardless of timezone, and DST is handled
// by Date itself (the interval may be 23 or 25 hours on a transition night — the
// point is the wall-clock time, not a fixed duration). Returns epoch ms.
export function nextResetAt(now = new Date()) {
  const e = new Date(now)
  e.setHours(RESET_HOUR, 0, 0, 0)
  if (e.getTime() <= now.getTime()) e.setDate(e.getDate() + 1)
  return e.getTime()
}

// The one predicate every reader uses. True only when the stored expiry parses
// to a finite number that is both still in the future AND within the sane
// window. Anything else — non-numeric, past, or absurdly far out — is sealed.
export function isUnlocked(rawExpiry, now = Date.now()) {
  const t = Number(rawExpiry)
  if (!Number.isFinite(t)) return false
  if (t <= now) return false
  if (t - now > MAX_WINDOW_MS) return false
  return true
}

// Milliseconds until a live expiry fires, for scheduling the in-tab re-seal
// timer. Returns null when the value isn't a valid live expiry (nothing to
// schedule). Clamped to the sane window so a timer is never armed absurdly far
// out even if isUnlocked's window check were bypassed.
export function msUntilReset(rawExpiry, now = Date.now()) {
  if (!isUnlocked(rawExpiry, now)) return null
  return Math.min(Number(rawExpiry) - now, MAX_WINDOW_MS)
}

// The DAY a consent given right now is a consent TO — the day whose baseball
// the pass will cover, in the app's YYYY-MM-DD vocabulary. This is a GAME day,
// not a calendar day: it runs 8am to 8am, the same boundary `nextResetAt`
// measures against, so a pass started now always expires at the END of the day
// this returns. From 8am to midnight the two are identical; from midnight to
// 8am the game day is YESTERDAY, because the games you are watching at 1am are
// the previous date's.
//
// That eight-hour gap is not a nicety — it was a spoiler bug. `enable` used to
// pair `nextResetAt()` with the plain calendar date, so consenting at 1am wrote
// an expiry seven hours out and stamped the WHOLE NEW DAY as consented-to.
// spoiledDays entries are durable by design (ADR-0026: a day you agreed to see
// stays open), so from 8am onward that day's slate rendered every live score
// plainly — for games that had not been played when the user consented — while
// the toggle, which reports the expired pass, still read "off". It got the
// other half wrong too: the day actually watched was never recorded, so it
// re-sealed at 8am, which is exactly the fiction spoiledDays.js exists to end.
//
// Derived by stepping the local Date back a day rather than subtracting 8h of
// wall clock, so a DST transition can't land it on the wrong date.
export function gameDayAt(now = new Date()) {
  const d = new Date(now)
  if (d.getHours() < RESET_HOUR) d.setDate(d.getDate() - 1)
  return toApiDate(d)
}

// Format an expiry as a short local clock time (e.g. "8:00 AM") for the consent
// copy's {time} token and the active banner. Locale-driven; falls back to a
// bare "RESET_HOUR:00" shape if Intl is unavailable for any reason.
export function formatResetTime(expiry) {
  const t = Number(expiry)
  // Number(null) is 0 and Number('') is 0 — treat any non-positive/garbage
  // value as "nothing to format" rather than formatting the epoch.
  if (!Number.isFinite(t) || t <= 0) return ''
  try {
    return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return `${RESET_HOUR}:00`
  }
}
