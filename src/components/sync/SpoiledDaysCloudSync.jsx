import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { readSpoiledDaysOwner, useScoresUnlocked } from '../../hooks/useScoresUnlocked.js'
import { dayStatesToPublish } from '../../lib/spoiledDays.js'
import { mergeStrategyFor } from '../../lib/account/preferences.js'
import { phaseForResponse, reasonForResponse } from '../../lib/account/syncStatus.js'
import { useSyncReport } from './SyncStatusProvider.jsx'

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
// Sync model mirrors RevealCloudSync and StampsCloudSync: localStorage stays the
// instant, offline-first source of truth and this only adds a background merge.
// On mount/sign-in, GET the remote state map and apply it via mergeRemoteDays.
// Afterwards, publish what this device holds that the server doesn't. A signed-out
// user never calls the endpoint at all, and a deploy without the store 501s —
// either way the app behaves exactly as it does local-only.
//
// Why local state is published one day at a time, as an explicit state: absence
// has to keep meaning "no opinion". If this posted the whole list, a fresh device
// with an empty list would tell the server to erase every day the user ever
// consented to. Posting `{ day, state }` says only what this device actually
// decided — and lets a withdrawal travel as a real 'off' rather than being
// inferred from a gap, which is what stops a stale remote 'on' from silently
// reversing a same-day undo. See spoiledDays.js's sync header.
//
// ---------------------------------------------------------------------------
// WHAT A PULL LEAVES BEHIND — the baseline, and why it is the REMOTE
// ---------------------------------------------------------------------------
// `known` is what we believe the SERVER holds, and every pull overwrites it with
// what the server just said. The publish step then asks `dayStatesToPublish` —
// "what do I have that it doesn't?" — so consent that predates sign-in backfills
// on the first pull instead of sitting on one device forever.
//
// This used to be a CHANGE LOG instead: it diffed each new list against the last
// one it saw, with the first observation establishing a silent baseline. A device
// holding days from before sign-in therefore saw no change, published nothing, and
// never would; the owner's second device signed in to an empty map. That module's
// header has the full argument, and `stampsToPublish` (src/lib/stamps.js)
// is the same fix for the identical defect in the Logbook.
//
// The one thing a comparison can't see is a WITHDRAWAL, since the local list keeps
// no tombstones — so `seen` (this device's list as of the last look) is still kept,
// and is the sole input to the explicit 'off' rows. It is deliberately not enough
// on its own: an 'off' also requires the server to still say 'on', which is what
// keeps a day the merge itself removed from being echoed back at the server that
// sent it. That replaces the old `merging` flag, which had to suppress the whole
// publish pass — including the backfill the merge is the trigger for.
// The `report(...)` calls below are new and change no behaviour: every catch
// block stays exactly where it was, still swallows, and still leaves
// localStorage authoritative. They only stop it being SILENT — which is how
// ADR-0022's total production failure hid for weeks, and what My Tally's sync
// receipt exists to make visible.
//
// ---------------------------------------------------------------------------
// WHOSE CONSENT IS THIS? — the shared-device guard (SPOILED_DAYS_OWNER_KEY)
// ---------------------------------------------------------------------------
// The list is keyed by nothing but itself, so on a shared
// device it belongs to whoever last used the browser rather than to whoever is
// signed in — and a consent that arrives because someone else used this browser
// is not a consent at all. `OwnerGuards` settles that on the sign-in
// transition, ahead of this component's pull, because the slate paints from the
// local list before a request can return. The publish effect below still checks,
// as a second line: the two are separate mounts with no ordering guarantee.
export function SpoiledDaysCloudSync() {
  const { isSignedIn, userId, getToken } = useAuth()
  const { spoiledDays, mergeRemoteDays } = useScoresUnlocked()
  const report = useSyncReport()

  // What the server held as of the last successful pull. Starts null for "we have
  // not heard from the server yet", which suppresses publishing entirely —
  // publishing against an unknown remote would either echo the whole list back or,
  // worse, act on a guess.
  const known = useRef(null)
  // This device's list as of the last look, so a day that DISAPPEARED locally can
  // be told from a day this device simply never had. Only the first of those is a
  // withdrawal.
  const seen = useRef(null)

  // Pull remote state once per sign-in.
  useEffect(() => {
    if (!isSignedIn) {
      // Signing out forgets what we knew about the server. The next sign-in —
      // possibly as a DIFFERENT user — must not publish this device's consent
      // against the previous account's baseline.
      known.current = null
      seen.current = null
      report('spoiledDays', 'local')
      return undefined
    }
    let cancelled = false
    ;(async () => {
      report('spoiledDays', 'pulling')
      try {
        const token = await getToken()
        const res = await fetch('/api/spoiled-days', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          report('spoiledDays', phaseForResponse(res.status), {
            reason: reasonForResponse(res.status),
          })
          return
        }
        if (cancelled) return
        const data = await res.json()
        if (cancelled || !data?.days || typeof data.days !== 'object') return
        // Baseline BEFORE the merge: the publish effect below fires on the state
        // change the merge causes, and it must already be comparing against what
        // the server actually has. The `cancelled` checks are what keep a reply
        // that lands after a sign-out from re-seeding that baseline with the
        // previous account's map.
        known.current = data.days
        mergeRemoteDays(data.days)
        report('spoiledDays', 'synced')
      } catch {
        // Offline / unauthorized / store not configured on this deploy — local
        // state stands, which is the whole offline-first contract. `known` keeps
        // its previous value, so nothing publishes against a guess.
        report('spoiledDays', 'error', { reason: 'network' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isSignedIn, getToken, mergeRemoteDays, report])

  // Publish what the server is missing.
  useEffect(() => {
    if (!isSignedIn) return
    const previous = seen.current
    seen.current = spoiledDays
    // Nothing has been heard from the server yet, so there is no baseline to
    // compare against. The pull above supplies one and this effect re-runs.
    if (known.current === null) return

    // An adopted list is not this device's to publish. The owner tag is written
    // by the guard on sign-in, so this only holds for the window before it
    // lands — after which the list itself is empty anyway.
    if (mergeStrategyFor(readSpoiledDaysOwner(), userId) === 'adopt') return

    const changes = dayStatesToPublish(spoiledDays, known.current, previous)
    if (changes.length === 0) return

    // Assume these land. A publish that fails leaves the server without them, and
    // the next pull's comparison finds them again — self-healing, where a
    // pessimistic baseline would republish the whole list on every render.
    const published = { ...known.current }
    for (const { day, state } of changes) published[day] = state
    known.current = published

    ;(async () => {
      try {
        const token = await getToken()
        const replies = await Promise.all(
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
        const failed = replies.find((r) => !r.ok)
        report(
          'spoiledDays',
          failed ? phaseForResponse(failed.status) : 'synced',
          failed ? { reason: reasonForResponse(failed.status) } : {},
        )
      } catch {
        // A failed publish costs this device nothing — its own local state is
        // already correct, and the next pull's comparison finds these again.
        report('spoiledDays', 'error', { reason: 'network' })
      }
    })()
  }, [isSignedIn, userId, getToken, spoiledDays, report])

  return null
}
