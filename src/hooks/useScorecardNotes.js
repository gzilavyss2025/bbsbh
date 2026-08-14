import { useCallback, useEffect, useState } from 'react'
import {
  SCORECARD_NOTES_KEY,
  EMPTY_SCORECARD_NOTES,
  parseScorecardNotes,
  serializeScorecardNotes,
  withCellNote,
  withoutCellNote,
} from '../lib/scorecardNotes.js'

// Storage I/O + React wiring for the scorecard's per-cell notation overrides
// (the parse/merge rules are the React-free core in lib/scorecardNotes.js,
// unit-tested there). One store per gamePk; a `storage` listener picks up an
// edit made in another tab on the same game, the same way useRevealProgress
// mirrors the reveal mark — the whole store is replaced (overrides carry no
// ratchet; last write wins, which for a margin note is the right answer).
export function useScorecardNotes(gamePk) {
  const storageKey = gamePk ? `${SCORECARD_NOTES_KEY}${gamePk}` : null
  const [notes, setNotes] = useState(() => {
    if (!storageKey) return EMPTY_SCORECARD_NOTES
    try {
      return parseScorecardNotes(window.localStorage.getItem(storageKey))
    } catch {
      return EMPTY_SCORECARD_NOTES
    }
  })

  useEffect(() => {
    if (!storageKey) return
    try {
      const raw = serializeScorecardNotes(notes)
      if (raw == null) window.localStorage.removeItem(storageKey)
      else window.localStorage.setItem(storageKey, raw)
    } catch {
      // Private-mode / storage-disabled — degrade to in-session memory only.
    }
  }, [storageKey, notes])

  useEffect(() => {
    if (!storageKey) return
    function onStorage(e) {
      if (e.key !== storageKey) return
      setNotes(parseScorecardNotes(e.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey])

  const setCell = useCallback((atBatIndex, patch) => {
    setNotes((prev) => withCellNote(prev, atBatIndex, patch))
  }, [])

  const clearCell = useCallback((atBatIndex) => {
    setNotes((prev) => withoutCellNote(prev, atBatIndex))
  }, [])

  return { notes, setCell, clearCell }
}
