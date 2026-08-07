import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BOOKS_KEY,
  DEFAULT_BOOK_ID,
  applyRemoteBooks,
  createBook as createBookRecord,
  genBookId,
  listBooks,
  parseBooks,
  removeBook as removeBookRecord,
  serializeBooks,
  updateBookCover,
} from '../lib/books.js'

// The multi-book shelf's React entry point. Mirrors useStamps.js exactly: the
// rules are the React-free core in src/lib/books.js (unit-tested there); this
// hook owns only the storage I/O, the React wiring, and the one-time
// migration that guarantees a device always has at least one book.
//
// LOCAL-FIRST, same posture as every other Logbook store: a book created
// before sign-in still lands on this device, and a later sync layer merges it
// upward the way StampsCloudSync already does for stamps. A deploy without
// Clerk continues to use this store directly.
//
// WHAT IS NOT IN HERE: the stamps themselves. A book is a cover — a name, a
// subtitle, a cover club — never the collection filed inside it. Which stamps
// belong to which book lives on the STAMP record's own `placement.bookId`
// (src/lib/stamps.js), not here.

function readBooks() {
  try {
    return parseBooks(window.localStorage.getItem(BOOKS_KEY))
  } catch {
    return {}
  }
}

function writeBooks(map) {
  try {
    window.localStorage.setItem(BOOKS_KEY, serializeBooks(map))
  } catch {
    // Private mode / storage disabled — the shelf still works for this
    // session, same degrade as every other preference hook.
  }
}

// A same-tab echo of the `storage` event. The browser fires `storage` only in
// OTHER tabs, so without this two hook instances mounted at once in this tab
// — a book picker and a settings screen, say — would not see each other's
// writes until a reload. Same mechanism, and same reason, as useStamps.js's
// notifyLocalChange.
function notifyLocalChange() {
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: BOOKS_KEY }))
  } catch {
    // StorageEvent unavailable — cross-instance updates degrade to next render.
  }
}

// Unconditional migration: if the store has no LIVE `default` book, synthesize
// and persist one immediately. This is what guarantees `books` is NEVER empty
// on any device — there is deliberately no "zero books" empty state anywhere
// downstream. A pre-existing single collection (every user before this
// feature shipped) lands in this one book, with today's exact default look:
// empty title/subtitle, which the component that renders a book resolves to
// "Game Log" / the favourite club at RENDER time, not here.
//
// Run from useState's lazy initializer rather than a mount `useEffect`: the
// migration is a pure "read, and backfill if needed" step with nothing to
// subscribe to, so computing it before first paint is strictly better than an
// effect that fires after — there is no frame where `books` is briefly empty
// — and it sidesteps react-hooks' set-state-in-effect rule, which exists to
// stop effects that call setState for no reason a lazy initializer or a plain
// derived value couldn't cover. Idempotent, so even React StrictMode's
// double-invoke of initializers costs nothing beyond one harmless extra
// localStorage write.
function readBooksMigrated() {
  const current = readBooks()
  if (current[DEFAULT_BOOK_ID]?.state === 'on') return current
  const next = createBookRecord(current, {
    id: DEFAULT_BOOK_ID,
    title: '',
    subtitle: '',
    coverTeamId: null,
    now: Date.now(),
  })
  if (next !== current) writeBooks(next)
  return next
}

export function useBooks() {
  const [books, setBooks] = useState(readBooksMigrated)

  // One writer for every void mutation: apply a pure transform from
  // src/lib/books.js, persist, then echo so the other mounted instance picks
  // it up. No caller touches localStorage or the map shape directly. Used by
  // every mutator EXCEPT createBook, which needs to hand its caller back the
  // new id synchronously — see the note there for why that one is written
  // against `books` directly instead of through this functional updater.
  const commit = useCallback((transform) => {
    setBooks((prev) => {
      const next = transform(prev)
      if (next === prev) return prev
      writeBooks(next)
      return next
    })
    notifyLocalChange()
  }, [])

  // Create a new book. Generates its id here — the pure layer never invents
  // one, so every caller of createBook (this hook, and any future sync code)
  // agrees on where ids come from. Returns the new book's id, or null if the
  // pure layer refused (cap reached, or a once-in-a-lifetime id collision).
  //
  // Written against the `books` state directly rather than through `commit`'s
  // functional updater, on purpose: a caller needs the outcome back
  // SYNCHRONOUSLY (there is no id to hand the placement flow otherwise), and
  // the only way to know it synchronously is to run the pure transform
  // against the state this render already has, rather than leaning on
  // React's internal timing for when a functional setState updater happens to
  // execute. A single tap of "new book" is not a rapid-fire path where the
  // committed render's `books` could plausibly be stale by the time this runs.
  const createBook = useCallback(
    (title, subtitle, coverTeamId) => {
      const id = genBookId()
      const next = createBookRecord(books, { id, title, subtitle, coverTeamId, now: Date.now() })
      if (next === books) return null
      setBooks(next)
      writeBooks(next)
      notifyLocalChange()
      return id
    },
    [books],
  )

  // Patch a book's cover. `patch` only names the fields it wants changed —
  // updateBookCover in src/lib/books.js already treats an absent field as
  // "leave it alone", so this is a thin pass-through.
  const updateCover = useCallback(
    (id, patch) => {
      commit((prev) => updateBookCover(prev, id, { ...patch, now: Date.now() }))
    },
    [commit],
  )

  // Remove a book. Writes an explicit 'off' tombstone rather than deleting —
  // see applyRemoteBooks in src/lib/books.js for why deleting would resurrect
  // the book on the next sync. Whether it is SAFE to remove this particular
  // book (the last live one, or `default`) is a call for whatever screen
  // offers the affordance, not for this hook.
  const removeBook = useCallback(
    (id) => {
      commit((prev) => removeBookRecord(prev, id, { now: Date.now() }))
    },
    [commit],
  )

  // The only way a remote collection reaches local state (a future
  // BooksCloudSync). Last-write-wins per id on `updatedAt`, deliberately NOT
  // a union: a union would resurrect a book the user just removed on this
  // device.
  const mergeRemoteBooks = useCallback(
    (remote) => {
      commit((prev) => applyRemoteBooks(prev, remote))
    },
    [commit],
  )

  useEffect(() => {
    function onStorage(e) {
      // `key === null` is a whole-storage clear, which is also our business.
      if (e.key !== BOOKS_KEY && e.key !== null) return
      // `() => readBooks()`, NOT `readBooks()` — the difference is a bug, not
      // a style point, and useStamps.js already paid for learning it once.
      // `commit` persists INSIDE its state updater, which React runs at
      // render time, but the same-tab echo above dispatches synchronously
      // right after QUEUEING that updater. An eager read here would run
      // before the write it is reacting to and queue the pre-change
      // collection behind the change: React applies the updater, then
      // applies this, and the mutation reverts in state while localStorage
      // keeps the new value. Reading from inside the updater puts the read
      // after the write, where it belongs.
      setBooks(() => readBooks())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Every live book, newest-created first — the shelf's own reading order.
  const list = useMemo(() => listBooks(books), [books])

  return {
    books: list,
    createBook,
    updateCover,
    removeBook,
    mergeRemoteBooks,
  }
}
