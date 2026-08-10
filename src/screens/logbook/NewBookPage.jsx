import '../../styles/48-logbook.css'
import '../../styles/49-passport-book.css'
import '../../styles/58-logbook-shelf.css'
import { useState } from 'react'
import { MAX_BOOK_SUBTITLE_LENGTH, MAX_BOOK_TITLE_LENGTH } from '../../lib/books.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { BookCoverPicker } from '../../components/passport/BookCoverPicker.jsx'

// Starting a new Game Log book — its own full-page surface at /logbook/new,
// not a sheet over the shelf.
//
// That is the whole reason it is a page: while you are deciding what a book
// looks like, NO OTHER BOOK may be on screen. A cover sheet over a shelf put
// six finished covers behind the one being made, and the preview lost every
// argument with them. Here the draft cover is the only book in the room.
//
// It owns the draft and nothing else. `createBook` arrives as a prop from
// LogbookPage.jsx's resolver, which holds the live `useBooks()` instance — a
// second instance mounted under it races the first (see
// BookManagementSheet.jsx's header for the mechanism).
//
// The whole draft — title, subtitle and cover — feeds BookCoverPicker, which
// draws the real `PassportCover` from it. So a character typed into either
// field lands on the cover on the same render, with no preview code of this
// page's own to drift.
//
// `placing` is the stamp waiting for a page, carried in from `?place=` — this
// page does not place anything, it just knows the tap that leaves it is about
// to. Starting a book is one of the answers to "which book does this go in",
// so the lede says so rather than leaving the stamp unmentioned for a screen.
export function NewBookPage({ createBook, placing = null, onCreated, onCancel }) {
  const [draft, setDraft] = useState({
    title: '',
    subtitle: '',
    coverTeamId: null,
    coverMark: 'team',
    coverColor: null,
  })
  const [refused, setRefused] = useState(false)

  const patch = (fields) => setDraft((prev) => ({ ...prev, ...fields }))

  const start = () => {
    const id = createBook(draft)
    if (id) onCreated?.(id)
    // Only reachable at MAX_BOOKS (src/lib/books.js) — a real cap, so the
    // affordance says why rather than silently doing nothing.
    else setRefused(true)
  }

  return (
    <div className="screen logbook">
      <SiteHeader />
      <header className="topbar logbook__head">
        <h1 className="topbar__title">New book</h1>
        <button type="button" className="topbar__back" onClick={onCancel}>
          Cancel
        </button>
      </header>

      <p className="hint hint--prose">
        Name it and choose its cover — both keep changing as long as you hold the
        book.
        {placing ? ' It opens ready for the stamp you’re placing.' : ''}
      </p>

      <label className="bookmgmt__field">
        <span>Title</span>
        <input
          type="text"
          maxLength={MAX_BOOK_TITLE_LENGTH}
          placeholder="Game Log"
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </label>
      <label className="bookmgmt__field">
        <span>Subtitle</span>
        <input
          type="text"
          maxLength={MAX_BOOK_SUBTITLE_LENGTH}
          placeholder="Dad and me"
          value={draft.subtitle}
          onChange={(e) => patch({ subtitle: e.target.value })}
        />
      </label>

      <BookCoverPicker book={draft} onChange={patch} />

      {refused && (
        <p className="hint hint--prose">
          You’re holding as many books as this app allows. Remove one before
          starting another.
        </p>
      )}

      {/* One way out, in the topbar, where every other page keeps it. A second
          Cancel down here only competed with Start for the same glance. */}
      <div className="bookmgmt__actions newbook__actions">
        <button type="button" className="btn btn--seal" onClick={start}>
          Start this book
        </button>
      </div>

      <ReportFooter />
    </div>
  )
}
