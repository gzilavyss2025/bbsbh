import { useCallback, useRef } from 'react'
import { PAGE_ASPECT, PAGE_MARGIN, STAMP_WIDTH } from '../../lib/passportLayout.js'
import { GameStamp } from '../GameStamp.jsx'
import { PassportWatermark } from './PassportWatermark.jsx'

// One page of the passport book (PassportBook.jsx) — the paper a stamp lands
// on, and nothing else. No book chrome, no turn animation, no confirm UI.
//
// ===========================================================================
// SPOILER NOTE
// ===========================================================================
// This file renders GameStamp, which IS a final score. That is safe here for
// exactly the reason it is safe on the Logbook grid and nowhere else: every
// `stamps` entry is one of this user's own stamps, and the server refuses to
// mint one for a game the user has not finished revealing (ADR-0035). Read
// GameStamp.jsx's own header before rendering this component anywhere that
// could show a game the user has NOT stamped; scripts/check-stamp-surfaces.mjs
// is the enforcement.
//
// ===========================================================================
// Every number here is imported, none is tuned by eye
// ===========================================================================
// The page's shape (PAGE_ASPECT), how wide a stamp sits (STAMP_WIDTH), and the
// margin the art must stay inside (PAGE_MARGIN) all come from
// src/lib/passportLayout.js, which is the single source of truth for the
// book's geometry and is pinned by test/passport-layout.test.js. A placement's
// x/y are FRACTIONS of the page box marking the stamp's CENTRE — that is what
// lets the same book render correctly on a 390px phone page and a 520px
// desktop spread, so they become percentages here and never pixels.
//
// Props:
//   page          1-based page number, both the label and what onPageTap and
//                 onAddPage are about.
//   stamps        the live stamp records placed on THIS page, already filtered
//                 and ordered by passportLayout's `stampsOnPage`. Each is
//                 { gamePk, placement: { page, x, y, tilt }, date, mode, ... }.
//   factsByPk     { [gamePk]: gameFacts } — the shape GameStamp draws with.
//                 A missing entry is normal (offline, a failed batch), not an
//                 error; the stamp holds its place with what the local record
//                 carries, same as the Logbook grid does.
//   onStampClick  (gamePk) => void — what a tap on a placed stamp MEANS is the
//                 caller's job (today: open that stamp's options, from which
//                 the game, a re-placement, and the tray all hang).
//   selectedPk    the stamp whose options are open, ringed so the bar above
//                 the book is visibly about THIS keepsake and not another.
//   movingPk      the stamp being re-placed. It is still on the page — a move
//                 is not an un-place, and abandoning one must leave the stamp
//                 exactly where it was — so it is drawn faded. That is what
//                 makes the ghost read as "here instead of there" rather than
//                 as a second copy of the same stamp.
//   landedPk      the stamp just confirmed, which plays the press once — the
//                 only thing in the book that moves on its own.
//   onLanded      (gamePk) => void when that press finishes, so the caller can
//                 forget it. Driven by animationend rather than a timer here,
//                 so the duration lives in the CSS and nowhere else.
//   onPageTap     ({ x, y }) => void, fractions of this page box. Only ever
//                 called while `placing`.
//   onAddPage     () => void, from the "add a page" control.
//   canAddPage    whether to show that control at all (the caller owns the
//                 policy — see PassportBook, which shows it on the last page).
//   placing       truthy while the user is choosing where to stamp: the page
//                 surface becomes one big tap target. This component renders
//                 NO confirm/cancel UI — it reports the point and stops.
const STAMP_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

// 'YYYY-MM-DD' — the one date shape the app shares (lib/stamps.js's
// isDayString) — read as a LOCAL calendar day. `new Date('2026-08-04')` would
// parse as UTC midnight and render as the day before west of Greenwich.
function stampDate(date) {
  const [year, month, day] = String(date ?? '').split('-').map(Number)
  return year ? STAMP_DATE.format(new Date(year, month - 1, day)) : ''
}

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n)

// Where a tap landed, as fractions of the element's own box.
//
// Reads a touch point when the event carries one and falls back to the plain
// client coordinates otherwise, so this covers mouse, pen, and touch through
// the single `click` handler rather than needing a pointer/touch pair (a
// touch's `click` reports clientX/clientY too, but a synthesized or
// touch-list-bearing event may not). Returns null when the geometry is
// unusable — a zero-sized box (the page is display:none mid-turn) or an event
// with no coordinates at all.
function tapFractions(event, element) {
  const rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const touch = event.changedTouches?.[0] ?? event.touches?.[0] ?? null
  const clientX = touch ? touch.clientX : event.clientX
  const clientY = touch ? touch.clientY : event.clientY
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  }
}

export function PassportPage({
  page,
  stamps = [],
  factsByPk = {},
  onStampClick,
  onPageTap,
  onAddPage,
  canAddPage = false,
  placing = false,
  pending = null,
  pendingGamePk = null,
  selectedPk = null,
  movingPk = null,
  landedPk = null,
  onLanded,
}) {
  const targetRef = useRef(null)

  // The crosshair follows the pointer by writing two custom properties
  // straight onto the DOM node instead of going through state: a pointermove
  // handler that re-rendered would re-render every GameStamp on the page (each
  // one an SVG with a turbulence filter) on every mouse move.
  const trackPointer = useCallback((event) => {
    const element = targetRef.current
    if (!element) return
    const point = tapFractions(event, element)
    if (!point) return
    element.style.setProperty('--tap-x', `${point.x * 100}%`)
    element.style.setProperty('--tap-y', `${point.y * 100}%`)
    element.style.setProperty('--tap-shown', '1')
  }, [])

  const clearPointer = useCallback(() => {
    targetRef.current?.style.setProperty('--tap-shown', '0')
  }, [])

  const handleTap = useCallback(
    (event) => {
      // `detail === 0` is a keyboard activation of the button (Enter/Space),
      // which carries no meaningful coordinates. The centre of the page is the
      // honest answer there, and passportLayout's `nudgeFromCollisions` will
      // walk it off anything already sitting in the middle — so placing a
      // stamp without a pointer still works rather than silently doing nothing.
      const point =
        (event.detail === 0 ? null : tapFractions(event, event.currentTarget)) ?? { x: 0.5, y: 0.5 }
      onPageTap?.({ x: point.x, y: point.y })
    },
    [onPageTap],
  )

  return (
    <div
      className={`passportpage${placing ? ' passportpage--placing' : ''}`}
      // From passportLayout, never restated: the page IS its aspect ratio, and
      // the width it is given (phone column or half a desktop spread) settles
      // the rest.
      style={{ aspectRatio: PAGE_ASPECT }}
    >
      {/* The near-transparent Tally watermark goes here — an empty slot on
          purpose. Owned by another surface; this file only guarantees it is
          the FIRST child, so it paints under every stamp. */}
      {/* The ghost printing a real passport page has under its cancellations.
          Decorative and inert — see PassportWatermark.jsx, which owns being
          aria-hidden and pointer-events:none so it can never swallow a tap
          meant for placing a stamp. */}
      <PassportWatermark page={page} />

      {stamps.map((stamp) => {
        const facts = factsByPk?.[stamp?.gamePk]
        const placement = stamp?.placement
        if (!placement) return null
        const dateText = stampDate(stamp.date)
        const selected = selectedPk != null && stamp.gamePk === selectedPk
        const moving = movingPk != null && stamp.gamePk === movingPk
        const landed = landedPk != null && stamp.gamePk === landedPk
        return (
          <button
            type="button"
            key={stamp.gamePk}
            className={`passportpage__stamp${selected ? ' passportpage__stamp--selected' : ''}${
              moving ? ' passportpage__stamp--moving' : ''
            }${landed ? ' passportpage__stamp--landed' : ''}`}
            // The press plays once and then this stamp is an ordinary stamp
            // again. Told rather than timed: a duration written here would be a
            // second copy of the one in the CSS, free to drift from it.
            //
            // `event.target === event.currentTarget` because an animationend
            // from anything inside GameStamp would bubble to here and end the
            // press early — the same guard, for the same reason, as the
            // turning leaf's in PassportBook.jsx.
            onAnimationEnd={
              landed
                ? (event) => {
                    if (event.target === event.currentTarget) onLanded?.(stamp.gamePk)
                  }
                : undefined
            }
            style={{
              left: `${placement.x * 100}%`,
              top: `${placement.y * 100}%`,
              width: `${STAMP_WIDTH * 100}%`,
              // The -50%/-50% pull that makes x/y mean the stamp's CENTRE
              // lives in the CSS alongside the rotation, since both are one
              // transform and splitting them would let one silently drop the
              // other.
              '--stamp-tilt': `${placement.tilt ?? 0}deg`,
            }}
            onClick={() => onStampClick?.(stamp.gamePk)}
          >
            {facts ? (
              // The accessible name comes from GameStamp's own <title>, and
              // the date is passed explicitly (rather than left to the art's
              // default) so this file's contract — "the name includes the
              // date" — holds here and can't drift with the art.
              <GameStamp
                game={facts}
                title={`${facts.away?.abbreviation ?? 'Away'} at ${facts.home?.abbreviation ?? 'Home'}, ${dateText}`}
              />
            ) : (
              // Facts unresolved (offline, or a batch that failed). The
              // keepsake is still the user's, so it holds its spot on the page
              // with what the local record itself carries — the same call the
              // Logbook grid makes.
              <span className="passportpage__pending">{dateText}</span>
            )}
          </button>
        )
      })}

      {/* The proposal: where the stamp WOULD land, drawn at the same size and
          angle it will have, so "confirm or try again" is a decision about the
          real thing rather than about a crosshair. Not a button — it is not
          placed yet, and there is nothing here to open.

          A DIRECT child of the page, deliberately: its left/top are fractions
          of the PAGE box, so it has to resolve against the page's own
          positioning context. Nested inside .passportpage__foot (itself
          absolutely positioned in the corner) those percentages would measure
          the corner chip instead — and a <div> inside a <p> is closed by the
          parser besides, which would tear the footer in half. */}
      {pending && (
        <div
          className="passportpage__ghost"
          aria-hidden="true"
          style={{
            left: `${pending.x * 100}%`,
            top: `${pending.y * 100}%`,
            transform: `translate(-50%, -50%) rotate(${pending.tilt}deg)`,
            width: `${STAMP_WIDTH * 100}%`,
          }}
        >
          {factsByPk[pendingGamePk] ? (
            <GameStamp game={factsByPk[pendingGamePk]} instanceId={`ghost-${pendingGamePk}`} />
          ) : null}
        </div>
      )}

      <p className="passportpage__foot">
        <span className="passportpage__number">{page}</span>
        {canAddPage && (
          <button
            type="button"
            className="passportpage__addpage"
            onClick={() => onAddPage?.()}
            aria-label={`Add a page after page ${page}`}
          >
            + Page
          </button>
        )}
      </p>

      {placing && (
        <button
          type="button"
          ref={targetRef}
          className="passportpage__target"
          onClick={handleTap}
          onPointerMove={trackPointer}
          onPointerLeave={clearPointer}
          onPointerCancel={clearPointer}
          aria-label={`Place your stamp on page ${page}`}
          // The crosshair is drawn at the size the stamp will actually be, so
          // the affordance answers "how big is this thing" as well as "where".
          // Same import as the placed stamps use — one number, one source.
          style={{ '--stamp-w': `${STAMP_WIDTH * 100}%` }}
        >
          {/* The margin no stamp may cross (passportLayout clamps every
              placement to it) drawn as a dashed guide, plus a crosshair that
              tracks the pointer. Both are decoration on the tap target — the
              target is the whole page, the guide only says where the art will
              actually settle. */}
          <span
            className="passportpage__margin"
            style={{ inset: `${PAGE_MARGIN * 100}%` }}
            aria-hidden="true"
          />
          <span className="passportpage__crosshair" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
