import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { readBooksOwner, useBooks, writeBooksOwner } from '../../hooks/useBooks.js'
import { booksToPublish } from '../../lib/books.js'
import { mergeStrategyFor } from '../../lib/account/preferences.js'
import { phaseForResponse, reasonForResponse } from '../../lib/account/syncStatus.js'
import { useSyncReport } from './SyncStatusProvider.jsx'

// Headless — renders nothing, only runs the effects. Only ever mounted when
// isClerkEnabled (see clerkConfig.js), so useAuth() always has a
// ClerkProvider ancestor; App.jsx conditionally renders this component rather
// than conditionally calling a hook, exactly as it does for
// SpoiledDaysCloudSync and StampsCloudSync.
//
// What it syncs: a book's COVER — id, title, subtitle, cover club, and what is
// stamped on it (`coverMark`/`coverColor`, the league-mark presets) (ADR-0036).
// Never the stamps filed inside it. Which stamps belong to which book lives on
// the STAMP record's own `placement.bookId` (src/lib/stamps.js) and travels
// with StampsCloudSync, not here.
//
// Sync model mirrors SpoiledDaysCloudSync exactly, `known`/`seen` refs and
// all — not StampsCloudSync's single-ref shape. The reason is the shape of the
// LOCAL store: `useStamps()` hands StampsCloudSync the raw map, tombstones
// included, so a removal is right there to read off `entry.state`.
// `useBooks()` deliberately does not — its public `books` is `listBooks(map)`,
// LIVE ONLY (see the hook's own comments on `list`), on the same footing as
// `useScoresUnlocked()`'s plain day list. So a book this device removed is not
// distinguishable from a book it never had by looking at `books` alone; the
// `seen` ref — this device's live books as of the last look — is what tells
// the two apart, exactly as SpoiledDaysCloudSync's `seen` does for a day that
// disappeared from the local list.
//
// localStorage (via useBooks) stays the instant, offline-first source of
// truth and this only adds a background merge on top. On mount/sign-in, GET
// the remote collection and apply it via `mergeRemoteBooks`. Afterwards,
// publish what this device holds that the server doesn't. A signed-out user
// never calls the endpoint at all, and a deploy without the store 501s —
// either way the shelf behaves exactly as it does local-only.
//
// ---------------------------------------------------------------------------
// WHAT A PULL LEAVES BEHIND — the baseline, and why it is the REMOTE
// ---------------------------------------------------------------------------
// Restating SpoiledDaysCloudSync's own header for this data, rather than
// re-deriving it: `known` is what we believe the SERVER holds, and every pull
// overwrites it with what the server just said. The publish step then asks
// `booksToPublish` — "what do I have that it doesn't?" — so a shelf that
// predates sign-in backfills on the first pull instead of sitting on one
// device forever. `src/lib/books.js`'s own header on `booksToPublish` — "WHY
// THIS IS A COMPARISON AND NOT A CHANGE LOG" — makes the identical argument
// for books that SpoiledDaysCloudSync's header makes for days (and
// `stampsToPublish` made for stamps): a device that only diffs
// against the last thing IT observed can never describe a collection that
// predates that first observation, so read either header rather than this
// one for the full case.
//
// `booksToPublish(local, remote)` wants a LOCAL MAP, tombstones included —
// that is what `src/lib/books.js` itself works with internally, and it is
// exactly what `useBooks()` does not hand this component. So `local` below is
// assembled by hand each render: every book currently live, plus — for any id
// that was live in `seen` and is not live now — a synthetic `state: 'off'`
// entry stamped with the current time. That synthetic tombstone is never
// written to localStorage; it exists only long enough for one comparison
// against `known.current`, the same way `dayStatesToPublish`'s `previous`
// argument exists only to answer "did this device just take one back", never
// to be stored itself.
//
// ---------------------------------------------------------------------------
// WHOSE SHELF IS THIS? — the shared-device guard (BOOKS_OWNER_KEY)
// ---------------------------------------------------------------------------
// Everything above is a COMPARISON, which is what makes it back-fill a shelf
// that predates sign-in — and, on a shared device, exactly what makes it leak.
// A signs in, their shelf syncs down; A signs out (the shelf stays, local-first
// by design); B signs in, the pull sets `known.current` to B's shelf, and
// `booksToPublish` dutifully reports every one of A's books as "missing from
// the server". They then publish into B's account.
//
// Nulling `known`/`seen` on sign-out — which the effect below already did, with
// a comment saying so — does not prevent it. That guards against a STALE
// baseline; here the baseline is perfectly good and belongs to the new user,
// while the shelf on disk still belongs to the old one. Same mechanism, line
// for line, as the stamps leak StampsCloudSync closed.
//
// So the device records WHICH ACCOUNT its shelf was last merged from
// (BOOKS_OWNER_KEY, its own key — see src/lib/books.js) and asks
// `mergeStrategyFor` on every pull. A different account means `adopt`: take the
// remote shelf wholesale and publish nothing. `StampsCloudSync` is the worked
// example this follows.
export function BooksCloudSync() {
  const { isSignedIn, userId, getToken } = useAuth()
  const { books, mergeRemoteBooks, adoptRemoteBooks } = useBooks()
  const report = useSyncReport()

  // What the server held as of the last successful pull. Starts null for "we
  // have not heard from the server yet", which suppresses publishing
  // entirely — publishing against an unknown remote would either echo the
  // whole collection back or, worse, act on a guess.
  const known = useRef(null)
  // This device's LIVE books as of the last look, keyed by id, so a book that
  // DISAPPEARED locally can be told from a book this device simply never had.
  // Only the first of those is a withdrawal.
  const seen = useRef(null)

  // Pull remote state once per sign-in.
  useEffect(() => {
    if (!isSignedIn) {
      // Signing out forgets what we knew about the server. The next sign-in —
      // possibly as a DIFFERENT user — must not publish this device's books
      // against the previous account's baseline.
      known.current = null
      seen.current = null
      report('books', 'local')
      return undefined
    }
    let cancelled = false
    ;(async () => {
      report('books', 'pulling')
      try {
        const token = await getToken()
        const res = await fetch('/api/books', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          report('books', phaseForResponse(res.status), { reason: reasonForResponse(res.status) })
          return
        }
        if (cancelled) return
        const data = await res.json()
        if (cancelled || !Array.isArray(data?.books)) return
        const remote = {}
        for (const book of data.books) {
          if (book?.id == null) continue
          remote[book.id] = book
        }
        // Baseline BEFORE the merge: the publish effect below fires on the
        // state change the merge causes, and it must already be comparing
        // against what the server actually has. The `cancelled` checks are
        // what keep a reply that lands after a sign-out from re-seeding that
        // baseline with the previous account's map.
        known.current = remote
        if (mergeStrategyFor(readBooksOwner(), userId) === 'adopt') {
          // A different account's books are sitting on this device. None of
          // them are this user's to publish, so the remote shelf replaces them
          // outright instead of merging.
          adoptRemoteBooks(remote)
        } else {
          mergeRemoteBooks(remote)
        }
        // This device's shelf now belongs to this account either way, which is
        // what makes the NEXT user's sign-in an `adopt`. Written synchronously
        // after the merge, so the publish effect the merge wakes already reads
        // the settled owner.
        writeBooksOwner(userId)
        report('books', 'synced')
      } catch {
        // Offline / unauthorized / store not configured on this deploy —
        // local state stands, which is the whole offline-first contract.
        // `known` keeps its previous value, so nothing publishes against a
        // guess.
        report('books', 'error', { reason: 'network' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isSignedIn, userId, getToken, mergeRemoteBooks, adoptRemoteBooks, report])

  // Publish what the server is missing.
  useEffect(() => {
    if (!isSignedIn) return
    const previous = seen.current
    const current = {}
    for (const book of books) current[book.id] = book
    seen.current = current

    // Nothing has been heard from the server yet, so there is no baseline to
    // compare against. The pull above supplies one and this effect re-runs.
    if (known.current === null) return

    // An adopted shelf is not this device's to publish. The owner tag is
    // rewritten by the pull, so this only holds for the window before it lands.
    if (mergeStrategyFor(readBooksOwner(), userId) === 'adopt') return

    // The local map `booksToPublish` compares against `known`: every live
    // book, plus an inferred tombstone for any id that just fell out of the
    // live list — see the header above for why `books` alone can't say that.
    const local = { ...current }
    if (previous) {
      for (const [id, book] of Object.entries(previous)) {
        if (!(id in current)) local[id] = { ...book, state: 'off', updatedAt: Date.now() }
      }
    }

    const ids = booksToPublish(local, known.current)
    if (ids.length === 0) return

    // Assume these land. A publish that fails leaves the server without them,
    // and the next pull's comparison finds them again — self-healing, where a
    // pessimistic baseline would republish the whole collection on every
    // render.
    const published = { ...known.current }
    for (const id of ids) published[id] = local[id]
    known.current = published

    ;(async () => {
      let token
      try {
        token = await getToken()
      } catch {
        report('books', 'error', { reason: 'auth' })
        return
      }
      const auth = { Authorization: `Bearer ${token}` }

      const outcomes = await Promise.all(
        ids.map(async (id) => {
          const entry = local[id]
          try {
            if (entry.state === 'off') {
              const res = await fetch(`/api/books?id=${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: auth,
              })
              return res.ok ? null : res.status
            }
            const res = await fetch('/api/books', {
              method: 'POST',
              headers: { ...auth, 'content-type': 'application/json' },
              body: JSON.stringify({
                id: entry.id,
                title: entry.title,
                subtitle: entry.subtitle,
                coverTeamId: entry.coverTeamId,
                coverMark: entry.coverMark,
                coverColor: entry.coverColor,
              }),
            })
            return res.ok ? null : res.status
          } catch {
            // A failed publish costs this device nothing — its own local
            // state is already correct, and the next pull's comparison finds
            // it again. It must still be REPORTED.
            return undefined
          }
        }),
      )
      // `null` is a success, a number is an HTTP failure, `undefined` is a
      // throw. `find` cannot be used here: it returns `undefined` both for
      // "no failure" and for "a network failure", which are opposite answers.
      const failures = outcomes.filter((outcome) => outcome !== null)
      if (failures.length === 0) {
        report('books', 'synced')
      } else {
        const status = failures.find((outcome) => outcome !== undefined)
        report('books', status === undefined ? 'error' : phaseForResponse(status), {
          reason: status === undefined ? 'network' : reasonForResponse(status),
        })
      }
    })()
  }, [isSignedIn, userId, getToken, books, report])

  return null
}
