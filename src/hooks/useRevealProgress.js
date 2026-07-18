import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { halfIndex } from '../api/select.js'
import { computeDerivedByInning } from '../api/derive.js'

// localStorage key prefix + reader for the per-game reveal high-water mark.
const REVEAL_KEY = 'bbsbh:reveal:'
function readRevealMark(storageKey) {
  if (!storageKey) return -1
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw == null) return -1
    const n = Number(raw)
    return Number.isInteger(n) && n >= 0 ? n : -1
  } catch {
    return -1
  }
}

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
    const raw = window.localStorage.getItem(storageKey)
    if (raw == null) return { halfIdx: -1, count: 0 }
    const [h, c] = raw.split(':').map(Number)
    if (!Number.isInteger(h) || !Number.isInteger(c) || h < 0 || c < 0) {
      return { halfIdx: -1, count: 0 }
    }
    return { halfIdx: h, count: c }
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
    setRevealedThrough((prev) => (idx > prev ? idx : prev))
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
      const n = e.newValue == null ? -1 : Number(e.newValue)
      if (Number.isInteger(n) && n >= 0) mergeRevealedThrough(n)
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
  const unlocked = useMemo(() => {
    let u = regulation
    while (u < actualCount && revealedThrough >= halfIndex(u, 'bottom')) u++
    return u
  }, [regulation, actualCount, revealedThrough])

  // Derived stats (pitches/whiffs/1st-pitch strikes) are parsed lazily and
  // cached: the map is only built the first time a box is actually revealed.
  // The cache is keyed on the feed object, so a Refresh (which fetches a fresh
  // feed) rebuilds it. Without this the map froze at whatever feed was present
  // on first reveal and pitch/whiff stats went stale for the live inning — the
  // play-by-play (read live from `feed`) would show a walk while PITCHES read 0.
  const derivedRef = useRef({ feed: null, map: null })
  const getDerived = () => {
    if (derivedRef.current.feed !== feed) {
      derivedRef.current = { feed, map: computeDerivedByInning(feed) }
    }
    return derivedRef.current.map
  }

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
