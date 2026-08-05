import { useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useStamps } from '../../hooks/useStamps.js'
import { stampsToPublish } from '../../lib/stamps.js'
import { revealMarkFor } from '../../hooks/useRevealProgress.js'

// Headless — renders nothing, only runs the effects. Only ever mounted when
// isClerkEnabled (see clerkConfig.js), so useAuth() always has a ClerkProvider
// ancestor; App.jsx conditionally renders this component rather than
// conditionally calling a hook, exactly as it does for SpoiledDaysCloudSync and
// as InningViewer does for RevealCloudSync.
//
// Sync model mirrors those two: localStorage (via useStamps) stays the instant,
// offline-first source of truth, and this only adds a background merge on top.
// On sign-in, GET the whole collection and merge it in; afterwards, publish each
// local change as it happens. A signed-out user never calls /api/stamps at all,
// and a deploy without Redis 501s — either way the Logbook behaves exactly as it
// does local-only.
//
// ---------------------------------------------------------------------------
// THE REVEAL PUSH — read this before touching `publish`
// ---------------------------------------------------------------------------
// `POST /api/stamps` refuses to mint unless the SERVER can prove this user
// already revealed the game, by reading their own `reveal:{userId}:{gamePk}`
// ratchet or their spoiled-day consent map. That is the invariant the whole
// Logbook rests on (ADR-0035), and it is not negotiable.
//
// It leaves one gap, which the ADR names explicitly: reveal sync is opt-in and
// only populated for signed-in users, so a game revealed BEFORE signing in has
// no server mark, and its perfectly legitimate stamp would be refused. The one
// sanctioned fix is the one below — push this device's local `revealedThrough`
// to /api/reveal first, then mint. That endpoint is a one-directional ratchet
// (it can only ever move the mark forward, and it stores a half-index, never a
// score), so feeding it is safe in a way that weakening the gate would not be.
//
// Do NOT "simplify" this into sending the mark along with the mint, or into
// having the server trust a claim in the request body. The gate must keep
// reading only keys the server itself wrote.
//
// ---------------------------------------------------------------------------
// Removals propagate BOTH ways — read `state`, never assume it
// ---------------------------------------------------------------------------
// An un-stamp travels to the server as a tombstone (DELETE writes `state:
// 'off'`), and `GET /api/stamps?export=1` — the sync payload — returns those
// tombstones alongside the live stamps. That is what lets a SECOND device learn
// a stamp was removed: `applyRemoteStamps` takes the incoming 'off' by
// last-write-wins on `updatedAt` and the stamp drops out of the collection.
//
// So the merge below must read each row's own `state`. It used to hardcode
// 'on', which was the client half of why removals propagated one way: even
// once the endpoint started returning tombstones, this would have merged them
// straight back in as live stamps. Absence still means "no opinion" — only an
// explicit 'off' is a removal.
//
// ---------------------------------------------------------------------------
// WHAT A PULL LEAVES BEHIND — the baseline, and why it is the REMOTE
// ---------------------------------------------------------------------------
// `known` is what we believe the SERVER holds, and every pull overwrites it
// with what the server just said. The publish step then asks
// `stampsToPublish(local, known)` — "what do I have that it doesn't?" — so a
// collection that predates sign-in backfills on the first pull instead of
// sitting on one device forever. That module's header has the full argument;
// the short version is that a change log can't describe a collection that never
// changed, and a comparison can.
export function StampsCloudSync() {
  const { isSignedIn, getToken } = useAuth()
  const { stamps, mergeRemoteStamps } = useStamps()

  // What the server held as of the last successful pull. Starts null for "we
  // have not heard from the server yet", which suppresses publishing entirely —
  // publishing against an unknown remote would either echo the whole collection
  // back or, worse, act on a guess.
  const known = useRef(null)
  // One pull at a time. Two overlapping pulls would race to set `known`, and
  // the loser could leave a stale baseline behind.
  const pulling = useRef(false)

  const pull = useCallback(async () => {
    if (pulling.current) return
    pulling.current = true
    try {
      const token = await getToken()
      // The whole collection in one call rather than a season at a time: the
      // merge has to see every season anyway to be correct, and the export
      // route already returns exactly that.
      const res = await fetch('/api/stamps?export=1', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      if (!Array.isArray(data?.stamps)) return
      // The endpoint returns a list joined against the shared facts cache;
      // the local store is keyed by gamePk and holds no facts, so drop the
      // `game` blob on the way in. (The Logbook resolves facts itself — see
      // src/api/logbook.js — so nothing is lost by not keeping them.)
      const remote = {}
      for (const entry of data.stamps) {
        if (entry?.gamePk == null) continue
        remote[entry.gamePk] = {
          // Whatever the row says. A pre-fix deploy sends no `state` at all
          // and every row it sends is live, so the fallback is 'on'.
          state: entry.state === 'off' ? 'off' : 'on',
          mode: entry.mode,
          stampedAt: entry.stampedAt,
          updatedAt: entry.updatedAt,
          note: entry.note,
          date: entry.date,
          // Where it sits in the passport book. Built field by field here,
          // so anything not listed is dropped on the way in — a placement
          // left off this object would arrive as "unplaced" and empty the
          // book on every sign-in.
          placement: entry.placement ?? null,
        }
      }
      // Baseline BEFORE the merge: the publish effect below fires on the state
      // change the merge causes, and it must already be comparing against what
      // the server actually has.
      known.current = remote
      mergeRemoteStamps(remote)
    } catch {
      // Offline / unauthorized / store not configured on this deploy — local
      // state stands, which is the whole offline-first contract. `known` keeps
      // its previous value, so nothing publishes against a guess.
    } finally {
      pulling.current = false
    }
  }, [getToken, mergeRemoteStamps])

  useEffect(() => {
    if (!isSignedIn) {
      // Signing out forgets what we knew about the server. The next sign-in —
      // possibly as a DIFFERENT user — must not publish this device's stamps
      // against the previous account's baseline.
      known.current = null
      return
    }
    pull()
  }, [isSignedIn, pull])

  // A phone and a laptop are both open; the phone stamps a game. Without this,
  // the laptop shows the old collection until someone reloads it — which is the
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

  useEffect(() => {
    if (!isSignedIn) return
    // Nothing has been heard from the server yet, so there is no baseline to
    // compare against. The pull above supplies one and this effect re-runs.
    if (known.current === null) return

    // What this device holds that the server doesn't, or holds a newer version
    // of. Whole-record comparison, so editing a note, switching
    // watched/followed, or moving a stamp on its page all publish too.
    //
    // A record that vanished locally (a hand-cleared key, a cross-version drop)
    // is deliberately NOT published as a removal: absence has to keep meaning
    // "no opinion", or a fresh device would erase the collection. Only an
    // explicit 'off' tombstone travels as a removal.
    const changed = stampsToPublish(stamps, known.current)
      .map((gamePk) => [gamePk, stamps[gamePk]])
      .filter(([, entry]) => entry)
    if (changed.length === 0) return

    // Assume these land. A publish that fails leaves the server without them,
    // and the next pull's comparison finds them again — self-healing, where a
    // pessimistic baseline would republish the whole collection on every render.
    const published = { ...known.current }
    for (const [gamePk, entry] of changed) published[gamePk] = entry
    known.current = published

    ;(async () => {
      let token
      try {
        token = await getToken()
      } catch {
        return
      }
      const auth = { Authorization: `Bearer ${token}` }

      await Promise.all(
        changed.map(async ([gamePk, entry]) => {
          try {
            if (entry.state === 'off') {
              await fetch(`/api/stamps?gamePk=${gamePk}`, { method: 'DELETE', headers: auth })
              return
            }
            // See THE REVEAL PUSH above. Best-effort and deliberately not
            // awaited-for-success: a user whose mark is already on the server,
            // or who qualifies through the spoiled-day map instead, mints fine
            // without it, and a failure here should cost a mint attempt, not
            // skip it.
            const mark = revealMarkFor(gamePk)
            if (mark >= 0) {
              await fetch(`/api/reveal?gamePk=${gamePk}`, {
                method: 'POST',
                headers: { ...auth, 'content-type': 'application/json' },
                body: JSON.stringify({ revealedThrough: mark }),
              }).catch(() => {})
            }
            await fetch('/api/stamps', {
              method: 'POST',
              headers: { ...auth, 'content-type': 'application/json' },
              body: JSON.stringify({
                gamePk,
                mode: entry.mode,
                note: entry.note,
                placement: entry.placement ?? null,
              }),
            })
          } catch {
            // A failed publish costs this device nothing — its own local state
            // is already correct, and the next change (or another device's next
            // sign-in fetch) reconciles.
          }
        }),
      )
    })()
  }, [isSignedIn, getToken, stamps])

  return null
}
