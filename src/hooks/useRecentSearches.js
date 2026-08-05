import { useCallback, useEffect, useRef, useState } from 'react'
import {
  RECENT_SEARCHES_KEY,
  addRecentSearch,
  parseRecentSearches,
  removeRecentSearch,
  serializeRecentSearches,
} from '../lib/recentSearches.js'

// localStorage-backed wrapper over the pure list in lib/recentSearches.js — the
// same split as useRevealProgress/revealProgressCore, so the parse and dedupe
// rules stay testable without a DOM and this file holds only the storage
// plumbing. Every access is try/caught: a browser with storage disabled (iOS
// private browsing used to throw on write) degrades to an in-memory list for
// the session rather than taking the search screen down with it.

function readStored() {
  try {
    return parseRecentSearches(window.localStorage.getItem(RECENT_SEARCHES_KEY))
  } catch {
    return []
  }
}

function writeStored(list) {
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, serializeRecentSearches(list))
  } catch {
    /* storage unavailable — the in-memory list still works for this session */
  }
}

export function useRecentSearches() {
  const [recent, setRecent] = useState(readStored)

  // The list is mirrored in a ref so a writer can read the current value and
  // persist WITHOUT doing it inside a setState updater. That matters here more
  // than it usually does: the one caller records a visit and then closes the
  // search in the same tick, and an updater queued on a component that unmounts
  // before React processes it simply never runs — which is exactly how the
  // recorded search vanished. Persisting up front is also the correct shape
  // regardless; an updater is supposed to be pure.
  const listRef = useRef(recent)
  const commit = useCallback((next) => {
    listRef.current = next
    writeStored(next)
    setRecent(next)
  }, [])

  // A search made in another tab should show up here, same as the reveal mark's
  // cross-tab pickup in useRevealProgress.js. `storage` fires only in the OTHER
  // documents, so this can't loop with our own writes.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== RECENT_SEARCHES_KEY) return
      const stored = readStored()
      listRef.current = stored
      setRecent(stored)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const remember = useCallback(
    (entry) => commit(addRecentSearch(listRef.current, entry)),
    [commit],
  )

  const forget = useCallback(
    (kind, id) => commit(removeRecentSearch(listRef.current, kind, id)),
    [commit],
  )

  const clear = useCallback(() => commit([]), [commit])

  return { recent, remember, forget, clear }
}
