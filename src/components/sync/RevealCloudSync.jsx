import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { phaseForResponse, reasonForResponse } from '../../lib/account/syncStatus.js'
import { useSyncReport } from './SyncStatusProvider.jsx'

// Headless — renders nothing, only runs the effects. Only ever mounted when
// isClerkEnabled (see clerkConfig.js), so useAuth() always has a
// ClerkProvider ancestor to read; InningViewer conditionally renders this
// component rather than conditionally calling a hook, since Clerk's hooks
// throw outright with no provider in the tree.
//
// Sync model: localStorage (via useRevealProgress) stays the instant,
// offline-first source of truth — this only adds a background merge on top.
// On mount/sign-in/gamePk change, GET the signed-in user's remote mark and
// ratchet it in via mergeRevealedThrough (the same one-directional guarantee
// revealTo and the cross-tab storage listener already use — see
// useRevealProgress.js). Whenever the local mark advances, POST it so other
// devices pick it up the same way. A signed-out user never calls
// /api/reveal at all — everything behaves exactly as it does today.
// `game` is an optional spoiler-free snapshot (date, team abbreviations/club
// names, doubleheader number, regulation length — see InningViewer's
// gameSnapshot) that rides along on the POST so the server can keep the
// cloud scorebook index (the slate's "pick up your pencil" strip,
// ContinueScoring.jsx) without ever refetching a feed. Never a score.
//
// The `report(...)` calls are new and change no behaviour: every catch block
// stays where it was and still swallows. They only stop it being SILENT, for My
// Tally's sync receipt. Note that this component — alone among the four —
// mounts INSIDE a game (InningViewer), not app-wide, so the `reveal` channel has
// never reported by the time you reach /profile. ProfilePage's
// `normalizeStatus` is what handles that; read its header before assuming a
// silent channel means "local".
export function RevealCloudSync({ gamePk, revealedThrough, mergeRevealedThrough, game = null }) {
  const { isSignedIn, getToken } = useAuth()
  const report = useSyncReport()
  const lastPosted = useRef(-1)

  useEffect(() => {
    lastPosted.current = -1
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
        if (Number.isInteger(data.revealedThrough) && data.revealedThrough >= 0) {
          mergeRevealedThrough(data.revealedThrough)
        }
        report('reveal', 'synced')
      } catch {
        // Offline / API unreachable — localStorage already has the local mark;
        // this device just doesn't get the other devices' progress this time.
        report('reveal', 'error', { reason: 'network' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isSignedIn, gamePk, getToken, mergeRevealedThrough, report])

  useEffect(() => {
    if (!isSignedIn || !gamePk || revealedThrough < 0) return
    if (revealedThrough <= lastPosted.current) return
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        if (cancelled) return
        const res = await fetch(`/api/reveal?gamePk=${gamePk}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(game ? { revealedThrough, game } : { revealedThrough }),
        })
        lastPosted.current = revealedThrough
        report(
          'reveal',
          res.ok ? 'synced' : phaseForResponse(res.status),
          res.ok ? {} : { reason: reasonForResponse(res.status) },
        )
      } catch {
        // Offline / API unreachable — will retry next time revealedThrough
        // advances (or next mount's GET catches this device back up anyway).
        report('reveal', 'error', { reason: 'network' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isSignedIn, gamePk, revealedThrough, getToken, game, report])

  return null
}
