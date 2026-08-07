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
// `placing` — a gamePk hand-off from the box score's mint card via `?place=`
// — puts the shelf into "choose a book for this stamp" mode: the lede
// changes, and `onOpenBook` (owned by the caller, `LogbookPage.jsx`) is
// responsible for carrying that gamePk into whichever book gets tapped so
// placement mode continues there. This component never itself decides what
// tapping a cover navigates to — that stays with the router-aware caller.
//
// `createBook`/`updateCover`/`removeBook`/`stamps`/`unplaceStamp` are passed
// straight through to `BookManagementSheet` rather than fetched here via this
// component's own `useBooks()`/`useStamps()` — see that file's header for why
// a second, independent hook instance nested under the caller's own would
// race it.
export function LogbookShelf({
  books,
  placing = null,
  onOpenBook,
  createBook,
  updateCover,
  removeBook,
  stamps,
  unplaceStamp,
}) {
  // Which book (if any) the management sheet has open, or the literal string
  // 'new' for the create flow. Not a boolean — the sheet needs to know WHICH
  // book it is editing, and 'new' keeps that in the same piece of state
  // rather than a second flag that could disagree with this one.
  const [managing, setManaging] = useState(null)

  return (
    <div className="shelf">
      <p className="shelf__intro" aria-live="polite">
        {placing
          ? 'Choose a book for this stamp.'
          : `${books.length} books on your shelf.`}
      </p>

      <ul className="shelf__grid">
        {books.map((book) => (
          <li className="shelf__slot" key={book.id}>
            <PassportCover book={book} onOpen={() => onOpenBook(book)} />
            <button
              type="button"
              className="shelf__edit"
              onClick={() => setManaging(book)}
            >
              Edit cover
            </button>
          </li>
        ))}
        {/* Not offered while choosing a book for a stamp — creating a book
            you cannot yet place anything into would strand the hand-off from
            the box score, and the flow already has a plain "cancel" (leaving
            the stamp in the tray of whichever book gets opened) that covers
            "I don't want any of these". */}
        {!placing && (
          <li className="shelf__slot">
            <button
              type="button"
              className="shelf__newtile"
              onClick={() => setManaging('new')}
            >
              <span className="shelf__newtileicon" aria-hidden="true">
                +
              </span>
              New book
            </button>
          </li>
        )}
      </ul>

      {managing && (
        <BookManagementSheet
          book={managing === 'new' ? null : managing}
          books={books}
          createBook={createBook}
          updateCover={updateCover}
          removeBook={removeBook}
          stamps={stamps}
          unplaceStamp={unplaceStamp}
          onClose={() => setManaging(null)}
          onCreated={(id) => {
            setManaging(null)
            // Only `id` is needed — `onOpenBook` (owned by LogbookPage.jsx)
            // navigates off it and re-resolves the real record from
            // `useBooks()` on the next render, the same as tapping any other
            // cover above.
            onOpenBook({ id })
          }}
          onRemoved={() => setManaging(null)}
        />
      )}
    </div>
  )
}
