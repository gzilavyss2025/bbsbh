// The pure, React-free core of useRevealProgress.js — the reveal high-water
// mark's parse/merge rules and the extra-innings unlock math. Pulled out of the
// hook so the spoiler-critical guarantees ("the mark only ever moves forward",
// "a malformed storage value can never advance it", "extras unlock one at a
// time") can be tested directly, without a DOM or a React renderer. The hook
// wires these into useState/useEffect and localStorage; the invariants live
// here.
import { halfIndex } from '../api/select.js'

// Parse a raw localStorage value into a reveal half-index. Anything that isn't
// a non-negative integer — null (unset), a NaN, a negative, a fractional —
// collapses to -1 ("nothing revealed"), so a hand-mangled or cross-version
// storage entry can never over-reveal. Takes the already-read raw string (or
// null); the hook owns the try/catch around the actual storage read.
export function parseRevealMark(raw) {
  if (raw == null) return -1
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 ? n : -1
}

// Parse the at-bat stepping cursor, stored as "{halfIdx}:{count}" (ADR-0016).
// Either field being absent/negative/non-integer collapses the whole cursor to
// the inert { halfIdx: -1, count: 0 } — a stale or garbled value is ignored
// rather than misread as live progress.
export function parseAtBatMark(raw) {
  if (raw == null) return { halfIdx: -1, count: 0 }
  const [h, c] = String(raw).split(':').map(Number)
  if (!Number.isInteger(h) || !Number.isInteger(c) || h < 0 || c < 0) {
    return { halfIdx: -1, count: 0 }
  }
  return { halfIdx: h, count: c }
}

// The one ratchet: the mark only ever moves forward. Every path that pushes in
// an externally-sourced value (a tap, another tab's storage event, a signed-in
// device's cloud sync) goes through this, so none of them can walk it backward.
export function mergeMark(prev, next) {
  return next > prev ? next : prev
}

// How many innings are currently visible: regulation, plus one more for each
// extra inning whose predecessor's bottom has already been fully revealed
// (extras never spoil — ADR-0008).
export function unlockedInnings(regulation, actualCount, revealedThrough) {
  let u = regulation
  while (u < actualCount && revealedThrough >= halfIndex(u, 'bottom')) u++
  return u
}
