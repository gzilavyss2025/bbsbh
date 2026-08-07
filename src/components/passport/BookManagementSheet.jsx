import '../../styles/58-logbook-shelf.css'
import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { fetchStaticTeams } from '../../api/teams-static.js'
import { MAX_BOOK_SUBTITLE_LENGTH, MAX_BOOK_TITLE_LENGTH } from '../../lib/books.js'
import { SPORT_IDS } from '../../lib/teams.js'
import { CoverColorPicker } from './CoverColorPicker.jsx'

// The Game Log's book-management sheet (ADR-0036's multi-book addendum) —
// create a book, rename/re-cover an existing one, or remove one. Reachable
// from two places, by design (see the PRD phase this ships under): the
// shelf, when 2+ books already exist, and a small settings affordance on a
// single open book's own view — so a user who has never touched this feature
// can still discover "make a second book" without ever seeing a shelf first.
// Both hosts render this same component; only the `book` prop differs.
//
// The mode switcher at the top is what makes the second discovery path work:
// opened in EDIT mode for the book you're looking at, it still offers "New
// book" right there, so creating a second book never requires finding the
// shelf.
//
// `books`/`createBook`/`updateCover`/`removeBook`/`stamps`/`unplaceStamp` are
// PROPS, not this component's own `useBooks()`/`useStamps()` calls, and that
// is deliberate rather than plumbing for its own sake. Both hosts of this
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
//
// The club list is `fetchStaticTeams()` — the same-origin static file, not a
// live statsapi request — the same source ProfilePage.jsx and
// FavoriteTeamModal.jsx-adjacent My Tally section use for an identical
// picker. It is cached in-memory by that module, so mounting this sheet
// alongside an already-fetched instance costs nothing extra.
export function BookManagementSheet({
  book = null,
  books,
  createBook,
  updateCover,
  removeBook,
  stamps,
  unplaceStamp,
  onClose,
  onCreated,
  onRemoved,
}) {
  const clubs = useAsync(fetchStaticTeams, [])
  const teams = clubs.data?.bySportId?.[String(SPORT_IDS.MLB)] ?? []

  const [mode, setMode] = useState(book ? 'edit' : 'create')
  const editing = mode === 'edit' ? book : null

  // ---- CREATE ---------------------------------------------------------
  // Plain controlled state, not the commit-on-blur pattern below: there is
  // no existing record to patch until "Create book" is actually pressed, so
  // committing per field has nothing to commit TO yet.
  const [newTitle, setNewTitle] = useState('')
  const [newSubtitle, setNewSubtitle] = useState('')
  const [newCoverTeamId, setNewCoverTeamId] = useState(null)
  const [createFailed, setCreateFailed] = useState(false)

  const handleCreate = () => {
    const id = createBook(newTitle, newSubtitle, newCoverTeamId)
    if (id) {
      setCreateFailed(false)
      onCreated?.(id)
    } else {
      // Only reachable at MAX_BOOKS (src/lib/books.js) — a real cap, so the
      // affordance says why rather than silently doing nothing.
      setCreateFailed(true)
    }
  }

  // ---- EDIT (rename / re-cover) ---------------------------------------
  // Committed on blur, not per keystroke — the exact pattern
  // StampGameButton.jsx's note field already uses, and for the identical
  // reason: every save bumps `updatedAt`, which is what BooksCloudSync diffs
  // on to decide what to publish, so a per-keystroke write would publish a
  // request per character.
  const [titleDraft, setTitleDraft] = useState(null)
  const [subtitleDraft, setSubtitleDraft] = useState(null)

  const commitTitle = () => {
    if (editing && titleDraft != null && titleDraft !== editing.title) {
      updateCover(editing.id, { title: titleDraft })
    }
    setTitleDraft(null)
  }
  const commitSubtitle = () => {
    if (editing && subtitleDraft != null && subtitleDraft !== editing.subtitle) {
      updateCover(editing.id, { subtitle: subtitleDraft })
    }
    setSubtitleDraft(null)
  }

  // ---- REMOVE -----------------------------------------------------------
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  // Never leave the user with zero live books — src/lib/books.js's own
  // removeBook comment says this policy belongs to the UI layer, not the
  // pure store. This IS that UI layer, so the refusal lives here, the same
  // way StampGameButton.jsx refuses a full season and says so rather than
  // offering a button that would silently do nothing.
  const canRemove = Boolean(editing) && books.length > 1

  const handleRemove = () => {
    if (!canRemove) return
    // Un-place every stamp filed in this book before tombstoning it — send
    // them back to the tray rather than deleting them. A stamp's `bookId`
    // lives inside its `placement`, so clearing the placement is what "no
    // longer filed here" means; the keepsake itself is untouched.
    for (const stamp of stamps) {
      if (stamp.placement?.bookId === editing.id) unplaceStamp(stamp.gamePk)
    }
    removeBook(editing.id)
    onRemoved?.()
  }

  return (
    <div className="bookmgmt" role="group" aria-label="Manage your Game Log books">
      <div className="bookmgmt__modes" role="group" aria-label="Create or edit a book">
        {book && (
          <button
            type="button"
            className={mode === 'edit' ? 'is-active' : ''}
            aria-pressed={mode === 'edit'}
            onClick={() => setMode('edit')}
          >
            Edit “{book.title || 'Game Log'}”
          </button>
        )}
        <button
          type="button"
          className={mode === 'create' ? 'is-active' : ''}
          aria-pressed={mode === 'create'}
          onClick={() => setMode('create')}
        >
          New book
        </button>
      </div>

      {mode === 'create' ? (
        <>
          <label className="bookmgmt__field">
            <span>Title</span>
            <input
              type="text"
              maxLength={MAX_BOOK_TITLE_LENGTH}
              placeholder="Game Log"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </label>
          <label className="bookmgmt__field">
            <span>Subtitle</span>
            <input
              type="text"
              maxLength={MAX_BOOK_SUBTITLE_LENGTH}
              placeholder="Dad and me"
              value={newSubtitle}
              onChange={(e) => setNewSubtitle(e.target.value)}
            />
          </label>
          <CoverColorPicker
            teams={teams}
            value={newCoverTeamId}
            onChange={setNewCoverTeamId}
            ariaLabel="New book's cover colour"
          />
          {createFailed && (
            <p className="hint hint--prose">
              You’re holding as many books as this app allows. Remove one before
              starting another.
            </p>
          )}
          <div className="bookmgmt__actions">
            <button type="button" className="btn btn--seal" onClick={handleCreate}>
              Create book
            </button>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        editing && (
          <>
            <label className="bookmgmt__field">
              <span>Title</span>
              <input
                type="text"
                maxLength={MAX_BOOK_TITLE_LENGTH}
                placeholder="Game Log"
                value={titleDraft ?? editing.title ?? ''}
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
                value={subtitleDraft ?? editing.subtitle ?? ''}
                onChange={(e) => setSubtitleDraft(e.target.value)}
                onBlur={commitSubtitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
              />
            </label>
            <CoverColorPicker
              teams={teams}
              value={editing.coverTeamId}
              onChange={(coverTeamId) => updateCover(editing.id, { coverTeamId })}
              ariaLabel="Cover colour"
            />

            {confirmingRemove ? (
              <div className="bookmgmt__confirm">
                <p>
                  Remove “{editing.title || 'Game Log'}”? Its stamps go back to the
                  tray — nothing is deleted.
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
                You need at least one book — create another before you can remove
                this one.
              </p>
            )}
          </>
        )
      )}
    </div>
  )
}
