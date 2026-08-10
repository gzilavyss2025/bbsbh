// Path-building for a specific Game Log BOOK (ADR-0036's multi-book
// addendum) — pure, React-free, shared by LogbookPage.jsx (the shelf
// resolver), LogbookCollection.jsx (one open book's whole page) and
// LogbookStatsPage.jsx (its retrospective), which is the whole reason this
// lives here instead of being defined three times.
//
// ===========================================================================
// THE BARE /logbook IS A RESOLVER, NOT AN ADDRESS — hence `bookCount`
// ===========================================================================
// Both functions fold the same special case: while the DEFAULT book is the
// only book, it lives at the bare /logbook rather than at
// /logbook/book/default, because building the second address for it would give
// one book two addresses — exactly what route.js's own comment on bookPath()
// warns against.
//
// That fold used to be unconditional, and it was wrong the moment a second
// book existed. `/logbook` does not mean "the default book"; it means "work
// out what I should be looking at", and with two or more books the answer is
// the SHELF (LogbookPage.jsx). So every "Open" on the default book's cover
// navigated to the shelf the tap came from, and the book could not be opened
// at all until its owner deleted the other one. The same fold sent the
// stamp-placement hand-off (`?place=`) round the same loop, so a stamp could
// not be filed into the default book either, and pointed that book's "what it
// adds up to" at the WHOLE collection's retrospective rather than its own.
//
// So the fold now needs the one fact that decides it: how many books are on
// the shelf. A caller that does not say gets the explicit address, which
// always resolves to the book it names — the safe answer, not the pretty one.
import { DEFAULT_BOOK_ID } from './books.js'
import { bookPath, bookStatsPath, logbookPath, logbookStatsPath } from './route.js'

// Does the bare route currently resolve to THIS book? Only the default book
// can claim it, and only while it is the whole shelf.
function bareRouteMeans(book, bookCount) {
  return !book || (book.id === DEFAULT_BOOK_ID && bookCount === 1)
}

export function pathForBook(book, { season = null, placing = null, bookCount = 0 } = {}) {
  const base = bareRouteMeans(book, bookCount) ? logbookPath(season) : bookPath(book.id, season)
  return placing ? `${base}?place=${placing}` : base
}

export function statsPathFor(book, { bookCount = 0 } = {}) {
  return bareRouteMeans(book, bookCount) ? logbookStatsPath() : bookStatsPath(book.id)
}
