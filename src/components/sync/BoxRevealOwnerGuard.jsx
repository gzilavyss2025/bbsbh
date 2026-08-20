import { useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
  clearBoxRevealMarks,
  readBoxRevealOwner,
  writeBoxRevealOwner,
} from '../../hooks/useRevealProgress.js'
import { mergeStrategyFor } from '../../lib/account/preferences.js'

// Headless — renders nothing, only runs one effect. The shared-device guard for
// the box score's own bit (ADR-0049): "this device's `bbsbh:boxreveal:*` marks
// belong to account X", and if a different account signs in, they come off.
//
// Only ever mounted when isClerkEnabled (see clerkConfig.js), so useAuth()
// always has a ClerkProvider ancestor; App.jsx renders this component
// conditionally rather than calling a hook conditionally, exactly as it does
// for every *CloudSync beside it.
//
// ---------------------------------------------------------------------------
// WHY THIS IS APP-WIDE AND NOT PART OF BoxRevealCloudSync
// ---------------------------------------------------------------------------
// BoxRevealCloudSync mounts INSIDE the box score, and its pull is a network
// round trip. `useBoxScoreReveal` reads the local bit synchronously during that
// screen's first render — so a guard that lived in the pull would decide
// whether B may see the page only AFTER the page had already painted open with
// A's bit. For a channel whose entire content is a render override, "we undo it
// a moment later" is not a fix.
//
// So the decision is made once, app-wide, on the sign-in transition, before any
// scoring surface is mounted in the ordinary flow. `clearBoxRevealMarks`
// announces each removal, which re-seals a page that somehow IS already open —
// the residual case this cannot get ahead of, covered rather than ignored.
//
// Its own owner key, deliberately not shared with the reveal mark, the stamps
// or the preferences: the channels sync independently, and a device that
// reached one endpoint but not another must not be recorded as holding both.
export function BoxRevealOwnerGuard() {
  const { isSignedIn, userId } = useAuth()

  useEffect(() => {
    // 'none' — signed out. Nothing to reconcile against, and the tag is left
    // exactly as it is: local-first means the device keeps working with what it
    // has, and a signed-out reader is still a reader. The tag is what protects
    // the NEXT account, not an erase (mergeStrategyFor's own header).
    if (!isSignedIn || !userId) return
    if (mergeStrategyFor(readBoxRevealOwner(), userId) === 'adopt') {
      // A different account's opened box scores are sitting on this device.
      // None of them are this reader's, and every one of them would render a
      // score they never asked to see.
      clearBoxRevealMarks()
    }
    // This device's bits now belong to this account either way — including the
    // 'backfill' case, which is a reader who opened a box score before signing
    // in and keeps it open afterwards. That write is what makes the NEXT
    // reader's sign-in an `adopt`.
    writeBoxRevealOwner(userId)
  }, [isSignedIn, userId])

  return null
}
