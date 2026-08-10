import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  STAMPS_KEY,
  addStamp,
  allStamps,
  applyRemoteStamps,
  parseStamps,
  placeStamp,
  placeStamps,
  removeStamp,
  seasonCounts,
  seasonIsFull,
  serializeStamps,
  stampFor,
  stampsForSeason,
  unplaceStamp,
} from '../lib/stamps.js'

// The Logbook's React entry point (ADR-0035). Mirrors useRevealProgress.js: the
// rules are the React-free core in src/lib/stamps.js (unit-tested there, and
// shared verbatim with the serverless function so client and server cannot
// disagree about what a valid stamp is); this hook owns only the storage I/O and
// the React wiring.
//
// LOCAL-FIRST, and that is not a fallback posture — it is the design. Stamps
// minted before sign-in still land on this device; signing in merges that local
// collection upward through StampsCloudSync before LogbookPage renders the book.
// A deploy without Clerk continues to use this store directly, exactly as it
// does for the reveal mark and the spoiled-day map.
//
// WHAT IS NOT IN HERE: the score. A local record is
// `{ state, mode, stampedAt, updatedAt, note, date, placement }` and nothing
// else — `placement` being a page number and two fractions saying where the
// stamp sits in the passport book, which is a picture, not a result. So
// localStorage stays as non-score-bearing as `bbsbh:reveal:{gamePk}` already
// is. The Logbook resolves runs, clubs, and venue from the game facts at render
// time (src/api/logbook.js). Do not "cache the score here to save a fetch."

function readStamps() {
  try {
    return parseStamps(window.localStorage.getItem(STAMPS_KEY))
  } catch {
    return {}
  }
}

function writeStamps(map) {
  try {
    window.localStorage.setItem(STAMPS_KEY, serializeStamps(map))
  } catch {
    // Private mode / storage disabled — the collection still works for this
    // session, same degrade as every other preference hook.
  }
}

// A same-tab echo of the `storage` event. The browser fires `storage` only in
// OTHER tabs, so without this the two hook instances that are genuinely mounted
// at once — the mint affordance inside a box score and the app-wide
// StampsCloudSync — would not see each other's writes until a reload. Same
// mechanism, and same reason, as useScoresUnlocked's notifyLocalChange.
function notifyLocalChange() {
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: STAMPS_KEY }))
  } catch {
    // StorageEvent unavailable — cross-instance updates degrade to next render.
  }
}

export function useStamps() {
  const [stamps, setStamps] = useState(readStamps)

  // The latest collection this instance knows about, readable synchronously —
  // what `commit` transforms. Every path that changes `stamps` moves it too.
  const latest = useRef(stamps)

  // One writer for every mutation: apply a pure transform from src/lib/stamps.js,
  // persist, then echo so the other mounted instance picks it up. No caller
  // touches localStorage or the map shape directly.
  //
  // The write sits OUTSIDE the state updater on purpose — see useBooks.js's
  // `commit` for the full account, which this hook shares exactly. In short: a
  // write inside a reducer is a side effect React may run twice, once, or never,
  // and "never" is what happens when the same handler that mutates also
  // navigates away. Un-placing several stamps at once (removing a book that
  // holds them) is this hook's own instance of it: only the first un-placement
  // was ever applied, because React eagerly evaluates only the first update
  // queued on a fiber and the rest were discarded with the unmount.
  const commit = useCallback((transform) => {
    const next = transform(latest.current)
    if (next !== latest.current) {
      latest.current = next
      writeStamps(next)
      setStamps(next)
    }
    notifyLocalChange()
  }, [])

  // Stamp a game. `date` is the game's officialDate — it is what decides the
  // season shard, so a record without one is refused by addStamp rather than
  // filed under a season that doesn't exist.
  const stamp = useCallback(
    (gamePk, { mode, note, date } = {}) => {
      commit((prev) => addStamp(prev, gamePk, { mode, note, date, now: Date.now() }))
    },
    [commit],
  )

  // Un-stamp. Writes an explicit 'off' tombstone rather than deleting — see
  // applyRemoteStamps in src/lib/stamps.js for why deleting would resurrect the
  // stamp on the next sync.
  const unstamp = useCallback(
    (gamePk) => {
      commit((prev) => removeStamp(prev, gamePk, { now: Date.now() }))
    },
    [commit],
  )

  // The only way a remote collection reaches local state (StampsCloudSync).
  // Last-write-wins per gamePk on `updatedAt`, deliberately NOT a union: a
  // union would resurrect a stamp the user just took back on this device.
  const mergeRemoteStamps = useCallback(
    (remote) => {
      commit((prev) => applyRemoteStamps(prev, remote))
    },
    [commit],
  )

  useEffect(() => {
    function onStorage(e) {
      // `key === null` is a whole-storage clear, which is also our business.
      if (e.key !== STAMPS_KEY && e.key !== null) return
      // A plain eager read, safe only because `commit` above writes BEFORE it
      // echoes. This had to be `setStamps(() => readStamps())` while the write
      // lived inside another updater that had not run yet: an eager read then
      // queued the pre-change collection behind the change, and on /logbook
      // that looked like placing a stamp doing nothing at all until a reload.
      // With the write hoisted out, storage already holds the new value here.
      // The ref moves with the state so the next commit transforms what this
      // device actually holds — including a change from another tab.
      const next = readStamps()
      latest.current = next
      setStamps(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Put a stamp on a page of the passport book, or move one already there.
  // Goes through the same commit path as every other change, so a placement
  // syncs to the user's other devices exactly like a note edit does.
  const place = useCallback(
    (gamePk, placement) => {
      commit((prev) => placeStamp(prev, gamePk, placement, { now: Date.now() }))
    },
    [commit],
  )

  // Take a placed stamp back off the page — "re-stamp the page". The keepsake
  // survives; only its position is cleared, and it returns to the tray.
  const unplace = useCallback(
    (gamePk) => {
      commit((prev) => unplaceStamp(prev, gamePk, { now: Date.now() }))
    },
    [commit],
  )

  // A whole batch at once — the book's "place them all for me" control, and
  // what a collection that predates the book needs so nobody is made to place
  // forty keepsakes by hand.
  const placeAll = useCallback(
    (placements) => {
      commit((prev) => placeStamps(prev, placements, { now: Date.now() }))
    },
    [commit],
  )

  // Every live stamp, oldest first — the passport book's reading order, and
  // the input the retrospective aggregates over.
  //
  // There is deliberately no `unplaced` list here any more. Which stamps are
  // waiting in the tray is not answerable from a placement alone: one naming a
  // book that is no longer on the shelf is waiting too, and this module has no
  // business knowing which books exist (see the header). LogbookCollection.jsx
  // owns that list, where both halves of the question are in scope.
  const all = useMemo(() => allStamps(stamps), [stamps])

  const counts = useMemo(() => seasonCounts(stamps), [stamps])
  // Newest season first — the Logbook's season nav, and the default season the
  // bare /logbook route lands on.
  const seasons = useMemo(
    () => Object.keys(counts).map(Number).sort((a, b) => b - a),
    [counts],
  )

  return {
    stamps,
    counts,
    seasons,
    stampFor: useCallback((gamePk) => stampFor(stamps, gamePk), [stamps]),
    isStamped: useCallback((gamePk) => stampFor(stamps, gamePk) != null, [stamps]),
    forSeason: useCallback((season) => stampsForSeason(stamps, season), [stamps]),
    seasonIsFull: useCallback((season) => seasonIsFull(stamps, season), [stamps]),
    all,
    stamp,
    unstamp,
    place,
    unplace,
    placeAll,
    mergeRemoteStamps,
  }
}
