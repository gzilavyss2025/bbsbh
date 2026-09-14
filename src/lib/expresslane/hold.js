// EXPRESS LANE — THE HELD PLAY: the picture first, the notation after.
//
// THE HOLE THIS FILLS, and it is the one the film gate left behind. The gate
// stops the CURSOR until the clip is on the device. It never stopped the
// NOTATION arriving in the same frame, so an advance drew the outcome box —
// "SO", the strikeout's K, the shaded diamond — at the instant the video
// started. The scorer read the answer off the paper before the pitch was
// thrown on the screen. The gate was intact, and the picture was decoration.
//
// So a play a scorer advances onto is HELD. The film plays; the box, the
// runners' diamonds, the new chip and the play's own sentence stay unwritten
// until he says he has watched it. One tap, or one key.
//
// IT IS NOT A SECOND SEAL, AND IT MUST NOT BECOME ONE. The app's own reveal
// mark does not move while a play is held — useExpressLane commits it on the
// reveal rather than on the landing — so the last out of a half does not put
// that half's run total into the running line overhead while the scorer is
// still watching the out. Held in one band and open in another is not held.
//
// THREE PURE ANSWERS, here rather than inside the hook, because `npm test`
// imports no JSX and cannot reach a React hook. Pinned by
// test/express-lane-hold.test.js.

// WHETHER THIS ROW IS WORTH HOLDING, and the answer is exactly "is there a
// picture to watch".
//
// A hold with no film behind it is friction and nothing else: a mound visit, a
// substitution, a pitch MLB never clipped, a playId minted by formula for an
// intentional walk, a clip the byte store let go behind the cursor, or one the
// scorer already consented to score without. Every one of those lands on a
// deck with an empty pane above it, and covering the box would ask for a
// second tap to read a play that could not have been watched.
//
// `gateFor`'s own vocabulary answers it with no second spelling of the rule.
// 'ready' is the single reason that means the bytes are on the device and the
// pane is showing them. 'paperwork', 'no-film', 'evicted' and 'consented' are
// each a row with nothing to watch; 'waiting' and 'stalled' block the cursor
// and never land one here at all.
export function holdsForFilm(gate) {
  return gate?.reason === 'ready'
}

// THE ROW AS THE DECK MUST READ IT WHILE THE PLAY IS HELD.
//
// `isTerminal: false` is the whole of it, and it is a REUSE rather than a new
// rule. `railStepCap` already reads a non-terminal row as "the plate
// appearance this row sits inside has not been earned yet" and caps the feed
// SHORT of its card — the same gate that stopped a cursor resting on a mound
// visit from drawing the finished box around it. A held terminal row wants
// that cap for that reason, so it asks the question already asked instead of
// teaching `expressDeck` a second way to say no.
//
// What the deck draws from it is what the paper looks like at that moment: the
// empty box the scorer is about to write in, the man at the plate named above
// it, and the men on base standing where they stood BEFORE the pitch.
export function unwrittenRow(row) {
  return row ? { ...row, isTerminal: false } : null
}

// THE PLAY'S OWN SENTENCE — the feed's play-by-play line, which is what settles
// a play the picture leaves ambiguous. A ball to the second baseman who throws
// across to third, a run scoring from second on the relay, which bag was
// covered and by whom: the clip shows it and the sentence names it.
//
// REVEAL-ONLY with the rest of the row. It narrates the outcome, so it is
// drawn only once the play is revealed — never while it is held, and never
// into the DOM behind a cover (ADR-0001).
//
// A terminal row prefers the PLAY's description, which carries the runners'
// advances as well as the batter's own result. Every other row falls back to
// the EVENT's, which is what one pitch in Full mode has to say for itself.
export function playStory(row) {
  return row?.result?.description || row?.description || ''
}
