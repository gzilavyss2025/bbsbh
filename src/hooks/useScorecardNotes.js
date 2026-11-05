import { useCallback, useEffect, useMemo, useState } from 'react'
import { localStore, onStorageOrRestore } from '../lib/account/localStore.js'
import {
  SHEET_NOTES_KEY,
  EMPTY_SHEET_NOTES,
  parseSheetNotes,
  serializeSheetNotes,
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
  const storageKey = gamePk ? `${SHEET_NOTES_KEY}${gamePk}` : null
  const store = useMemo(
    () => storageKey && localStore(storageKey, parseSheetNotes, serializeSheetNotes),
    [storageKey],
  )
  const [notes, setNotes] = useState(() => (store ? store.read() : EMPTY_SHEET_NOTES))

  useEffect(() => {
    if (!store) return
    if (serializeSheetNotes(notes) == null) store.drop()
    else store.write(notes)
  }, [store, notes])

  useEffect(() => {
    if (!storageKey) return
    function onStorage(e) {
      if (e.key !== storageKey) return
      setNotes(parseSheetNotes(e.newValue))
    }
    return onStorageOrRestore(storageKey, onStorage)
  }, [storageKey])

  const setCell = useCallback((atBatIndex, patch) => {
    setNotes((prev) => withCellNote(prev, atBatIndex, patch))
  }, [])

  const clearCell = useCallback((atBatIndex) => {
    setNotes((prev) => withoutCellNote(prev, atBatIndex))
  }, [])

  return { notes, setCell, clearCell }
}
