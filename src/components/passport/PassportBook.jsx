import '../../styles/49-passport-book.css'
import { useCallback, useEffect, useMemo } from 'react'
import { MAX_PAGES, PAGE_ASPECT, stampsOnPage } from '../../lib/passportLayout.js'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'
import { PassportPage } from './PassportPage.jsx'
import { usePageTurn } from './usePageTurn.js'

// The passport book — the shell PassportPage sits inside, and the leaf that
// turns between openings. See usePageTurn.js's header for why this is not
// built on src/components/page-turn/ (short version: that transition is
// forward-only by design, and its preview layer exists to solve a spoiler
// problem a page of already-revealed stamps doesn't have).
//
// ===========================================================================
// The physical model — one leaf, two faces, hinged at the spine
// ===========================================================================
// The book is a stack of leaves. On a desktop an "opening" is two pages lying
// flat (1|2, then 3|4, …), which is also what makes a leaf real: the RIGHT
// page of one opening and the LEFT page of the next are the two sides of the
// SAME sheet of paper. So a turn is one panel hinged at the spine, rotating
// 180° with a front face and a back face:
//
//   forward:  front = the opening we're leaving, right page
//             back  = the opening we're arriving at, left page   (0° → −180°)
//   backward: front = the opening we're arriving at, right page
//             back  = the opening we're leaving, left page       (−180° → 0°)
//
// Because the destination is ALREADY rendered flat underneath (usePageTurn
// commits navigation first — see its header), the leaf's back face lands
// exactly on top of the identical page beneath it and unmounting it is
// invisible. There is no cross-fade and no snap.
//
// On a phone an opening is a single page, which the same rule covers without
// a special case: it lives in the `right` slot, `left` is always empty, so a
// turn shows the page you're leaving swinging away over blank paper. The one
// consequence is that a mid-turn leaf reaches outside the book box, which is
// why the stage clips.
//
// ===========================================================================
// The cover
// ===========================================================================
// `coverSlot` is rendered, never built here. It gets its own opening at index
// 0 sitting in the RIGHT slot with the left slot empty — which is a closed
// book on a desk, and makes the cover behave as an ordinary leaf: turning
// forward from it flips the cover to the left and reveals page 1. No branch in
// the animation code knows the cover exists.
//
// Props:
//   pageCount     how many pages the book has (from passportLayout's
//                 pageCountFor — clamped again here because this component
//                 must be safe on any input, including a fresh book with no
//                 stamps at all, which is pageCount 1 and an empty page 1).
//   stamps        every stamp in the book; each page is filtered out of this
//                 with passportLayout's `stampsOnPage`, so the placement rules
//                 have exactly one implementation.
//   factsByPk     { [gamePk]: gameFacts }, passed straight through.
//   onStampClick  (gamePk) => void.
//   onPageTap     ({ page, x, y }) => void — the PAGE is added here, because a
//                 desktop opening shows two of them and a bare {x,y} could not
//                 say which one was tapped. x/y are fractions of that page.
//   onAddPage     () => void — offered on the LAST page only, and only while
//                 the book is under MAX_PAGES.
//   placing       truthy while the user is choosing where to stamp.
//   selectedPk    the placed stamp whose options bar is open, ringed on its
//                 page so the bar is visibly about that keepsake.
//   movingPk      the placed stamp being re-placed, faded on its OLD spot so
//                 the pending ghost reads as "here instead".
//   landedPk      the stamp just confirmed, which plays the press once.
//   onLanded      (gamePk) => void when that press finishes.
//   coverSlot     React node rendered as the front cover.
//   stand         draw the timber board the closed book stands on (below).
//   onOpeningChange  ({ cover }) => void whenever the visible opening changes.
//                 The screen around the book has controls that only make sense
//                 once the book is OPEN — arranging it by date is the one
//                 today — and nothing else here tells it which opening is up.

// The two-page breakpoint. Deliberately NOT the app's shared WIDE_QUERY
// (740px, hooks/useMediaQuery.js): at 740 a two-up spread of passport-shaped
// pages is narrower than a phone's single page, which reads as a pamphlet.
// 900 is where two pages still look like a book. Exported so the CSS media
// query has a named twin — the two must move together.
export const BOOK_WIDE_QUERY = '(min-width: 900px)'

// One opening: what sits in the left and right slots. A slot holds a page
// number, the string 'cover', or null for "nothing there" (the desk beside a
// closed book, or the back of the last leaf).
function buildOpenings(pageCount, perOpening, hasCover) {
  const openings = []
  if (hasCover) openings.push({ cover: true, left: null, right: 'cover' })
  for (let page = 1; page <= pageCount; page += perOpening) {
    openings.push(
      perOpening === 2
        ? { cover: false, left: page, right: page + 1 <= pageCount ? page + 1 : null }
        : { cover: false, left: null, right: page },
    )
  }
  return openings
}

function openingLabel(opening, pageCount) {
  if (!opening) return ''
  if (opening.cover) return 'Cover'
  if (typeof opening.left === 'number' && typeof opening.right === 'number') {
    return `Pages ${opening.left}–${opening.right} of ${pageCount}`
  }
  const page = typeof opening.right === 'number' ? opening.right : opening.left
  return `Page ${page} of ${pageCount}`
}

export function PassportBook({
  pageCount,
  stamps = [],
  factsByPk = {},
  onStampClick,
  onPageTap,
  onAddPage,
  placing = false,
  coverSlot = null,
  openPage = null,
  pending = null,
  pendingGamePk = null,
  selectedPk = null,
  movingPk = null,
  landedPk = null,
  onLanded,
  stand = false,
  onOpeningChange,
}) {
  const wide = useMediaQuery(BOOK_WIDE_QUERY)
  const perOpening = wide ? 2 : 1
  // A book always has at least one page even with nothing in it — an empty
  // page 1 is the correct empty state here, not a "no stamps yet" placeholder
  // (the collection screen owns that message, if it wants one).
  const pages = Math.min(MAX_PAGES, Math.max(1, Math.trunc(pageCount) || 1))
  const hasCover = Boolean(coverSlot)

  const openings = useMemo(
    () => buildOpenings(pages, perOpening, hasCover),
    [pages, perOpening, hasCover],
  )

  const { spread, from, direction, turnId, turning, canPrev, canNext, next, prev, settle, turnTo } =
    usePageTurn({ spreadCount: openings.length })

  // `openPage` lets the SCREEN say which page the book should be showing —
  // picking a stamp out of the tray jumps to the first page with room, and
  // adding a page turns to it. Deliberately a nudge rather than full control:
  // the book still owns its own position, so paging by hand afterwards is not
  // fought by a re-render.
  useEffect(() => {
    if (!Number.isInteger(openPage)) return
    const index = openings.findIndex(
      (opening) => opening.left === openPage || opening.right === openPage,
    )
    if (index >= 0) turnTo(index)
  }, [openPage, openings, turnTo])

  const current = openings[spread] ?? openings[0]
  const leaving = from == null ? null : openings[from] ?? null

  // Closed or open, reported up. `usePageTurn` commits the navigation before it
  // plays the leaf (see its header), so this flips at the START of a turn off
  // the cover rather than when the sheet finishes — which is what the screen
  // above wants: the book is being opened from the moment you turn it.
  const onCover = Boolean(current?.cover)
  useEffect(() => {
    onOpeningChange?.({ cover: onCover })
  }, [onCover, onOpeningChange])

  const handleKeyDown = useCallback(
    (event) => {
      // Arrow keys turn the book whenever focus is anywhere inside it — the
      // root itself is a tab stop, so a keyboard user lands on the book and
      // can page through it without hunting for the Back/Next buttons.
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        next()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        prev()
      }
    },
    [next, prev],
  )

  // Renders whatever belongs in a slot. `live` is false for the two faces of
  // the turning leaf, which are a duplicate of content that is also mounted
  // for real underneath: they take no callbacks and never open the placing
  // target, so a tap can't land on a page that is mid-flight. (The leaf is
  // also aria-hidden + inert, so this is belt and braces — but the belt is
  // what stops a stray click, and the braces are what stop a screen reader
  // reading the book twice.)
  const renderSlot = useCallback(
    (entry, { live }) => {
      if (entry === 'cover') return <div className="passportbook__cover">{coverSlot}</div>
      if (typeof entry !== 'number') {
        // A face with no page on it is the blank reverse of a sheet; a slot
        // with nothing beside it (the closed book's left half) is the desk.
        return live ? (
          <div className="passportbook__empty" aria-hidden="true" />
        ) : (
          <div
            className="passportbook__blank"
            style={{ aspectRatio: PAGE_ASPECT }}
            aria-hidden="true"
          />
        )
      }
      return (
        <PassportPage
          page={entry}
          stamps={stampsOnPage(stamps, entry)}
          factsByPk={factsByPk}
          onStampClick={live ? onStampClick : undefined}
          onPageTap={live ? (point) => onPageTap?.({ page: entry, ...point }) : undefined}
          onAddPage={live ? onAddPage : undefined}
          // The "add a page" affordance belongs at the end of the book, once,
          // and only while there is room left under passportLayout's cap.
          canAddPage={live && entry === pages && pages < MAX_PAGES && Boolean(onAddPage)}
          placing={live ? placing : false}
          // The tapped-but-unconfirmed spot, drawn as a ghost. Only ever on
          // the page it was tapped on, and never on the turning leaf.
          pending={live && pending?.page === entry ? pending : null}
          pendingGamePk={pendingGamePk}
          // Both are decoration on a LIVE page only. The turning leaf is a
          // duplicate of content that is also mounted for real underneath, so
          // a ring or a fade on a sheet in flight would read as a second copy
          // of the same highlight sliding across the book.
          selectedPk={live ? selectedPk : null}
          movingPk={live ? movingPk : null}
          // Likewise live-only, and for a sharper reason than the other two: a
          // leaf face that replayed the press would stamp the page a second
          // time in front of the user, mid-turn.
          landedPk={live ? landedPk : null}
          onLanded={live ? onLanded : undefined}
        />
      )
    },
    [
      coverSlot,
      stamps,
      factsByPk,
      onStampClick,
      onPageTap,
      onAddPage,
      pages,
      placing,
      pending,
      pendingGamePk,
      selectedPk,
      movingPk,
      landedPk,
      onLanded,
    ],
  )

  // The two faces of the sheet in flight. See the physical model above; both
  // turns use the same sheet, they just play it in opposite directions.
  const forward = direction === 'forward'
  const frontEntry = leaving && (forward ? leaving.right : current.right)
  const backEntry = leaving && (forward ? current.left : leaving.left)

  return (
    <div
      className="passportbook"
      role="group"
      aria-label="Passport book"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className={`passportbook__stage${wide ? ' passportbook__stage--wide' : ''}`}>
        <div className="passportbook__spread">
          {wide && renderSlot(current.left, { live: true })}
          {renderSlot(current.right, { live: true })}
        </div>

        {/* The spine only exists when two pages lie flat against each other. */}
        {wide && !current.cover && <div className="passportbook__spine" aria-hidden="true" />}

        {turning && (
          <div
            // Keyed on the turn id so a second turn taken mid-flight remounts
            // this node and replays the CSS animation from its first frame,
            // rather than joining one already half-played (usePageTurn.js).
            key={turnId}
            className="passportbook__leaf"
            data-direction={direction}
            aria-hidden="true"
            // `inert` (not `inert=""`): React 19 treats an empty string as
            // FALSE for a boolean attribute and warns, so the turning leaf
            // would have stayed focusable — which is the one thing this
            // attribute is here to prevent.
            inert
            // The faces' shading pseudo-elements animate too, and their
            // animationend bubbles here targeting the FACE, not the leaf.
            // Same duration, so it would be harmless — but only the sheet's
            // own rotation finishing means the turn is over.
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget) settle(turnId)
            }}
          >
            <div className="passportbook__face passportbook__face--front">
              {renderSlot(frontEntry, { live: false })}
            </div>
            <div className="passportbook__face passportbook__face--back">
              {renderSlot(backEntry, { live: false })}
            </div>
          </div>
        )}
      </div>

      {/* The board a closed book stands on — the same timber the shelf's own
          planks are drawn from (58-logbook-shelf.css), so one book on its own
          page and four books on a shelf are furniture of the same kind. A
          sibling of the stage rather than something inside it: the stage clips,
          and this board overhangs the book on both sides the way a shelf does.
          Only while the cover is up — turn the page and the book is open on a
          desk, which is not a thing that stands on anything. */}
      {stand && onCover && <div className="passportbook__stand" aria-hidden="true" />}

      <nav className="passportbook__nav" aria-label="Passport pages">
        <button
          type="button"
          onClick={prev}
          disabled={!canPrev}
          aria-label="Back one page"
        >
          ‹ Back
        </button>
        {/* Announced politely so a keyboard user turning pages with the arrow
            keys hears where they landed — the pages themselves are a wall of
            SVG keepsakes with no heading to move focus to. */}
        <span className="passportbook__where" aria-live="polite">
          {openingLabel(current, pages)}
        </span>
        <button
          type="button"
          onClick={next}
          disabled={!canNext}
          aria-label="Next page"
        >
          Next ›
        </button>
      </nav>
    </div>
  )
}
