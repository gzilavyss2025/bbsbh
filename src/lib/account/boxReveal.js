// The box score's own bit (ADR-0049) as a React-free rule: which localStorage
// keys hold it, which account those keys belong to, and how to take them off a
// device that is no longer that account's.
//
// Split out of useRevealProgress.js — where the bit's React wiring lives — for
// the reason preferencesStorage.js and localData.js are split the same way: the
// storage object is passed IN, every access is individually guarded, and no
// path here throws, so the rules can be pinned by the unit suite
// (test/box-reveal-owner.test.js) instead of inferred from an effect. The
// storage mechanics are deviceOwner.js's, shared with every other channel's
// owner tag; what is here is what is true of THIS channel.
//
// WHAT IS NOT IN HERE: any value. This module reads key NAMES and removes them.
// The bit itself says only THAT a seal was lifted, never how far or on what
// (ADR-0049), and nothing here even parses it.

import { clearKeysWithPrefixIn, readOwnerIn, writeOwnerIn } from './deviceOwner.js'

// One key per game whose box score has been opened, `bbsbh:boxreveal:{gamePk}`.
// The source of truth for the prefix — useRevealProgress.js imports it rather
// than restating it, so the writer and this sweep cannot drift apart.
export const BOX_REVEAL_PREFIX = 'bbsbh:boxreveal:'

// ---------------------------------------------------------------------------
// WHOSE BITS ARE THESE? — the shared-device leak
// ---------------------------------------------------------------------------
// `bbsbh:boxreveal:{gamePk}` is keyed by gamePk and NOTHING ELSE — no account —
// and nothing cleared it on sign-out. So on a family iPad: A signs in and opens
// a box score, the bit is written locally and POSTed to A's account. A signs
// out; the bit stays, local-first by design. B signs in and opens that game,
// and the box score renders OPEN for B — then publishes into B's account.
//
// This one is spoiler-adjacent rather than account hygiene. The other channels
// leak state; this leaks a RENDER OVERRIDE. The whole point of the bit is that
// the box score renders unsealed without a reveal mark, so B is not inheriting
// a preference — B is shown a score they never asked to see, on a scoring
// surface, which is the thing this app exists to prevent. And `mergeOpened` is
// deliberately one-directional, so B cannot get the seal back by signing out
// again. The bit has to be REMOVED to undo it.
//
// Its own key, not the preferences, stamps or books one: the channels sync
// independently, and a device that reached one endpoint but not another must
// not be recorded as holding this user's marks.
export const BOX_REVEAL_OWNER_KEY = 'bbsbh:boxrevealOwner'

// The 'adopt' half of the shared-device guard: this device's box-reveal bits
// are not this reader's, so they come off. Returns the keys actually removed,
// so the caller can announce each one to whatever is mounted
// (useRevealProgress's `clearBoxRevealMarks` re-seals an open page with it).
// The sweep itself — and why it snapshots the key list first — is
// deviceOwner.js's.
//
// Deliberately a CLEAR and not "ignore the local bit while adopted". Ignoring
// would leave A's bits on disk to resurface if A signs back in, which is
// arguably correct — but it also means every reader of the bit has to know
// about the owner tag, and a reader that forgets shows a score. Removing them
// leaves exactly one rule in one place, and the pull re-establishes B's own.
export function clearBoxRevealMarksIn(storage) {
  return clearKeysWithPrefixIn(storage, BOX_REVEAL_PREFIX)
}

// The account this device's box-reveal bits were last recorded against. Empty
// string for "nobody's yet", which `mergeStrategyFor` reads as a guest's own
// marks and backfills rather than discards — a reader who opened a box score
// before signing in keeps it open afterwards.
export function readBoxRevealOwnerIn(storage) {
  return readOwnerIn(storage, BOX_REVEAL_OWNER_KEY)
}

export function writeBoxRevealOwnerIn(storage, userId) {
  return writeOwnerIn(storage, BOX_REVEAL_OWNER_KEY, userId)
}
