// THE LENS'S GEOMETRY (ADR-0092) — pure, so `npm test` can pin it.
//
// On a phone the scorecard opens in "lens mode": the real sheet, zoomed so the
// rail and two inning columns fill the pane, under a fixed navy frame that
// always holds the next sealed box. The sheet never moves by a transform. The
// PANE scrolls, by the amount `lensOffset` computes from MEASURED rects (G1,
// G2): a bat-around inning widens into extra columns and a substitute stacks
// lines in the rail, so a column or row number cannot say where a box is.
//
// Nothing here reads the feed or a result. The inputs are the reveal state
// the page already holds and rects of boxes already in the DOM.

// The ONE phone test for the lens. A sideways phone gets the lens later
// (#724, slices L8 and L9), which widens this query and nothing else.
export const PHONE_LENS_QUERY = '(max-width: 480px)'

// The frame's top edge, as a share of the pane's height: the lower half of the
// screen, where a thumb reaches (brief section 2).
const FRAME_AT = 0.54

// Lens mode is on only on a phone, only with a frontier to hold, and only while
// a tap commits a reveal. Under Scores Unlocked or a stamp, `effectiveReveal`
// gives `commitReveals` false or no `stepInfo` (ADR-0026, ADR-0048): the sheet
// is inked to the end, so there is nothing for the frame to hold. Ask that
// answer; do not re-derive it here (G7).
export function lensOn({ phone, stepInfo, commitReveals }) {
  return Boolean(phone && stepInfo && commitReveals)
}

// The zoom that makes the compact rail plus two inning columns fill the pane:
// the previous inning to the left, the frontier's inning under the frame. Widths
// are the sheet's natural (unzoomed) ones. Capped at the sheet's own maximum.
export function lensZoom({ paneWidth, railWidth, cellWidth, max }) {
  const natural = railWidth + 2 * cellWidth
  if (!paneWidth || !natural) return 1
  return Math.min(paneWidth / natural, max)
}

// Where the frame sits in the pane (pane pixels, from the pane's top-left
// inner corner), and the spacer that lets row 9 reach it (G3): scroll cannot
// go past the content, so row 9 needs `padBottom` of paper below it.
//
// THE SEAT AND THE RIDE (Gary, 2026-10-05). The frame's place is the SEAT,
// 54% down the pane, for every box that can reach it. A box near the top of
// the order cannot: scroll cannot go negative. That box keeps its own place
// on the sheet and the frame RIDES up to it: on row 1 it sits under the
// header, then it moves down one row a tap until it reaches the seat, and the
// sheet scrolls from there. Before this, a spacer above slot 1 let row 1 reach
// the seat, and it showed as a band of blank paper over the order.
// `cellTop` is the frontier box's top in the pane's content (its place at
// scroll 0), or null before it is measured.
//
// `bandAbove` and `bandBelow` are the paper above the frame (under the
// header) and below it (over the foot row): the carry strip takes the larger.
//
// The frame is over the SECOND column after the rail, so the previous inning
// shows to its left. In inning 1 the sheet's own blank pad column takes that
// place, and the frame does not move.
export function lensFrame({ paneHeight, headerHeight, footHeight = 0, railRight, cellWidth, cellHeight, cellTop = null }) {
  const seat = Math.round(paneHeight * FRAME_AT)
  const top = cellTop == null ? seat : Math.min(seat, Math.max(Math.round(cellTop), headerHeight))
  return {
    top,
    left: railRight + cellWidth,
    width: cellWidth,
    height: cellHeight,
    padBottom: Math.max(paneHeight - seat, 0),
    bandAbove: Math.max(top - headerHeight, 0),
    bandBelow: Math.max(paneHeight - footHeight - (top + cellHeight), 0),
  }
}

// The scroll position that puts a cell's top-left corner on the frame's.
// `cellRect` and `paneRect` are viewport rects (getBoundingClientRect, with
// the pane's at its inner corner); the cell's place in the scrolled content is
// its offset from the pane plus the pane's current scroll. Rounded, so a
// re-measure a fraction of a pixel off does not scroll again.
export function lensOffset({ cellRect, paneRect, scrollTop, scrollLeft, frame }) {
  return {
    top: Math.max(Math.round(scrollTop + cellRect.top - paneRect.top - frame.top), 0),
    left: Math.max(Math.round(scrollLeft + cellRect.left - paneRect.left - frame.left), 0),
  }
}
