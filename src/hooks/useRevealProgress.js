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
  const revealTo = useCallback((n, half) => {
    const idx = halfIndex(n, half)
    setRevealedThrough((prev) => (idx > prev ? idx : prev))
  }, [])

  useEffect(() => {
    if (!storageKey || revealedThrough < 0) return
    try {
      window.localStorage.setItem(storageKey, String(revealedThrough))
    } catch {
      // Private-mode / storage-disabled — degrade to in-session memory only.
    }
  }, [storageKey, revealedThrough])

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

  return { revealedThrough, revealTo, unlocked, getDerived }
}
