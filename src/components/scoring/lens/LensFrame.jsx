import { useBecameTrue } from '../../../hooks/motion/useBecameTrue.js'

// The lens's two fixed marks (ADR-0092): the navy FRAME that holds the next
// sealed box, and the RULER under the batter's row, from the pane's left edge
// to the frame. Both sit over the pane, outside its scroll, so they never
// move: the sheet scrolls under them.
//
// pointer-events: none on both (lens.css), so the seal under the frame stays
// the real button and the one reveal path (G5). Navy, never kraft: kraft means
// "a tap lifts a seal" (ADR-0083), and the frame lifts nothing.
//
// `frame` is useLens's measured place, in pane pixels. The frame's look is the
// same before and after any result; it depends only on where the frontier is,
// which the reader can already see (G8).
//
// `dock` is the one card under the frame (LensCards.jsx), its top a fixed gap
// under the frame's bottom edge. Unlike the frame, it takes taps. A card that
// docks while the lens is up fades in (`--fresh`, motion/scorecard-lens.css);
// one that is there on a cold load or a return to the lens does not
// (useBecameTrue).
//
// `carry` is the carry strip (CarryStrip.jsx), pinned in the top spacer band:
// from the pane's top, under the sticky header, down to the frame (`padTop` is
// that band's height). It takes no taps, so the pane still pans under it.
export function LensFrame({ frame, dock = null, carry = null }) {
  const docked = useBecameTrue(Boolean(dock))
  if (!frame) return null
  return (
    <>
      <div
        className="sc-lens__frame"
        aria-hidden="true"
        style={{ top: frame.top, left: frame.left, width: frame.width, height: frame.height }}
      />
      <div
        className="sc-lens__ruler"
        aria-hidden="true"
        style={{ top: frame.top + frame.height, width: frame.left }}
      />
      {carry && (
        <div className="sc-lens__carry" style={{ top: frame.top - frame.padTop, maxHeight: frame.padTop }}>
          {carry}
        </div>
      )}
      {dock && (
        <div className={`sc-lens__dock ${docked ? 'sc-lens__dock--fresh' : ''}`} style={{ top: frame.top + frame.height }}>
          {dock}
        </div>
      )}
    </>
  )
}
