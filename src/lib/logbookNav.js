// Path-building for a specific Game Log BOOK (ADR-0036's multi-book
// addendum) — pure, React-free, shared by LogbookPage.jsx (the shelf
// resolver) and LogbookCollection.jsx (one open book's whole page), which is
// the whole reason this lives here instead of being defined twice.
//
// Both functions fold the same special case: the DEFAULT book has always
// lived at the bare /logbook rather than at /logbook/book/default — building
// the second address for it would give one book two addresses, which is
// exactly what route.js's own comment on bookPath() warns against.
import { DEFAULT_BOOK_ID } from './books.js'
import { bookPath, bookStatsPath, logbookPath, logbookStatsPath } from './route.js'

export function pathForBook(book, { season = null, placing = null } = {}) {
  const base = !book || book.id === DEFAULT_BOOK_ID ? logbookPath(season) : bookPath(book.id, season)
  return placing ? `${base}?place=${placing}` : base
}

export function statsPathFor(book) {
  return !book || book.id === DEFAULT_BOOK_ID ? logbookStatsPath() : bookStatsPath(book.id)
}
