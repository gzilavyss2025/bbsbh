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

// Parse the box score's own mark (ADR-0049) — the one bit that says "this
// reader has already opened this game's box score by hand". Stored as the
// string "1" and NOTHING else, so it can hold no half-index, no count, and
// nothing that could be mistaken for one. Any other value — null (unset), "0",
// "true", a number, a mangled blob — reads as false, which leaves the seal
// exactly where it was: the same fail-closed posture parseRevealMark has.
export function parseBoxRevealMark(raw) {
  return raw === '1'
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

// Render-time reveal override, from either of TWO independent openers:
//
//   • `scoresUnlocked` — the site-wide "Scores Unlocked" day pass
//     (useScoresUnlocked.js / ADR-0026), scoped to a day the user agreed to
//     spoil.
//   • `stamped` — this one game carries the user's own stamp (ADR-0048). A
//     stamp is minted only from inside a revealed box score of a FINAL game
//     and means "I was there / I watched this," so a seal on a game they
//     stamped protects them from nothing: they already know how it ended.
//     Scoped to that one gamePk, and derived from a record they created
//     rather than from a consent tap — which is why it needs its own ADR
//     rather than riding the pass's `spoilersOff` flag. It must NOT: the
//     pass's flag also drives the day-pass chrome ("scores are unlocked
//     today"), and a stamped game on an ordinary sealed day would make that
//     copy a lie.
//
// Either alone opens the game and neither cancels the other, so they share one
// branch. When BOTH are off this is the identity:
// the real high-water mark and the real extras-unlock count pass straight
// through. When it's ON, every real half renders as revealed — the RENDER mark
// advances to the game's final half and every inning the game actually has is
// unlocked (extras included: opting into spoilers for the day is opting into
// them, ADR-0008's protection is a *default-mode* guard the pass deliberately
// lifts).
//
// This is the whole spoiler-safety contract of the pass, so read it carefully:
// the values returned here are for RENDERING ONLY. They must never be fed back
// to the ratchet (mergeMark), written to localStorage, or handed to the cloud
// sync — the caller keeps the untouched `revealedThrough` for all of that. The
// pass unseals the screen for today without persisting a single half you didn't
// reveal by hand, so flipping it off (or the 8am reset) drops straight back to
// the real mark with nothing leaked into storage or across devices.
//
// Finite, deliberately not Infinity: an Infinity render mark could reach an
// array index or be stringified into a storage value (parseRevealMark rejects
// 'Infinity' → -1, so it would fail *closed* rather than leak, but there's no
// reason to court it). The last real half-index, halfIndex(actualCount,
// 'bottom'), reveals every half cleanly with an ordinary integer.
//
// `commitReveals` is the OTHER half of the contract, and it is load-bearing: the
// caller MUST stop committing reveals while the pass is on. A render mark alone
// is not enough, because a half that renders revealed mounts its `SealBox`
// force-revealed, and `SealBox` fires `onReveal` whenever it becomes shown — by
// tap OR by the flag (see SealBox.jsx). Wire that straight through to `revealTo`
// and the pass ratchets the REAL mark for every half the user merely looks at:
// written to localStorage, and for a signed-in user propagated to every other
// device by RevealCloudSync. That is exactly what ADR-0026 promises can never
// happen, and what the consent copy means by "it does not track or advance your
// by-hand scoring". So it is false while unlocked. Nothing is lost: under the
// pass there are no seals to tap, so there is no genuine reveal to record.
//
// THE SAME ANSWER, FOR THE SAME REASON, FOR `stamped`. ADR-0026 asks every
// future force-reveal source whether it must also stop the commit, and this one
// must — more urgently, even. The pass expires; a stamp does not. Were a
// stamped game to commit, merely REVISITING one would ratchet a mark the reader
// never earned by hand, write it to localStorage, and push it through
// RevealCloudSync to every device they own — permanently, and for a game whose
// seal they might well want back if they ever unstamp it.
export function effectiveReveal({ scoresUnlocked, stamped, revealedThrough, unlocked, actualCount }) {
  if (!scoresUnlocked && !stamped) {
    return {
      renderRevealedThrough: revealedThrough,
      renderUnlocked: unlocked,
      commitReveals: true,
    }
  }
  return {
    renderRevealedThrough: Math.max(revealedThrough, halfIndex(actualCount, 'bottom')),
    renderUnlocked: actualCount,
    commitReveals: false,
  }
}

// THE CATCH-UP RATCHET (ADR-0054), against any storage-like object — the pure
// half of `catchUpRevealTo` in useRevealProgress.js, which owns the window,
// the try/catch and the cross-tab echo. It is written here, beside `mergeMark`,
// so the one thing that matters about it is checkable: catching up to a live
// game goes THROUGH the ratchet like every other source. It cannot walk a mark
// backward — a reader who has already scored past the live half keeps their
// place — and a hand-mangled stored value cannot make it, since parseRevealMark
// collapses anything that is not a non-negative integer to -1 and -1 loses.
// Returns the mark now stored.
export function catchUpMarkIn(storage, key, idx) {
  if (!key || !Number.isInteger(idx) || idx < 0) return -1
  const next = mergeMark(parseRevealMark(storage.getItem(key)), idx)
  storage.setItem(key, String(next))
  return next
}

// Is "Catch up to live" worth putting on the lineup page at all? Only when the
// tap would move something: there has to BE a half before the target one to
// reveal (a game in the top of the 1st has none — its target is half 0), and
// the reader must not already be at or past it. A reader who has scored further
// than the game has got — which happens on a suspended game resumed later, and
// on any feed whose live half briefly reads behind the plays — gets no offer
// rather than a button that would silently do nothing.
export function offerCatchUp(target, revealedThrough) {
  return target != null && target.idx >= 1 && revealedThrough < target.idx - 1
}
