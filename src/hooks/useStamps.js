import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  STAMPS_KEY,
  addStamp,
  applyRemoteStamps,
  parseStamps,
  removeStamp,
  seasonCounts,
  seasonIsFull,
  serializeStamps,
  stampFor,
  stampsForSeason,
} from '../lib/stamps.js'

// The Logbook's React entry point (ADR-0035). Mirrors useRevealProgress.js: the
// rules are the React-free core in src/lib/stamps.js (unit-tested there, and
// shared verbatim with the serverless function so client and server cannot
// disagree about what a valid stamp is); this hook owns only the storage I/O and
// the React wiring.
//
// LOCAL-FIRST, and that is not a fallback posture — it is the design. A
// signed-out user gets a working Logbook on this device; signing in merges the
// collection upward through StampsCloudSync. Clerk stays optional, exactly as it
// does for the reveal mark and the spoiled-day map.
//
// WHAT IS NOT IN HERE: the score. A local record is
// `{ state, mode, stampedAt, updatedAt, note, date }` and nothing else, so
// localStorage stays as non-score-bearing as `bbsbh:reveal:{gamePk}` already is.
// The Logbook resolves runs, clubs, and venue from the game facts at render time
// (src/api/logbook.js). Do not "cache the score here to save a fetch."

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

  // One writer for every mutation: apply a pure transform from src/lib/stamps.js,
  // persist, then echo so the other mounted instance picks it up. No caller
  // touches localStorage or the map shape directly.
  const commit = useCallback((transform) => {
    setStamps((prev) => {
      const next = transform(prev)
      if (next === prev) return prev
      writeStamps(next)
      return next
    })
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
      setStamps(readStamps())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

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
    stamp,
    unstamp,
    mergeRemoteStamps,
  }
}
