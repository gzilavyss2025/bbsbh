// The scoring frontier (`bbsbh:reveal:{gamePk}`, ADR-0022) as a React-free rule
// about WHOSE it is, and how it comes off a device that is no longer that
// account's. Storage mechanics are deviceOwner.js's; what is here is what is
// true of THIS channel. Pinned by test/reveal-owner.test.js.
//
// WHAT IS NOT IN HERE: any value. This module reads key NAMES and removes them.
// The mark is a half-index — a fact about the reader, never about a ballpark
// (ADR-0022) — and nothing here even parses one.
import { clearKeysWithPrefixIn, readOwnerIn, writeOwnerIn } from './deviceOwner.js'

// One key per game the reader has scored into, `bbsbh:reveal:{gamePk}`. The
// source of truth for the prefix — useRevealProgress.js imports it rather than
// restating it, so the writer and this sweep cannot drift apart. Note the
// trailing colon: the at-bat cursor below deliberately does not match it, which
// is the same distinction localData.js's REVEAL_PREFIX draws for its count.
export const REVEAL_MARK_PREFIX = 'bbsbh:reveal:'

// The at-bat stepping cursor (ADR-0016) — how far into ONE half the reader has
// stepped. Transient, and not a high-water mark, but it is the same person's
// scoring progress through the same game and it must travel with the mark it
// belongs to. Left behind on an adopt it would open the first half of a game
// B has not touched, which is the leak with an extra step in it.
export const ATBAT_MARK_PREFIX = 'bbsbh:reveal-atbat:'

// ---------------------------------------------------------------------------
// WHOSE PROGRESS IS THIS? — the shared-device leak
// ---------------------------------------------------------------------------
// The reveal mark is keyed by gamePk and NOTHING ELSE — no account — and nothing
// cleared it on sign-out. So on a family iPad: A signs in and scores six innings
// of a game; A signs out and the marks stay, local-first by design; B signs in,
// opens that game, and the innings viewer renders SIX INNINGS ALREADY UNSEALED.
// RevealCloudSync then publishes A's frontier into B's account, where it is
// ratcheted in and travels to every device B owns.
//
// This is the worst of the four channels for the same reason ADR-0022 exists:
// the reveal mark is the single thing the whole spoiler rule is built on. Every
// scoring surface — the innings viewer, the scorecard's ink, the slate's "pick
// up your pencil" strip — reads it. And the mark is a RATCHET, so B cannot get
// the seals back by signing out again. The marks have to be REMOVED.
//
// Its own key, not the preferences, stamps, books or box-score one: the channels
// sync independently, and a device that reached one endpoint but not another
// must not be recorded as holding this user's progress.
export const REVEAL_OWNER_KEY = 'bbsbh:revealOwner'

// The 'adopt' half of the guard. Unlike a preference document or a shelf there
// is nothing to REPLACE these with — the mark is one key per game and the server
// holds only the games this user actually scored — so adopting means taking them
// off and letting each game's own pull re-establish B's. Returns every key
// removed, so the caller can announce each one to whatever is mounted.
//
// Both prefixes go together, deliberately. They are two halves of one reader's
// position in one game, and a sweep that took only the high-water mark would
// leave a cursor pointing into a half B has never opened.
export function clearRevealMarksIn(storage) {
  return [
    ...clearKeysWithPrefixIn(storage, REVEAL_MARK_PREFIX),
    ...clearKeysWithPrefixIn(storage, ATBAT_MARK_PREFIX),
  ]
}

// The account this device's reveal marks were last held for. Empty string for
// "nobody's yet", which `mergeStrategyFor` reads as a guest's own progress and
// backfills rather than discards — scoring four innings before signing in and
// keeping them is the case the tag exists to carry UP.
export function readRevealOwnerIn(storage) {
  return readOwnerIn(storage, REVEAL_OWNER_KEY)
}

export function writeRevealOwnerIn(storage, userId) {
  return writeOwnerIn(storage, REVEAL_OWNER_KEY, userId)
}
