import '../styles/48-logbook.css'
import '../styles/49-passport-book.css'
import { useCallback, useMemo, useState } from 'react'
import { fetchStampGames } from '../api/logbook.js'
import { useAsync } from '../hooks/useAsync.js'
import { useBooks } from '../hooks/useBooks.js'
import { useStamps } from '../hooks/useStamps.js'
import { useNav } from '../lib/nav.js'
import { DEFAULT_BOOK_ID } from '../lib/books.js'
import { pathForBook, statsPathFor } from '../lib/logbookNav.js'
import { gamePath, logbookNewPath, logbookPath, logbookPlacePath } from '../lib/route.js'
import {
  PAGE_CAPACITY,
  autoLayout,
  layoutInDateOrder,
  openingPageFor,
  otherPlacementsOn,
  pageCountFor,
  pageIsFullFor,
  placementFor,
} from '../lib/passportLayout.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'
import { GameStamp } from '../components/logbook/GameStamp.jsx'
import { ClubsSeen } from '../components/logbook/ClubsSeen.jsx'
import { StampCollection } from './logbook/StampCollection.jsx'
import { PassportBook } from '../components/passport/PassportBook.jsx'
import { PassportCover } from '../components/passport/PassportCover.jsx'
import { BookOrderControl } from '../components/passport/BookOrderControl.jsx'
import { BookManagementSheet } from '../components/passport/BookManagementSheet.jsx'

// One open Game Log book — the topbar, the tray, the passport book itself,
// and the season grid below it (ADR-0035, ADR-0036). Split out of
// LogbookPage.jsx when the multi-book shelf (ADR-0036's addendum) pushed that
// file past check-file-size.mjs's 600-line ceiling; that file keeps the
// route-facing shell — the Clerk gate and the shelf-vs-single-book resolver
// (`LogbookRoot`) — and hands this component the `book` record it resolved.
// Read its header for the spoiler-containment argument and the two-step
// placement flow this component implements — the split changed neither.
//
// Every number the book is drawn with comes from src/lib/passportLayout.js.
// Nothing in this file computes a position; if you find yourself typing a
// coordinate here, it belongs there, where a test can reach it.

const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function monthDay(date) {
  const [year, month, day] = String(date ?? '').split('-').map(Number)
  return year ? MONTH_DAY.format(new Date(year, month - 1, day)) : ''
}

export function LogbookCollection({ book, season: requestedSeason = null, placing = null }) {
  const navigate = useNav()
  const { books, updateCover, removeBook } = useBooks()
  const { counts, seasons, forSeason, all, place, unplace, placeAll } = useStamps()
  const bookId = book.id

  // Which books are still on the shelf. A stamp can name one that is not — a
  // removal made on ANOTHER device arrives as a tombstone whose un-placements
  // may not have landed yet — and such a stamp rendered NOWHERE: no page holds
  // it, and it is not unplaced either. `isFiled` puts it back in the tray.
  const liveBookIds = useMemo(() => new Set(books.map((b) => b.id)), [books])
  const isFiled = useCallback(
    (entry) => Boolean(entry.placement) && liveBookIds.has(entry.placement.bookId),
    [liveBookIds],
  )

  // Every LIVE, PLACED stamp filed in THIS book — the only filtering
  // passportLayout.js's own functions need, and entirely this caller's job
  // (they stay book-agnostic themselves).
  const bookStamps = useMemo(
    () => all.filter((s) => (s.placement?.bookId ?? DEFAULT_BOOK_ID) === bookId),
    [all, bookId],
  )

  // The tray: minted, and not on a page of any book that still exists. Shared
  // by every book — a stamp waiting for a page belongs to none of them yet,
  // which is what lets you file it into whichever one you open.
  const tray = useMemo(() => all.filter((entry) => !isFiled(entry)), [all, isFiled])

  // This book's own two addresses, built once. `bookCount` decides whether the
  // default book answers to the bare /logbook or needs its explicit address
  // (lib/logbookNav.js) — getting it wrong lands you on the SHELF rather than
  // the book you were reading, which is how that book became unopenable.
  const bookCount = books.length
  const thisBookPath = pathForBook(book, { season: requestedSeason, bookCount })
  const thisStatsPath = statsPathFor(book, { bookCount })

  // The management sheet for THIS book — reachable without ever seeing the
  // shelf, which is what lets a single-book user discover "make a second
  // book" at all (ADR-0036's multi-book addendum).
  const [managing, setManaging] = useState(false)

  // Which stamp, if any, we are placing. Seeded from `?place=` (the hand-off
  // from the box score's mint card) but owned locally afterwards, so picking a
  // different one from the tray doesn't have to rewrite the URL.
  const [placingPk, setPlacingPk] = useState(placing)
  // The tapped-but-not-yet-confirmed spot. Deliberately NOT committed on tap:
  // "confirm or try again" is the whole interaction, and a stamp that landed
  // the moment you touched the page would have no try-again.
  const [pending, setPending] = useState(null)
  // Which PLACED stamp has its options open. Tapping a stamp in the book used
  // to navigate straight to its game; it now opens this instead, because a
  // keepsake you can only ever leave has no way back off a spot you regret.
  // The extra tap to reach the game is the price, and the grid below the book
  // still opens one in a single tap.
  const [selectedPk, setSelectedPk] = useState(null)
  // The stamp that has JUST been put down, which plays the press once and then
  // clears itself when the animation reports back. Only ever set by a confirm —
  // "place them all for me" deliberately does not set it, because a pageful
  // pressing at once is a flurry, not a stamping.
  const [landedPk, setLandedPk] = useState(null)
  // Which spread of the book is open, and how many blank pages this device has
  // added past the last placement. Page count is a local view preference — how
  // many empty pages you keep is not part of the collection (ADR-0036).
  const [addedPages, setAddedPages] = useState(1)
  // NULL, not 1 — the book opens on its cover, and you turn past it. Seeding
  // this with a page number makes the sync inside PassportBook turn straight
  // to that page on mount, so the cover would exist and never once be seen.
  // It is set only when something actively wants a page: picking a stamp out
  // of the tray, adding a page — or arriving here WITH a stamp, which is a
  // book opened to be written in rather than read (see `openingPageFor`).
  const [openPage, setOpenPage] = useState(() =>
    placing ? openingPageFor(bookStamps, placing) : null,
  )
  // Whether the book is turned open or still showing its cover. Reported up by
  // PassportBook, because `openPage` above is a NUDGE rather than the book's
  // position (see its header) and says nothing once the reader pages by hand.
  // Only "arrange this book by date" needs it: that control acts on pages, so
  // it waits until there are pages in front of you. Seeded from `placing`,
  // which is a book opened to be written in.
  const [bookOpen, setBookOpen] = useState(Boolean(placing))
  const onOpeningChange = useCallback(({ cover }) => setBookOpen(!cover), [])

  // Re-seed from the prop when `?place=` CHANGES — React's documented
  // adjust-state-during-render pattern rather than an effect, which would
  // render once with the stale stamp selected and then again with the right
  // one (and trips the cascading-render lint rule besides).
  const [seenPlacing, setSeenPlacing] = useState(placing)
  if (placing !== seenPlacing) {
    setSeenPlacing(placing)
    setPlacingPk(placing)
    setPending(null)
    setSelectedPk(null)
    // Only ON the way in. Losing `?place=` is what confirming and cancelling
    // both do, and neither should turn the book away from the page you were
    // just looking at.
    if (placing) setOpenPage(openingPageFor(bookStamps, placing))
  }

  // Facts for the WHOLE collection: the book spans every season, unlike the
  // season-paged grid below it. Keyed on the pk list rather than the array
  // identity so a note edit doesn't refetch every game.
  const gamePks = useMemo(() => all.map((s) => s.gamePk), [all])
  const pkKey = gamePks.join(',')
  const facts = useAsync((signal) => fetchStampGames(gamePks, { signal }), [pkKey])
  const byPk = facts.data ?? {}

  // Book-scoped — a page's capacity, and how many pages this book shows, must
  // never be decided by another book's placements. `total` stays the WHOLE
  // collection's size on purpose: "No stamps yet" is about whether this user
  // has ever stamped a game at all, not about this one book, since the tray
  // is shared by every book (see `tray` above).
  const pageCount = pageCountFor(bookStamps, addedPages)
  const total = all.length

  // A bare /logbook lands the GRID on the newest season the collection has —
  // only the local store knows which that is, so the route leaves it null and
  // the resolution happens here. (The book itself is never season-paged.)
  const season = requestedSeason ?? seasons[0] ?? null
  const seasonStamps = useMemo(() => (season ? forSeason(season) : []), [season, forSeason])

  const placingStamp = placingPk ? all.find((s) => s.gamePk === placingPk) : null
  const selectedStamp = selectedPk ? all.find((s) => s.gamePk === selectedPk) : null
  // A move rather than a first placement — the stamp already sits somewhere.
  // Every difference between the two is a wording change here plus the two
  // `except` arguments below; the store makes no distinction at all.
  const movingFrom = placingStamp?.placement ?? null

  // Tapping the page proposes a spot; passportLayout decides where it actually
  // lands, nudging off anything it would badly cover.
  const onPageTap = useCallback(
    ({ page, x, y }) => {
      if (!placingPk) return
      // Everything already on that page counts as taken — except the stamp
      // being moved, which must not be nudged off its own current spot. Both
      // reads are book-scoped: a page 3 in THIS book must not be treated as
      // full because some other book's page 3 happens to hold eight stamps.
      // `bookId` rides along on the placement itself from here on — this is
      // the one place a new placement is born, so it is where the stamp is
      // filed into whichever book is currently open.
      setPending({
        ...placementFor(placingPk, page, { x, y }, otherPlacementsOn(bookStamps, page, placingPk)),
        bookId,
      })
    },
    [placingPk, bookStamps, bookId],
  )

  const confirmPlacement = useCallback(() => {
    if (!placingPk || !pending) return
    place(placingPk, pending)
    setPending(null)
    setPlacingPk(null)
    setLandedPk(placingPk)
    // Drop `?place=` so a refresh (or the back button) doesn't reopen the mode
    // for a stamp that is already on the page.
    if (placing) navigate(thisBookPath, { replace: true })
  }, [placingPk, pending, place, placing, navigate, thisBookPath])

  const cancelPlacement = useCallback(() => {
    setPending(null)
    setPlacingPk(null)
    if (placing) navigate(thisBookPath, { replace: true })
  }, [placing, navigate, thisBookPath])

  // The press is over; this is an ordinary stamp again. Driven by the
  // animation ending rather than by a timer, so the duration lives in the CSS
  // and nowhere else. Under reduced motion nothing fires and the mark simply
  // stays set — the class is inert there, so there is nothing to clean up.
  const forgetLanded = useCallback(() => setLandedPk(null), [])

  // Pick a stamp up off the page it is on. The book turns to that page first,
  // so the move starts with the old spot in view — you are correcting a
  // position, not choosing one from nothing.
  const startMove = useCallback((entry) => {
    if (!entry?.placement) return
    setSelectedPk(null)
    setPending(null)
    setPlacingPk(entry.gamePk)
    setOpenPage(entry.placement.page)
  }, [])

  const openGame = useCallback(
    (gamePk) => {
      const game = byPk[gamePk]
      if (!game) return
      // Straight to lineup 1 — a stamped game is one you have already been
      // through, so the book returns you to the top of it rather than to the
      // box score you left from.
      navigate(
        gamePath(game.date, game.away.abbreviation, game.home.abbreviation, 'lineup1', game.gameNumber),
      )
    },
    [byPk, navigate],
  )

  // Re-place this book's PLACED stamps in date order (ADR-0036's amendment).
  // Every one gets a real placement write, so the arrangement survives a reload
  // and reaches the user's other devices. `layoutInDateOrder` skips the tray,
  // which this book's list carries when it is the default book.
  const reorderBook = useCallback(
    (direction) => {
      placeAll(
        layoutInDateOrder(bookStamps, { direction }).map((p) => ({
          ...p,
          placement: { ...p.placement, bookId },
        })),
      )
      // The book now runs from page 1 with nothing skipped, so it needs no
      // pages past the ones it filled — and the user is turned back to the
      // first of them rather than left looking at a page this just emptied.
      setAddedPages(1)
      setOpenPage(1)
      setSelectedPk(null)
    },
    [bookStamps, bookId, placeAll],
  )

  const addPage = useCallback(() => {
    setAddedPages((n) => Math.max(n, pageCount) + 1)
    setOpenPage(pageCount + 1)
  }, [pageCount])

  return (
    <div className="screen logbook">
      <SiteHeader />
      {/* The book's name leads the page, hard left, with its controls on the
          right of the same line and the way OUT of the book on the line under
          it. The title used to sit between two controls, which centred it and
          let a long one squeeze. */}
      <header className="topbar logbook__head">
        <h1 className="topbar__title">{book.title || 'Game Log'}</h1>
        <div className="logbook__headtools">
          {/* Settings and Add + are always both here — rename, re-cover and
              remove belong to the book you have open, however many you keep.
              The way back to the shelf leads them, and only exists once there
              is a shelf to go back to.

              Both routes out carry the stamp you are placing: the shelf
              re-opens as the book picker it already is, and a book started here
              opens ready for it. Wrong book is the ordinary mistake, and the
              way back from it used to be the box score. */}
          {bookCount > 1 && (
            <button
              type="button"
              className="btn btn--chip"
              onClick={() => navigate(placingPk ? logbookPlacePath(placingPk) : logbookPath())}
            >
              ‹ Shelf
            </button>
          )}
          <button type="button" className="btn btn--chip" onClick={() => setManaging(true)}>
            Settings
          </button>
          <button
            type="button"
            className="btn btn--chip"
            onClick={() => navigate(logbookNewPath(placingPk))}
          >
            Add +
          </button>
        </div>
      </header>

      {total > 0 && (
        <button
          type="button"
          className="btn btn--chip logbook__headstats"
          onClick={() => navigate(thisStatsPath)}
        >
          Stats ›
        </button>
      )}

      {managing && (
        <BookManagementSheet
          book={book}
          books={books}
          updateCover={updateCover}
          removeBook={removeBook}
          stamps={all}
          unplaceStamp={unplace}
          onClose={() => setManaging(false)}
          onRemoved={() => {
            setManaging(false)
            // The book just removed can no longer be resolved; the bare
            // route re-resolves to whatever remains (the shelf, or the one
            // book left).
            navigate(logbookPath())
          }}
        />
      )}

      {total === 0 ? (
        <p className="hint hint--prose">
          No stamps yet. Reveal a game’s box score and stamp it — it lands here, and
          you choose where on the page it goes.
        </p>
      ) : (
        <>
          {/* Shown only when it holds something, so a fully-arranged book
              carries no chrome for it. */}
          {tray.length > 0 && !placingPk && (
            <section className="logbook__tray" aria-label="Stamps waiting to be placed">
              <p className="logbook__traylede">
                {tray.length} {tray.length === 1 ? 'stamp is' : 'stamps are'} waiting
                for a page.
              </p>
              <ul className="logbook__traylist">
                {tray.slice(0, 8).map((entry) => (
                  <li key={entry.gamePk}>
                    <button
                      type="button"
                      className="logbook__traystamp"
                      onClick={() => {
                        setPlacingPk(entry.gamePk)
                        setPending(null)
                        setOpenPage(openingPageFor(bookStamps, entry.gamePk, addedPages))
                      }}
                    >
                      {byPk[entry.gamePk] ? (
                        <GameStamp
                          game={byPk[entry.gamePk]}
                          instanceId={`tray-${entry.gamePk}`}
                        />
                      ) : (
                        <span>{monthDay(entry.date)}</span>
                      )}
                      <small>Place {monthDay(entry.date)}</small>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() =>
                  placeAll(
                    // `autoLayout` doesn't know about books (passportLayout.js
                    // stays book-agnostic by design) — filing every stamp into
                    // the book currently open is entirely this call site's job.
                    autoLayout(tray, { startPage: pageCount }).map((p) => ({
                      ...p,
                      placement: { ...p.placement, bookId },
                    })),
                  )
                }
              >
                Place them all for me
              </button>
            </section>
          )}

          {/* A placed stamp's options. Tapping a stamp in the book opens this
              rather than jumping straight to the game, which is what makes a
              placement editable at all: the three things you can do with a
              keepsake already on a page live in one place, and "Move it" is
              just placing mode again. Never shown while placing — the two are
              the same slot above the book, and one bar at a time. */}
          {selectedStamp && !placingPk && (
            <section className="logbook__selected" aria-live="polite">
              <p className="logbook__placinglede">
                {monthDay(selectedStamp.date)} · page {selectedStamp.placement?.page}
              </p>
              <div className="logbook__placingactions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => openGame(selectedStamp.gamePk)}
                >
                  Open game ›
                </button>
                <button
                  type="button"
                  className="btn btn--seal"
                  onClick={() => startMove(selectedStamp)}
                >
                  Move it
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    unplace(selectedStamp.gamePk)
                    setSelectedPk(null)
                  }}
                >
                  Back to the tray
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setSelectedPk(null)}
                >
                  Done
                </button>
              </div>
            </section>
          )}

          {/* Placement mode: the page becomes a tap target, and the tapped spot
              is a proposal until it is confirmed. The same mode runs a MOVE —
              `movingFrom` only changes the wording, so there is one flow to
              keep honest rather than two that can drift apart. */}
          {placingPk && (
            <section className="logbook__placing" aria-live="polite">
              <p className="logbook__placinglede">
                {pending
                  ? movingFrom
                    ? 'There instead? Confirm it, or tap somewhere else.'
                    : 'There? Confirm it, or tap somewhere else.'
                  : movingFrom
                    ? `Tap where ${monthDay(placingStamp?.date)} should go instead — any page.`
                    : `Tap the page where you want ${monthDay(placingStamp?.date)} to go.`}
              </p>
              <div className="logbook__placingactions">
                {pending && (
                  <button type="button" className="btn btn--seal" onClick={confirmPlacement}>
                    {movingFrom ? 'Move it here' : 'Stamp it here'}
                  </button>
                )}
                <button type="button" className="btn btn--ghost" onClick={cancelPlacement}>
                  Cancel
                </button>
              </div>
              {/* The stamp being moved does not count against the page it is
                  moving off — a full page, one of those keepsakes being this
                  one, still has room for it to land somewhere else on it. */}
              {pageIsFullFor(bookStamps, openPage, placingPk) && !pending && (
                <p className="hint hint--prose">
                  This page holds {PAGE_CAPACITY}. Turn to a new one, or add one from the
                  corner.
                </p>
              )}
            </section>
          )}

          {/* An action on the whole book, so it sits with the book's other
              controls above the pages rather than over them. Never while a bar
              is up: placing and a stamp's options are both conversations about
              ONE keepsake, and one bar at a time is the rule of this slot.

              And never while the book is CLOSED. Re-placing every stamp from
              page 1 is an action on pages, offered over a cover with no page in
              sight — it read as chrome belonging to the whole screen rather
              than to the book, and it was the loudest thing above the fold. */}
          {!placingPk && !selectedStamp && bookOpen && (
            <BookOrderControl count={bookStamps.length} onReorder={reorderBook} />
          )}

          <PassportBook
            pageCount={pageCount}
            openPage={openPage}
            onOpenPage={setOpenPage}
            stamps={bookStamps}
            factsByPk={byPk}
            pending={pending}
            pendingGamePk={placingPk}
            placing={Boolean(placingPk)}
            selectedPk={selectedPk}
            movingPk={placingPk}
            landedPk={landedPk}
            onLanded={forgetLanded}
            onStampClick={setSelectedPk}
            onPageTap={onPageTap}
            onAddPage={addPage}
            onOpeningChange={onOpeningChange}
            stand
            coverSlot={<PassportCover book={book} onOpen={() => setOpenPage(1)} />}
          />

          {/* The league under the book — which clubs have turned up in a game
              you stamped. Reads the WHOLE collection (`all`), not the season
              the grid below is paged to: a club you sat with in 2024 is a club
              you have seen. */}
          <ClubsSeen stamps={all} factsByPk={byPk} />

          {/* Everything the Logbook already showed, shifted below the book —
              and now behind a disclosure, closed on arrival. See that file. */}
          <StampCollection
            seasons={seasons}
            season={season}
            counts={counts}
            stamps={seasonStamps}
            factsByPk={byPk}
            loading={facts.loading}
            isFiled={isFiled}
            monthDay={monthDay}
            onSeason={(year) => navigate(pathForBook(book, { season: year, bookCount }))}
            onStats={() => navigate(thisStatsPath)}
            onOpenGame={openGame}
            onOpenOptions={(entry) => {
              setPlacingPk(null)
              setPending(null)
              setSelectedPk(entry.gamePk)
              setOpenPage(entry.placement.page)
            }}
          />
        </>
      )}

      <ReportFooter />
    </div>
  )
}
