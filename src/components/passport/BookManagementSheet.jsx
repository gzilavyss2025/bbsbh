import '../../styles/58-logbook-shelf.css'
import { useState } from 'react'
import { MAX_BOOK_SUBTITLE_LENGTH, MAX_BOOK_TITLE_LENGTH } from '../../lib/books.js'
import { BookCoverPicker } from './BookCoverPicker.jsx'

// One book's SETTINGS — rename it, re-cover it, or remove it. Reachable from
// two places by design: the shelf, when 2+ books already exist, and the
// `Settings` control on a single open book's own view, so a user who has never
// seen a shelf can still reach everything a book can be told to do.
//
// It no longer creates a book. That flow is its own page (`/logbook/new`,
// src/screens/logbook/NewBookPage.jsx) because a sheet drawn over the shelf
// put six finished covers behind the one being made. What is left here is
// exactly the three things you can do to a book you already hold.
//
// `books`/`updateCover`/`removeBook`/`stamps`/`unplaceStamp` are PROPS, not
// this component's own `useBooks()`/`useStamps()` calls, and that is
// deliberate rather than plumbing for its own sake. Both hosts of this
// sheet (LogbookShelf.jsx, LogbookCollection.jsx) already hold a live
// instance of those hooks, sitting ABOVE this component in the tree; a
// second, independent instance HERE raced it — `useBooks()`'s cross-instance
// echo (`notifyLocalChange`, `useBooks.js`) fires synchronously as soon as
// THIS component's commit is queued, and because this component is a
// DESCENDANT of the host's own hook instance, React resolves the host's
// pending "reload from storage" update (queued by that echo) BEFORE it
// resolves this component's own pending write — so the host briefly re-reads
// localStorage from BEFORE the write landed. A book you just removed kept
// showing on the shelf until an unrelated reload. Routing the same live
// instance down as props instead of minting a second one removes the second
// instance entirely, so there is nothing left to race.
export function BookManagementSheet({
  book,
  books,
  updateCover,
  removeBook,
  stamps,
  unplaceStamp,
  onClose,
  onRemoved,
}) {
  // Committed on blur, not per keystroke — the exact pattern
  // StampGameButton.jsx's note field already uses, and for the identical
  // reason: every save bumps `updatedAt`, which is what BooksCloudSync diffs
  // on to decide what to publish, so a per-keystroke write would publish a
  // request per character. The draft still feeds the cover preview below on
  // every keystroke, so the delay is in the WRITE, never in what you see.
  const [titleDraft, setTitleDraft] = useState(null)
  const [subtitleDraft, setSubtitleDraft] = useState(null)

  const commitTitle = () => {
    if (titleDraft != null && titleDraft !== book.title) updateCover(book.id, { title: titleDraft })
    setTitleDraft(null)
  }
  const commitSubtitle = () => {
    if (subtitleDraft != null && subtitleDraft !== book.subtitle) {
      updateCover(book.id, { subtitle: subtitleDraft })
    }
    setSubtitleDraft(null)
  }

  // What the cover picker draws: the stored record with the two uncommitted
  // fields laid over it, so the board updates as you type rather than on blur.
  const draft = {
    ...book,
    title: titleDraft ?? book.title ?? '',
    subtitle: subtitleDraft ?? book.subtitle ?? '',
  }

  // ---- REMOVE -----------------------------------------------------------
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  // Never leave the user with zero live books — src/lib/books.js's own
  // removeBook comment says this policy belongs to the UI layer, not the
  // pure store. This IS that UI layer, so the refusal lives here, the same
  // way StampGameButton.jsx refuses a full season and says so rather than
  // offering a button that would silently do nothing.
  const canRemove = books.length > 1

  const handleRemove = () => {
    if (!canRemove) return
    // Un-place every stamp filed in this book before tombstoning it — send
    // them back to the tray rather than deleting them. A stamp's `bookId`
    // lives inside its `placement`, so clearing the placement is what "no
    // longer filed here" means; the keepsake itself is untouched.
    for (const stamp of stamps) {
      if (stamp.placement?.bookId === book.id) unplaceStamp(stamp.gamePk)
    }
    removeBook(book.id)
    onRemoved?.()
  }

  return (
    <div className="bookmgmt" role="group" aria-label="Settings for this book">
      <label className="bookmgmt__field">
        <span>Title</span>
        <input
          type="text"
          maxLength={MAX_BOOK_TITLE_LENGTH}
          placeholder="Game Log"
          value={draft.title}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
      </label>
      <label className="bookmgmt__field">
        <span>Subtitle</span>
        <input
          type="text"
          maxLength={MAX_BOOK_SUBTITLE_LENGTH}
          placeholder="Dad and me"
          value={draft.subtitle}
          onChange={(e) => setSubtitleDraft(e.target.value)}
          onBlur={commitSubtitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
      </label>

      <BookCoverPicker book={draft} onChange={(patch) => updateCover(book.id, patch)} />

      {confirmingRemove ? (
        <div className="bookmgmt__confirm">
          <p>
            Remove “{book.title || 'Game Log'}”? Every stamp in it goes back to the
            tray, keeping its game, its note and its score — nothing is deleted, and
            you can press each one into another book.
          </p>
          <div className="bookmgmt__actions">
            <button type="button" className="btn btn--ghost" onClick={handleRemove}>
              Remove book
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setConfirmingRemove(false)}
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <div className="bookmgmt__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Done
          </button>
          <button
            type="button"
            className="bookmgmt__remove"
            disabled={!canRemove}
            onClick={() => setConfirmingRemove(true)}
          >
            Remove this book
          </button>
        </div>
      )}
      {!canRemove && (
        <p className="hint hint--prose">
          This is the only book you hold, and the Game Log always keeps one. Start
          another and you can remove this one.
        </p>
      )}
    </div>
  )
}
