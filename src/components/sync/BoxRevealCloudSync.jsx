import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { phaseForResponse, reasonForResponse } from '../../lib/account/syncStatus.js'
import { useSyncReport } from './SyncStatusProvider.jsx'

// Headless — renders nothing, only runs the effects. The box score's own bit
// (ADR-0049) travelling between a signed-in reader's devices: "I have opened
// this game's box score." One bit per gamePk, over the same `/api/reveal`
// address the half-index mark uses, reported on the same `reveal` channel — it
// is the same family, and My Tally's claim for that channel ("how far you have
// opened each game, carried device to device") already describes it.
//
// WHY ITS OWN COMPONENT rather than two more props on RevealCloudSync. The two
// marks are held by different screens: `revealedThrough` lives in the innings
// viewer, this bit lives in the box score, and the two are never mounted at
// once (they are different steps of GameView). A single component would have to
// take half its inputs as absent on either surface and sync a mark nobody
// passed it. Two small components, each mounted where its fact lives, say what
// they do instead.
//
// Mounted only when isClerkEnabled (see clerkConfig.js), so useAuth() always
// has a ClerkProvider above it — BoxScore renders this conditionally rather
// than calling a hook conditionally, the pattern RevealCloudSync established.
//
// Sync model, identical to its sibling's: localStorage (via useBoxScoreReveal)
// is the instant, offline-first source of truth and this only adds a background
// merge on top. A signed-out reader never calls the endpoint at all, and a
// deploy with no Clerk never loads this file.
//
// BOTH DIRECTIONS FAIL CLOSED, which is the whole spoiler footing of the wire:
// a pull that errors, times out, or answers `boxRevealed: false` leaves the
// seal exactly where it is — an ordinary seal on an ordinary game, one tap from
// open. Nothing here can seal a page that is already open either; `mergeOpened`
// is a latch (useRevealProgress.js), so the only thing this component can do to
// the UI is open a box score its owner already opened somewhere else.
export function BoxRevealCloudSync({ gamePk, opened, mergeOpened }) {
  const { isSignedIn, getToken } = useAuth()
  const report = useSyncReport()
  // Whether this mount has already pushed the bit. There is only ever one value
  // to push, so unlike RevealCloudSync's high-water `lastPosted` this is a
  // plain "done", reset per game.
  const posted = useRef(false)

  useEffect(() => {
    posted.current = false
  }, [gamePk])

  useEffect(() => {
    if (!isSignedIn || !gamePk) {
      if (!isSignedIn) report('reveal', 'local')
      return undefined
    }
    let cancelled = false
    ;(async () => {
      report('reveal', 'pulling')
      try {
        const token = await getToken()
        const res = await fetch(`/api/reveal?gamePk=${gamePk}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          report('reveal', phaseForResponse(res.status), { reason: reasonForResponse(res.status) })
          return
        }
        if (cancelled) return
        const data = await res.json()
        // Strictly `true`. An older deploy's response has no such field at all,
        // and `undefined` must read as "no", not as "probably".
        if (data.boxRevealed === true) mergeOpened()
        report('reveal', 'synced')
      } catch {
        // Offline / API unreachable — this device just does not learn about the
        // other devices' opened box scores this time. The seal stays tappable.
        report('reveal', 'error', { reason: 'network' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isSignedIn, gamePk, getToken, mergeOpened, report])

  useEffect(() => {
    if (!isSignedIn || !gamePk || !opened || posted.current) return
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        if (cancelled) return
        const res = await fetch(`/api/reveal?gamePk=${gamePk}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          // No `revealedThrough`, deliberately: opening a box score is not
          // scoring a half by hand, and a 0 here would claim it was. The
          // endpoint accepts the bit on its own (`plannedWrites`).
          body: JSON.stringify({ boxRevealed: true }),
        })
        posted.current = true
        report(
          'reveal',
          res.ok ? 'synced' : phaseForResponse(res.status),
          res.ok ? {} : { reason: reasonForResponse(res.status) },
        )
      } catch {
        // Offline / API unreachable. The bit is already on this device; the next
        // mount's push (or the other device's own pull) carries it over.
        report('reveal', 'error', { reason: 'network' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isSignedIn, gamePk, opened, getToken, report])

  return null
}
