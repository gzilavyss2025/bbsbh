import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { halfIndex } from '../api/select.js'
import { computeDerivedByInning } from '../api/derive.js'
import {
  parseRevealMark,
  parseAtBatMark,
  parseBoxRevealMark,
  mergeMark,
  unlockedInnings,
} from './revealProgressCore.js'

// localStorage key prefix + reader for the per-game reveal high-water mark.
// The parse/merge/unlock rules are the React-free core in revealProgressCore.js
// (unit-tested there); this hook owns only the storage I/O and React wiring.
const REVEAL_KEY = 'bbsbh:reveal:'
function readRevealMark(storageKey) {
  if (!storageKey) return -1
  try {
    return parseRevealMark(window.localStorage.getItem(storageKey))
  } catch {
    return -1
  }
}

// (`revealMarkFor(gamePk)` used to live here — this device's persisted mark for
// one game, read without mounting the hook. Its only caller was
// StampsCloudSync, which pushed the mark to /api/reveal before minting so the
// stamp gate would pass. The gate was retired in ADR-0035's second amendment
// and the push went with it, leaving this an orphan; `check-dead-exports.mjs`
// is what said so. The hook below still reads the same key the same way.)

// localStorage key prefix + reader for the at-bat-mode stepping cursor (see
// ADR-0016): how many play-by-play entries of whichever half is currently
// being stepped through have been revealed so far. Stored as "{halfIdx}:
// {count}" — the caller compares halfIdx against the half it's actually
// showing (RollingLine and direct links both let a user jump to any unlocked
// half, not just the reveal frontier, so this can't assume "frontier" means
// "the half being viewed"). A stale value from a half that's since been
// fully committed is simply ignored rather than misread as live progress.
const ATBAT_KEY = 'bbsbh:reveal-atbat:'
function readAtBatMark(storageKey) {
  if (!storageKey) return { halfIdx: -1, count: 0 }
  try {
    return parseAtBatMark(window.localStorage.getItem(storageKey))
  } catch {
    return { halfIdx: -1, count: 0 }
  }
}

// Everything that advances with the reveal high-water mark: the mark itself
// (persisted per gamePk so leaving the innings view and returning — even in a
// new session — keeps your place, per InningViewer's spoiler-safety
// invariant), how many innings are currently unlocked (extras never spoil —
// ADR-0008), and the per-inning derived-stats cache (pitches/whiffs/Statcast
// superlatives), rebuilt only when the feed object itself changes, never on a
// bare re-render (ADR-0007).
//
// `regulation`/`actualCount` come from the caller (selectRegulationInnings /
// selectInningCount) since they're plain feed reads, not reveal state.
export function useRevealProgress(feed, regulation, actualCount) {
  const storageKey = feed?.gamePk ? `${REVEAL_KEY}${feed.gamePk}` : null
  const [revealedThrough, setRevealedThrough] = useState(() =>
    readRevealMark(storageKey),
  )

  const atBatStorageKey = feed?.gamePk ? `${ATBAT_KEY}${feed.gamePk}` : null
  const [atBatMark, setAtBatMark] = useState(() => readAtBatMark(atBatStorageKey))
  // How many entries have been stepped through for a given half-index — 0 for
  // any half other than the one the mark belongs to (a different half, or no
  // stepping done yet).
  const atBatCountFor = useCallback(
    (n, half) => (atBatMark.halfIdx === halfIndex(n, half) ? atBatMark.count : 0),
    [atBatMark],
  )

  // The one ratchet: revealedThrough only ever moves forward, from any
  // source (a tap, another tab's storage event, or a signed-in device's
  // cloud sync — see useRevealCloudSync.js). Exposed as mergeRevealedThrough
  // so every caller pushing in an externally-sourced value goes through the
  // same one-directional guarantee instead of re-implementing it.
  const mergeRevealedThrough = useCallback((idx) => {
    setRevealedThrough((prev) => mergeMark(prev, idx))
  }, [])

  const revealTo = useCallback(
    (n, half) => {
      mergeRevealedThrough(halfIndex(n, half))
      // Whatever was mid-step just got fully committed — clear it so a later
      // half doesn't inherit a stale count.
      setAtBatMark({ halfIdx: -1, count: 0 })
    },
    [mergeRevealedThrough],
  )

  const revealAtBat = useCallback((n, half, count) => {
    setAtBatMark({ halfIdx: halfIndex(n, half), count })
  }, [])

  useEffect(() => {
    if (!storageKey || revealedThrough < 0) return
    try {
      window.localStorage.setItem(storageKey, String(revealedThrough))
    } catch {
      // Private-mode / storage-disabled — degrade to in-session memory only.
    }
  }, [storageKey, revealedThrough])

  // The 'storage' event only fires in OTHER tabs/windows on the same origin,
  // never the tab that made the write — so this picks up a reveal made in a
  // second tab on the same game without needing a reload. Same ratchet as
  // revealTo: only ever moves forward.
  useEffect(() => {
    if (!storageKey) return
    function onStorage(e) {
      if (e.key !== storageKey) return
      // Same parse + forward-only merge as every other reveal source: a null
      // or malformed newValue parses to -1, which the ratchet ignores.
      mergeRevealedThrough(parseRevealMark(e.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey, mergeRevealedThrough])

  useEffect(() => {
    if (!atBatStorageKey) return
    try {
      if (atBatMark.halfIdx < 0) {
        window.localStorage.removeItem(atBatStorageKey)
      } else {
        window.localStorage.setItem(atBatStorageKey, `${atBatMark.halfIdx}:${atBatMark.count}`)
      }
    } catch {
      // Private-mode / storage-disabled — degrade to in-session memory only.
    }
  }, [atBatStorageKey, atBatMark])

  // How many innings are currently visible: regulation, plus one more for each
  // extra inning whose predecessor has already been fully revealed.
  const unlocked = useMemo(
    () => unlockedInnings(regulation, actualCount, revealedThrough),
    [regulation, actualCount, revealedThrough],
  )

  // Derived stats (pitches/whiffs/1st-pitch strikes) are parsed lazily and
  // cached: the map is only built the first time a box is actually revealed.
  // The cache is keyed on the feed object, so a Refresh (which fetches a fresh
  // feed) rebuilds it. Without this the map froze at whatever feed was present
  // on first reveal and pitch/whiff stats went stale for the live inning — the
  // play-by-play (read live from `feed`) would show a walk while PITCHES read 0.
  //
  // Wrapped in useCallback purely so its IDENTITY is stable per feed: it is a
  // prop on the memoized InningPage, and a plain function rebuilt each render
  // would miss that memo on every render. The cache key is unchanged and still
  // the feed object itself — the useCallback dependency is that same object, so
  // the two can never disagree.
  const derivedRef = useRef({ feed: null, map: null })
  const getDerived = useCallback(() => {
    if (derivedRef.current.feed !== feed) {
      derivedRef.current = { feed, map: computeDerivedByInning(feed) }
    }
    return derivedRef.current.map
  }, [feed])

  return {
    revealedThrough,
    revealTo,
    mergeRevealedThrough,
    unlocked,
    getDerived,
    atBatCountFor,
    revealAtBat,
  }
}

// localStorage key prefix for the box score's own mark (ADR-0049): "this reader
// has opened this game's box score by hand". One bit per gamePk, written as the
// string "1", parsed by parseBoxRevealMark — never a score, and unlike
// `bbsbh:reveal:{gamePk}` not even a position. It says only THAT the seal was
// lifted, never how far or on what.
//
// It lives beside the reveal mark rather than inside it on purpose. The box
// score's seal is one seal over one page; `revealedThrough` is the by-hand
// scoring frontier that the innings viewer, the scorecard's ink and the slate's
// "pick up your pencil" strip all read. Folding the box score into that mark
// would ratchet all three from a single tap on a different page — which is the
// exact leak ADR-0026 and ADR-0048 both keep their overrides away from.
const BOX_KEY = 'bbsbh:boxreveal:'
function readBoxMark(storageKey) {
  if (!storageKey) return false
  try {
    return parseBoxRevealMark(window.localStorage.getItem(storageKey))
  } catch {
    return false
  }
}

// The box score's own reveal state, persisted per game and mirrored across a
// signed-in reader's devices (BoxRevealCloudSync.jsx). ADR-0049 has the why;
// this is the storage I/O and the React wiring, the same division of labour
// useRevealProgress above keeps with revealProgressCore.js.
//
// A LATCH, in the same one-directional spirit as `mergeMark`: `false → true`
// from any source (this device's tap, another tab's `storage` event, another
// device's mark arriving from the cloud), and never back. There is no unset
// path, by design — nothing in the app asks to re-seal a box score, and a
// setter that could would be a way for a stale value to close a page the reader
// had open. Re-seeding happens only when the gamePk itself changes: a different
// game is a different question, and it is asked of storage afresh.
//
// The gamePk change is handled during render rather than in an effect because
// this value gates what renders. BoxScore stays mounted when the reader moves
// between games on the same tab, so an effect-based re-seed would paint one
// frame of the previous game's answer — a game the reader may not have opened.
// That frame would be the wrong direction of wrong: it would show, not seal.
export function useBoxScoreReveal(gamePk) {
  const storageKey = gamePk ? `${BOX_KEY}${gamePk}` : null
  const [mark, setMark] = useState(() => ({ key: storageKey, opened: readBoxMark(storageKey) }))
  let opened = mark.opened
  if (mark.key !== storageKey) {
    opened = readBoxMark(storageKey)
    setMark({ key: storageKey, opened })
  }

  const markBoxOpened = useCallback(() => {
    setMark((prev) => (prev.opened ? prev : { ...prev, opened: true }))
  }, [])

  useEffect(() => {
    if (!storageKey || !opened) return
    try {
      window.localStorage.setItem(storageKey, '1')
    } catch {
      // Private-mode / storage-disabled — degrade to in-session memory only,
      // exactly as the reveal mark does. The seal simply returns next visit.
    }
  }, [storageKey, opened])

  // Same cross-tab pickup as the reveal mark: 'storage' fires only in the OTHER
  // tabs, so a box score opened in a second tab on the same game opens here too
  // without a reload. A null or mangled `newValue` parses to false, which the
  // latch ignores.
  useEffect(() => {
    if (!storageKey) return
    function onStorage(e) {
      if (e.key !== storageKey) return
      if (parseBoxRevealMark(e.newValue)) markBoxOpened()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey, markBoxOpened])

  return { boxOpened: opened, markBoxOpened }
}
