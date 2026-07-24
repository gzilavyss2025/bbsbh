// The set of days the user has consented to spoil — the durable half of the
// Scores Unlocked pass (ADR-0026). React-free and dependency-free so the parse
// rules can be pinned by the unit suite (test/spoiled-days.test.js).
//
// Why this exists at all: the pass used to be purely ephemeral — 8am came and
// every score sealed back up, including the ones you had spent the evening
// looking at. That was a fiction. If you flipped the switch on Tuesday because
// you were at the ballpark and wanted the out-of-town scores, Tuesday is spoiled;
// pretending on Wednesday morning that you might still hand-score those games is
// pretending. So the 8am reset no longer means "everything re-seals" — it means
// "the pass stops applying to NEW days". A day you consented to stays open.
//
// The load-bearing property: this is a set of DATES, never a reveal mark. It
// never touches `revealedThrough` (see revealProgressCore.js), so a day being
// spoiled cannot corrupt, advance, or cloud-sync the high-water mark that records
// what you actually uncovered by hand. The two live side by side: the mark says
// what you scored, this says which days you agreed to see plainly.
//
// It grows ONLY by explicit consent, and every parse failure collapses to the
// empty set — the same fail-sealed posture as parseRevealMark. A garbled value
// can lose you a day's consent (harmless — consent again) but can never invent
// one.

export const SPOILED_DAYS_KEY = 'bbsbh:spoiledDays'

// A generous ceiling on how many days we keep. Each entry is ~12 bytes, so even
// the cap is a rounding error in localStorage; it exists so a runaway writer can
// never grow the value without bound. Two full seasons of daily use.
export const MAX_SPOILED_DAYS = 400

// The exact shape toApiDate (src/lib/dates.js) produces and the feed's
// `officialDate` carries — the one date vocabulary the whole app shares. Anything
// else is not a day this app can be looking at, so it is dropped rather than
// stored and later matched against nothing.
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isDayString(value) {
  return typeof value === 'string' && DAY_RE.test(value)
}

// Valid shapes only, deduped, newest first, capped. Newest-first is what makes
// the cap meaningful: if the list ever exceeds it, the entries dropped are the
// oldest, which are the least likely to still matter. Lexicographic sort IS
// chronological for YYYY-MM-DD — part of why the app standardized on that shape.
function normalize(list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  for (const entry of list) {
    if (isDayString(entry)) seen.add(entry)
  }
  return [...seen].sort().reverse().slice(0, MAX_SPOILED_DAYS)
}

// Parse the raw localStorage value into a normalized day list. Never throws —
// malformed JSON, a non-array, a nested object, a stray number all collapse to []
// ("nothing spoiled"), which leaves every day sealed.
export function parseSpoiledDays(raw) {
  if (raw == null) return []
  try {
    return normalize(JSON.parse(raw))
  } catch {
    return []
  }
}

// The value to hand localStorage. Normalizes on the way out too, so nothing
// unparseable by the reader above can ever be written by this app.
export function serializeSpoiledDays(days) {
  return JSON.stringify(normalize(days))
}

// Is this date one the user has agreed to see plainly? The single predicate every
// reader goes through. A malformed or absent date argument is NOT spoiled — a
// caller that can't say which day it is must not get an unsealed answer.
export function isDaySpoiled(days, dateStr) {
  if (!isDayString(dateStr)) return false
  return Array.isArray(days) && days.includes(dateStr)
}

// Record a day's consent. Returns a NEW normalized list; a day already present or
// a malformed date is a no-op, so callers can add freely without checking first.
export function addSpoiledDay(days, dateStr) {
  const current = Array.isArray(days) ? days : []
  if (!isDayString(dateStr)) return normalize(current)
  return normalize([dateStr, ...current])
}

// Take a day's consent back. This is what makes an accidental tap recoverable:
// turning the pass off the same day removes that day again, so a misfire on the
// consent button costs nothing. Only reachable while the day in question is still
// "today" — once the pass expires at 8am no caller passes yesterday's date here,
// which is exactly how a day becomes permanent.
export function removeSpoiledDay(days, dateStr) {
  const current = Array.isArray(days) ? days : []
  return normalize(current.filter((d) => d !== dateStr))
}
