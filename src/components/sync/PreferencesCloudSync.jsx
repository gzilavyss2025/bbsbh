import { useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
  readPrefsOwner,
  usePreferences,
  writePrefsOwner,
} from '../../hooks/preferences/usePreferences.js'
import { mergeStrategyFor, preferencesToPublish } from '../../lib/account/preferences.js'
import { phaseForResponse, reasonForResponse } from '../../lib/account/syncStatus.js'
import { useSyncReport } from './SyncStatusProvider.jsx'

// Headless — renders nothing, only runs the effects. Only ever mounted when
// isClerkEnabled (see clerkConfig.js), so useAuth() always has a ClerkProvider
// ancestor; App.jsx conditionally renders this component rather than
// conditionally calling a hook, exactly as it does for SpoiledDaysCloudSync and
// StampsCloudSync.
//
// What it syncs: the My Tally preference document — the club you follow, the
// level the slate opens on, keep-awake, motion. Never a score, never anything
// derived from one. It cannot touch `revealedThrough`, the spoiled-day map, or
// the Logbook; each of those has its own key, shape, endpoint and merge rule.
//
// Sync model mirrors its two siblings: localStorage stays the instant,
// offline-first source of truth and this only adds a background merge. A
// signed-out user never calls the endpoint at all, a deploy without the store
// 501s, and either way the app behaves exactly as it does local-only. **A
// preference failure can never block the slate, a game, or a spoiler control** —
// nothing on any of those paths awaits this component, and every failure here
// resolves to "keep using what this device already has."
//
// ---------------------------------------------------------------------------
// WHAT A PULL LEAVES BEHIND — the baseline, and why it is the REMOTE
// ---------------------------------------------------------------------------
// `known` is what we believe the SERVER holds, and every pull overwrites it with
// what the server just said. The publish step then asks `preferencesToPublish` —
// "what do I have that it doesn't?" — so a club chosen before sign-in backfills
// on the first pull instead of sitting on one device forever. That module's
// header carries the full argument; the short version is that a change log
// cannot describe state that never changed, and a comparison can. Both
// SpoiledDaysCloudSync and StampsCloudSync had to be fixed from the former to
// the latter (ADR-0026, 2026-08-06). This one starts there.
//
// ---------------------------------------------------------------------------
// WHOSE DOCUMENT IS IT — the shared-device guard
// ---------------------------------------------------------------------------
// `mergeStrategyFor` decides, from the owner tag this device last wrote, whether
// the local document may be published to the account now signing in:
//
//   backfill  it is this user's document, or nobody's (a guest's own settings).
//             Merge remote in, publish what the server lacks. The ordinary path.
//   adopt     it belongs to a DIFFERENT account — user A synced down on a shared
//             device and user B has now signed in. Take the remote wholesale and
//             publish nothing, so A's club never lands in B's account.
//
// Sign-out clears the in-memory baseline but deliberately NOT the document: a
// signed-out user is still a user, and local-first means the device keeps
// working with what it has. The owner tag is what protects the next account.
export function PreferencesCloudSync() {
  const { isSignedIn, isLoaded, userId, getToken } = useAuth()
  const { prefs, mergeRemote, adoptRemote } = usePreferences()
  const report = useSyncReport()

  // What the server held as of the last successful pull. Null means "we have
  // not heard from the server yet", which suppresses publishing entirely —
  // publishing against an unknown remote would either echo the whole document
  // back or, worse, act on a guess.
  const known = useRef(null)
  // The account this component is currently for, readable from inside an async
  // closure that captured an older one. Written in the effect below, never
  // during render (react-hooks/refs).
  const userIdRef = useRef(userId)
  // One pull at a time. Two overlapping pulls would race to set `known`, and
  // the loser could leave a stale baseline behind.
  const pulling = useRef(false)

  const pull = useCallback(async () => {
    if (pulling.current || !userId) return
    pulling.current = true
    report('prefs', 'pulling')
    try {
      const token = await getToken()
      const res = await fetch('/api/preferences', {
        headers: { Authorization: `Bearer ${token}` },
      })
      // The account can change while this is in flight. Landing a previous
      // user's document — and stamping the owner tag with their id — onto the
      // device the NEXT user is now looking at is the exact leak the owner tag
      // exists to close, reached from the other direction.
      if (userId !== userIdRef.current) return
      if (!res.ok) {
        report('prefs', phaseForResponse(res.status), { reason: reasonForResponse(res.status) })
        return
      }
      const data = await res.json()
      const remote = data?.prefs && typeof data.prefs === 'object' ? data.prefs : {}

      const strategy = mergeStrategyFor(readPrefsOwner(), userId)
      if (strategy === 'adopt') {
        // A different account's document is sitting on this device. Nothing
        // local is this user's to publish, so the baseline is the remote AND
        // the local document becomes it.
        known.current = remote
        adoptRemote(remote)
      } else {
        // Baseline BEFORE the merge: the publish effect below fires on the
        // state change the merge causes, and it must already be comparing
        // against what the server actually has.
        known.current = remote
        mergeRemote(remote)
      }
      // This device's document now belongs to this account either way — which
      // is what makes the NEXT user's sign-in an `adopt`.
      writePrefsOwner(userId)
      report('prefs', 'synced')
    } catch {
      // Offline / unauthorized / store not configured on this deploy — local
      // state stands, which is the whole offline-first contract. `known` keeps
      // its previous value, so nothing publishes against a guess.
      report('prefs', 'error', { reason: 'network' })
    } finally {
      pulling.current = false
    }
  }, [getToken, userId, mergeRemote, adoptRemote, report])

  useEffect(() => {
    userIdRef.current = userId
    if (!isLoaded) return
    if (!isSignedIn) {
      // Signing out forgets what we knew about the server. The next sign-in —
      // possibly as a DIFFERENT user — must not publish this device's
      // preferences against the previous account's baseline.
      known.current = null
      // And it must not be REFUSED a pull either. `pull` drops (rather than
      // defers) a call while one is in flight, so a sign-out mid-pull used to
      // leave this latched true: the next user's sign-in returned immediately,
      // and their device sat showing the previous account's settings until some
      // later focus event happened to re-pull.
      pulling.current = false
      report('prefs', 'local')
      return
    }
    pull()
  }, [isLoaded, isSignedIn, userId, pull, report])

  // A phone and a laptop are both open; the phone changes the club. Without
  // this, the laptop shows the old one until someone reloads it — which is the
  // whole promise of the feature, quietly unmet. Re-pull whenever this device
  // comes back to the foreground, which is exactly when a user looks at it.
  useEffect(() => {
    if (!isSignedIn) return undefined
    const onFocus = () => {
      if (document.visibilityState === 'hidden') return
      pull()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [isSignedIn, pull])

  // Publish what the server is missing.
  useEffect(() => {
    if (!isSignedIn || !userId) return
    // Nothing has been heard from the server yet, so there is no baseline to
    // compare against. The pull above supplies one and this effect re-runs.
    if (known.current === null) return
    // An adopted document is not this device's to publish — the owner tag is
    // rewritten by the pull, so this only holds for the window before it lands.
    if (mergeStrategyFor(readPrefsOwner(), userId) === 'adopt') return

    const changes = preferencesToPublish(prefs, known.current)
    if (changes.length === 0) return

    // Assume these land, so a re-render mid-flight does not fire a second
    // identical publish. A failure ROLLS THIS BACK (below): leaving the
    // optimistic baseline in place told `preferencesToPublish` the server held
    // a value it had never received, and since a pull only happens on focus or
    // reload, a desktop tab that never loses focus dropped that change for the
    // rest of the session — silently, behind an error the user cannot act on.
    const previousKnown = known.current
    const published = { ...known.current }
    for (const change of changes) {
      published[change.field] = { value: change.value, updatedAt: change.updatedAt }
    }
    known.current = published

    ;(async () => {
      let token
      try {
        token = await getToken()
      } catch {
        if (known.current === published) known.current = previousKnown
        report('prefs', 'error', { reason: 'auth' })
        return
      }
      try {
        // One field per request, for the reason api/preferences.js states:
        // absence has to keep meaning "no opinion", so a whole-document POST
        // from a fresh device would tell the server to erase the account.
        const replies = await Promise.all(
          changes.map((change) =>
            fetch('/api/preferences', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'content-type': 'application/json',
              },
              body: JSON.stringify(change),
            }),
          ),
        )
        const failed = replies.find((r) => !r.ok)
        if (failed) {
          if (known.current === published) known.current = previousKnown
          report('prefs', phaseForResponse(failed.status), {
            reason: reasonForResponse(failed.status),
          })
          return
        }
        // The endpoint answers with the whole stored document, so the server's
        // own last-write-wins verdict lands immediately rather than waiting for
        // the next pull. If another device's newer value won, this is where
        // this device finds out and converges. Safe to merge because
        // applyRemotePreferences is itself last-write-wins per field: a value
        // this device just published comes back equal and changes nothing.
        const last = await replies[replies.length - 1].json()
        if (last?.prefs && typeof last.prefs === 'object') {
          known.current = last.prefs
          mergeRemote(last.prefs)
        }
        report('prefs', 'synced')
      } catch {
        // A failed publish costs this device nothing — its own local state is
        // already correct — but the baseline must go back, or the retry never
        // happens.
        if (known.current === published) known.current = previousKnown
        report('prefs', 'error', { reason: 'network' })
      }
    })()
  }, [isSignedIn, userId, getToken, prefs, mergeRemote, report])

  return null
}
