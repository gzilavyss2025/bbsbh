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
// `carry` is the carry strip (CarryStrip.jsx). It takes the larger band of
// paper beside the frame (useLens's `bandAbove` and `bandBelow`): above, from
// the sticky header down to the frame, when the frame sits at its seat; below,
// under the docked card and over the foot row, when the frame rides up near
// the top of the order. Never over the frame. It takes no taps, so the pane
// still pans under it.
export function LensFrame({ frame, dock = null, carry = null }) {
  const docked = useBecameTrue(Boolean(dock))
  if (!frame) return null
  const below = carry && frame.bandBelow > frame.bandAbove
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
      {carry && !below && (
        <div className="sc-lens__carry" style={{ top: frame.top - frame.bandAbove, maxHeight: frame.bandAbove }}>
          {carry}
        </div>
      )}
      {(dock || below) && (
        <div className="sc-lens__under" style={{ top: frame.top + frame.height, maxHeight: frame.bandBelow }}>
          {dock && <div className={`sc-lens__dock ${docked ? 'sc-lens__dock--fresh' : ''}`}>{dock}</div>}
          {below && <div className="sc-lens__carry sc-lens__carry--below">{carry}</div>}
        </div>
      )}
    </>
  )
}
