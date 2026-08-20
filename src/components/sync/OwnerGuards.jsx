import { useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
  clearBoxRevealMarks,
  clearRevealMarks,
  readBoxRevealOwner,
  readRevealOwner,
  writeBoxRevealOwner,
  writeRevealOwner,
} from '../../hooks/useRevealProgress.js'
import {
  clearSpoiledDays,
  readSpoiledDaysOwner,
  writeSpoiledDaysOwner,
} from '../../hooks/useScoresUnlocked.js'
import { mergeStrategyFor } from '../../lib/account/preferences.js'

// Headless — renders nothing, makes no request, and runs one effect. The
// shared-device guard for the three channels whose local state is NOT one
// document a pull can replace: the scoring frontier (ADR-0022), the box score's
// own bit (ADR-0049), and the days the reader consented to spoil (ADR-0026).
//
// Only ever mounted when isClerkEnabled (see clerkConfig.js), so useAuth()
// always has a ClerkProvider ancestor; App.jsx renders this conditionally
// rather than calling a hook conditionally, as it does for every *CloudSync.
//
// ---------------------------------------------------------------------------
// THE LEAK, once, for all three
// ---------------------------------------------------------------------------
// A local-first store plus an account leaks on a family iPad. A signs in and
// their state syncs down; A signs out and it STAYS, because local-first means
// the device keeps working with what it has; B signs in, and the device is
// holding A's state as ordinary local state. Two things follow that neither
// person chose: each channel's "what do I have that the server doesn't?"
// comparison publishes A's state into B's account, and — for these three, which
// are RENDER overrides — B is shown scores they never asked to see.
//
// Nulling a sync component's in-memory baseline on sign-out never prevented it.
// That guards a STALE baseline; the baseline after a sign-in is perfectly good
// and belongs to the new user, while the state on disk belongs to the old one.
// The same mistaken reasoning was in the comments of every channel.
//
// ---------------------------------------------------------------------------
// WHY THIS RUNS HERE AND NOT IN THE *CloudSync COMPONENTS
// ---------------------------------------------------------------------------
// Those components decide things after a network round trip, and every surface
// below reads its local state SYNCHRONOUSLY as it first paints:
// `useRevealProgress` in the innings viewer, `useBoxScoreReveal` in the box
// score, `useScoresUnlocked` on the slate. A guard living in a pull would
// decide whether B may see six unsealed innings only after they had painted.
// Two of the three are not even mounted app-wide (RevealCloudSync and
// BoxRevealCloudSync live inside a game), while the marks they sync are read by
// the slate and the scorecard as well.
//
// So the decision is made once, here, on the sign-in transition, before any
// scoring surface is mounted in the ordinary flow. Each `clear*` announces its
// removals as `storage` events, which re-seals a page that somehow IS already
// open — the residual case this cannot get ahead of, covered rather than
// ignored. Each *CloudSync additionally refuses to publish while its own
// strategy reads `adopt`, since this and they are separate mounts with no
// ordering guarantee between them.
//
// ---------------------------------------------------------------------------
// ONE COMPONENT, THREE TAGS — never one shared tag
// ---------------------------------------------------------------------------
// The channels sync independently, over different endpoints. A device that
// reached one but not another must not be recorded as holding both, or the
// first channel to succeed would vouch for the ones that failed. So each check
// below reads and writes its OWN key (`bbsbh:revealOwner`,
// `bbsbh:boxrevealOwner`, `bbsbh:spoiledDaysOwner`) and no state is shared
// between them. They live in one component because they act on one signal at
// one moment, not because they are one fact.
//
// The fourth and fifth channels — stamps and books — guard themselves inside
// their own pulls, and correctly: their `adopt` REPLACES a document with the
// remote one, which needs the remote, which needs the request.
export function OwnerGuards() {
  const { isSignedIn, userId } = useAuth()

  useEffect(() => {
    // 'none' — signed out. Nothing to reconcile against, and every tag is left
    // exactly as it is: a signed-out reader is still a reader, and the tag is
    // what protects the NEXT account, not an erase (mergeStrategyFor's header).
    if (!isSignedIn || !userId) return

    // The scoring frontier. A different account's progress would render halves
    // this reader never uncovered — and the mark is a ratchet, so signing out
    // again would not give the seals back.
    if (mergeStrategyFor(readRevealOwner(), userId) === 'adopt') clearRevealMarks()
    writeRevealOwner(userId)

    // The box score's own bit. Same shape, its own key: a device may have
    // reached one of these endpoints and not the other.
    if (mergeStrategyFor(readBoxRevealOwner(), userId) === 'adopt') clearBoxRevealMarks()
    writeBoxRevealOwner(userId)

    // Consent. The one thing here that must never be inherited: a day that
    // renders plainly because someone else used this browser is not a consent,
    // it is the seal simply being off. The pull that follows merges back the
    // days THIS reader consented to elsewhere.
    if (mergeStrategyFor(readSpoiledDaysOwner(), userId) === 'adopt') clearSpoiledDays()
    writeSpoiledDaysOwner(userId)

    // Every write above also covers the ORDINARY case, `backfill` — a guest who
    // scored four innings, opened a box score, or consented to a day before
    // signing in, and keeps all three. That is what the tag exists to carry UP,
    // and it is what makes the NEXT reader's sign-in an `adopt`.
  }, [isSignedIn, userId])

  return null
}
