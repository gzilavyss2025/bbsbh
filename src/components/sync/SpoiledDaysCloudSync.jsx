import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useScoresUnlocked } from '../../hooks/useScoresUnlocked.js'

// Headless — renders nothing, only runs the effects. Only ever mounted when
// isClerkEnabled (see clerkConfig.js), so useAuth() always has a ClerkProvider
// ancestor; App.jsx conditionally renders this component rather than
// conditionally calling a hook, exactly as InningViewer does for
// RevealCloudSync.
//
// What it syncs: the set of days the user has consented to spoil (ADR-0026) —
// consent, never scoring progress and never a score. It cannot touch
// `revealedThrough`; that has its own key, its own shape, and its own sync
// (RevealCloudSync / ADR-0022).
//
// Sync model mirrors RevealCloudSync: localStorage stays the instant,
// offline-first source of truth and this only adds a background merge. On
// mount/sign-in, GET the remote state map and apply it via mergeRemoteDays.
// Afterwards, publish each local change as it happens. A signed-out user never
// calls the endpoint at all, and a deploy without the store 501s — either way
// the app behaves exactly as it does local-only.
//
// Why local changes are published one day at a time, as an explicit state:
// absence has to keep meaning "no opinion". If this posted the whole list, a
// fresh device with an empty list would tell the server to erase every day the
// user ever consented to. Posting `{ day, state }` says only what this device
// actually decided — and lets a withdrawal travel as a real 'off' rather than
// being inferred from a gap, which is what stops a stale remote 'on' from
// silently reversing a same-day undo. See spoiledDays.js's sync header.
export function SpoiledDaysCloudSync() {
  const { isSignedIn, getToken } = useAuth()
  const { spoiledDays, mergeRemoteDays } = useScoresUnlocked()

  // The list as of the last time we either published or merged, so a change can
  // be diffed into the specific days that moved. Starts null so the very first
  // observation establishes a baseline instead of publishing everything.
  const known = useRef(null)
  // Set while a remote merge is being applied, so the resulting change to
  // `spoiledDays` isn't immediately echoed back to the server it came from.
  const merging = useRef(false)

  // Pull remote state once per sign-in.
  useEffect(() => {
    if (!isSignedIn) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        const res = await fetch('/api/spoiled-days', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled || !data?.days) return
        merging.current = true
        mergeRemoteDays(data.days)
      } catch {
        // Offline / unauthorized / store not configured on this deploy — local
        // state stands, which is the whole offline-first contract.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isSignedIn, getToken, mergeRemoteDays])

  // Publish local changes.
  useEffect(() => {
    if (!isSignedIn) return
    const prev = known.current
    known.current = spoiledDays
    // First observation: nothing to publish, just establish the baseline.
    if (prev === null) return
    // The change we just applied came FROM the server — don't send it back.
    if (merging.current) {
      merging.current = false
      return
    }
    const added = spoiledDays.filter((d) => !prev.includes(d))
    const removed = prev.filter((d) => !spoiledDays.includes(d))
    const changes = [
      ...added.map((day) => ({ day, state: 'on' })),
      ...removed.map((day) => ({ day, state: 'off' })),
    ]
    if (changes.length === 0) return
    ;(async () => {
      try {
        const token = await getToken()
        await Promise.all(
          changes.map((change) =>
            fetch('/api/spoiled-days', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'content-type': 'application/json',
              },
              body: JSON.stringify(change),
            }),
          ),
        )
      } catch {
        // A failed publish costs this device nothing — its own local state is
        // already correct, and the next change (or the next sign-in fetch on
        // another device) reconciles.
      }
    })()
  }, [isSignedIn, getToken, spoiledDays])

  return null
}
