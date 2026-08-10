import '../../styles/58-logbook-shelf.css'
import { useState } from 'react'
import { PassportCover } from './PassportCover.jsx'
import { BookManagementSheet } from './BookManagementSheet.jsx'

// The Game Log SHELF (ADR-0036's multi-book addendum) — what a bare
// `/logbook` shows once a user holds two or more live books. Below that
// count `screens/LogbookPage.jsx` never mounts this at all: a single-book
// user (still the common case, and likely to stay that way for a long time)
// keeps landing directly in their one book with zero extra tap, exactly as
// `/logbook` has always behaved.
//
// Pure presentation over `useBooks()`'s already-live list — every `book` here
// is `state: 'on'`, so this component never has to reason about a tombstone.
// `PassportCover` does all the drawing (ADR-0036's second addendum owns the
// colour/crest chain); this file only arranges covers in a grid and wires
// taps to navigation.
//
// The furniture — the timber plank each row of covers stands on — is drawn
// entirely by 58-logbook-shelf.css from pseudo-elements on the slots, so a
// screen reader hears a plain list of books and nothing about boards. The one
// thing the markup owes that CSS is a FIXED column count per breakpoint (the
// plank is spanned off the row's first slot); do not change `.shelf__grid`
// back to an auto-fill track list.
//
// `placing` — a gamePk hand-off from the box score's mint card via `?place=`
// — puts the shelf into "choose a book for this stamp" mode: the lede
// changes, the covers change what they say tapping them does, and
// `onOpenBook` (owned by the caller, `LogbookPage.jsx`) is responsible for
// carrying that gamePk into whichever book gets tapped so placement mode
// continues there. This component never itself decides what tapping a cover
// navigates to — that stays with the router-aware caller.
//
// `placingStamp` is that stamp's own record, when the caller could resolve
// one, and it is here only so the lede can name the game rather than say
// "this stamp" at a shelf you may have arrived at two taps later. Optional on
// purpose: a stale `?place=` for a stamp since removed still puts the shelf in
// picking mode, and saying less is better than naming nothing.
//
// `updateCover`/`removeBook`/`stamps`/`unplaceStamp` are passed straight
// through to `BookManagementSheet` rather than fetched here via this
// component's own `useBooks()`/`useStamps()` — see that file's header for why
// a second, independent hook instance nested under the caller's own would
// race it. Creating a book is NOT among them: it is its own page now
// (`onNewBook` navigates), because no other book may be on screen while a
// cover is being chosen.
const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

// The same date shape the open book's own placing lede uses, so one stamp
// reads as one stamp across the two surfaces of the same flow.
function monthDay(date) {
  const [year, month, day] = String(date ?? '').split('-').map(Number)
  return year ? MONTH_DAY.format(new Date(year, month - 1, day)) : ''
}

export function LogbookShelf({
  books,
  placing = null,
  placingStamp = null,
  onOpenBook,
  onNewBook,
  updateCover,
  removeBook,
  stamps,
  unplaceStamp,
}) {
  // Which book, if any, has its settings open.
  const [managing, setManaging] = useState(null)
  const placingDate = placing ? monthDay(placingStamp?.date) : ''

  return (
    <div className="shelf">
      <p className="shelf__intro" aria-live="polite">
        {placing
          ? placingDate
            ? `Choose a book for ${placingDate}.`
            : 'Choose a book for this stamp.'
          : `${books.length} books on your shelf.`}
      </p>

      <ul className="shelf__grid">
        {books.map((book) => (
          <li className="shelf__slot" key={book.id}>
            <PassportCover book={book} placing={Boolean(placing)} onOpen={() => onOpenBook(book)} />
            <button
              type="button"
              className="shelf__edit"
              onClick={() => setManaging(book)}
            >
              Settings
            </button>
          </li>
        ))}
        {/* Offered while placing too. Starting a book used to be withheld
            here, because a book you could not yet put anything into would
            strand the hand-off from the box score — the create flow carries
            the stamp now (`/logbook/new?place=`), so the new book opens ready
            for it and "none of these" is a real answer to the question this
            shelf is asking. */}
        <li className="shelf__slot shelf__slot--new">
          <button type="button" className="shelf__newtile" onClick={onNewBook}>
            <span className="shelf__newtileicon" aria-hidden="true">
              +
            </span>
            New book
          </button>
        </li>
      </ul>

      {managing && (
        <BookManagementSheet
          book={managing}
          books={books}
          updateCover={updateCover}
          removeBook={removeBook}
          stamps={stamps}
          unplaceStamp={unplaceStamp}
          onClose={() => setManaging(null)}
          onRemoved={() => setManaging(null)}
        />
      )}
    </div>
  )
}
