import { useBecameTrue } from '../../hooks/motion/useBecameTrue.js'

// A name the scorer has crossed out — and, when the crossing-out happens while
// the reader is on the page, the pencil line being DRAWN rather than simply
// being there on the next render.
//
// ONE COMPONENT FOR FOUR SURFACES. The play-by-play card (.pbp__replaced), the
// lineup card (.lineupcard__name--out), the defense diamond
// (.defdiamond__name--out) and the scorecard sheet's own footer diamond all
// mark a replaced player the same way and now draw it the same way. Each keeps
// its own class — the settled appearance still belongs to that surface's
// partial — and this only decides WHEN the bar is animated.
//
// WHY THE BAR IS A PSEUDO-ELEMENT AND NOT `text-decoration` (issue #981,
// Route A). `text-decoration: line-through` cannot animate, so the strike
// used to snap on. It also had a standing fragility: a <button> does not
// inherit an ancestor's decoration, and .plink zeroes its own outright, so
// every one of these rules had to name `.plink` a second time or the line
// would draw over an un-linked inning tag and skip the name beside it. That is
// the exact bug scripts/check-strike-links.mjs was written to catch. A bar
// drawn over the WRAPPER covers whatever the wrapper holds, link or not, so
// the fragility is gone rather than guarded. The guard stays: three
// line-through rules remain elsewhere (two exempt pills, one roster row), and
// it now walks subdirectories too.
//
// THE BAR HANGS OFF AN INNER SPAN, NOT THE WRAPPER, AND THAT IS THE WHOLE
// REASON THIS RENDERS TWO ELEMENTS. `text-decoration` hugged the GLYPHS; an
// absolutely-positioned bar fills its containing block, and at two of the four
// sites that block is much wider than the name inside it. `.abhero__name` and
// `.abhero__pr` are items of a COLUMN flex container (`.abhero__who`), so they
// stretch to its full cross size — 262px of box behind 87px of "Jake Bauers",
// which drew the pencil line 175px out into the empty half of the card.
// `.defdiamond__name` carries `min-width: 58px` and centres its text, because
// that width is the scorebook writing line the `border-bottom` prints; a
// six-letter surname left the bar hanging off both ends.
//
// So the bar goes on `.struckline`, which is inline and therefore hugs exactly
// the text — the glyphs the decoration used to cross — while still SITTING
// OUTSIDE the link, which is the whole point of Route A: it covers a `.plink`
// button, an un-linked inning tag and bare text alike, without having to know
// which it got. The two flex sites restore their own layout onto it (see
// styles/motion/strike.css); the wrapper keeps every class, colour and layout
// rule it already had.
//
// `struck` is a fact about the LINEUP, not about the score — who is in the
// game, which the app renders outside the seal on purpose as the pre-scoring
// reference (ADR-0010). Nothing here may be handed a run, and the draw must
// never be keyed to one.
export function StruckLine({ struck, className = '', children, ...rest }) {
  // Only a substitution the reader was here for draws itself; a cold load, a
  // poll and a page revisit all render the line already down. See useBecameTrue.
  const drawing = useBecameTrue(Boolean(struck))
  return (
    <span className={className} {...rest}>
      <span className={`struckline${drawing ? ' is-drawing' : ''}`}>{children}</span>
    </span>
  )
}
