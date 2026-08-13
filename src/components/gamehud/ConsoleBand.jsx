import { useMediaQuery, WIDE_QUERY } from '../../hooks/useMediaQuery.js'
import { DueUpConsole } from './DueUpConsole.jsx'
import { HalfTally } from './HalfTally.jsx'
import { BetweenInnings } from './BetweenInnings.jsx'
import { ScorebugMount } from './ScorebugMount.jsx'

// The innings viewer's console row (ADR-0043) — the whole top of the scorer's
// console, mounted for every half now, live or historical, as one component
// rather than ninety lines inside InningViewer.jsx (which is at its own size
// budget, and where the row's states read as unrelated conditionals).
//
// The band itself is `ScorebugMount focused`: the same scorebug, placed rather
// than floated, at its own dock width — its one placement now, there is no
// floating dock any more. Beside it, exactly one of two cards spends the
// width the band does not use — and which one is a plain statement of
// whether the half on screen is sealed or revealed, not of how the reader
// got there:
//
//  • STILL SCORING IT (sealed) -> `DueUpConsole`, the next three batters.
//  • REVEALED -> `HalfTally` + `BetweenInnings` stacked in one
//    `.consolebar__tallygroup` column — two cards, still one flex slot. Shows
//    for ANY revealed half now, not only the one just watched close — see
//    `showTally` below.
//  • NEITHER -> nothing, and that is now open paper rather than a slab.
//    `.gamehud--console:only-child` used to stretch the band across the row
//    whenever it stood alone, which at 1280 drew a ~930px navy rectangle
//    holding two 24px club marks. The rule is retired (styles/focus/console.css);
//    the band keeps its size at every width.
//
// The due-up card is wide-width only, and BELOW that width it is not mounted
// at all — not merely hidden. `.dueupconsole` is `display: none` under 740
// (styles/focus/console.css), and mounting it anyway meant three headshot
// fetches plus a whole-feed computeBatterLine walk per batter, on every render,
// on the primary device, for a card nobody could see — the exact
// build-what-folds cost #686 removed from the stage's hidden surfaces. The
// `wide` gate below is the same value the CSS breakpoint is (WIDE_QUERY), so
// the DOM changes only where the card was already invisible; a phone reads the
// same three names from `.upnext` in the stage below. The tally is different:
// it renders at EVERY width (a phone stacks it under the band — see
// console.css), so it takes no gate.
//
// Purely a placement component: every value arrives already resolved and
// already reveal-gated by InningViewer, exactly as it did at the old call site.
export function ConsoleBand({
  started,
  live,
  feed,
  unlocked,
  revealedThrough,
  runsInProgress,
  meta,
  treatment,
  viewIdx,
  viewInning,
  viewHalf,
  getDerived,
  currentSealed,
  closePhase,
  stepAtBatIndex,
  bundle,
  marginNotes,
  workload,
  gameDate,
}) {
  const wide = useMediaQuery(WIDE_QUERY)
  // THE DUE-UP CARD IS FOR A HALF STILL BEING SCORED, PERIOD — not for a half
  // merely just finished. "Who's due up" is meaningless once the half is
  // over, so this keys on `currentSealed` (still being actively scored)
  // rather than `!postHalf` (which also covers "revealed, however reached" —
  // that's `showTally`'s territory now, below). `wide` is orthogonal: a
  // phone never mounts this card at all — see the header note.
  //
  // THE OPENING STATE IS THIS CARD'S TOO. It starts the half open (before any
  // step), so the band isn't alone in the row on the state the reader lands
  // in every half. The half's first three batters fill that width instead.
  // `.upnext` in the stage below stands down while this card is up, so the
  // same three men are not named twice (styles/focus/console.css).
  const showDueUp = wide && currentSealed

  // THE TALLY (+ BETWEEN INNINGS) NOW SHOWS FOR ANY REVEALED HALF, not only
  // the one just watched close — a half reached via RollingLine's navigator,
  // or returned to after "See the whole half", gets exactly the same
  // console-band content as one you just finished scoring. `viewIdx <=
  // revealedThrough` is the literal gate `HalfTally`'s reveal-only reads
  // stand on (ADR-0001); it no longer needs `postHalf` to imply it.
  const showTally = viewIdx <= revealedThrough

  // Highest-scoring Margin Note (buildMarginNotes is pre-sorted).
  const topNote = marginNotes?.[0]?.text ?? null

  return (
    <div className="consolebar">
      <ScorebugMount
        started={started}
        // Unmodified `live`: the band's batter row used to be blanked here
        // before the first step (the argument being DueUpConsole beside it
        // already named the leadoff man), which left the band looking
        // half-built — pitcher named, batter row just gone — at the exact
        // moment (waiting on the first pitch) a reader looks at it most.
        // Naming him twice reads better than a card that looks unfinished.
        live={live}
        feed={feed}
        unlocked={unlocked}
        revealedThrough={revealedThrough}
        runsInProgress={runsInProgress}
        meta={meta}
        treatment={treatment}
        viewIdx={viewIdx}
        viewInning={viewInning}
        viewHalf={viewHalf}
        focused
      />
      {showDueUp && (
        <DueUpConsole
          feed={feed}
          inning={viewInning}
          half={viewHalf}
          revealedThrough={revealedThrough}
          stepAtBatIndex={stepAtBatIndex}
          teamId={viewHalf === 'top' ? meta.away.id : meta.home.id}
        />
      )}
      {showTally && (
        <div className="consolebar__tallygroup">
          <HalfTally
            feed={feed}
            inning={viewInning}
            half={viewHalf}
            battingSide={viewHalf === 'top' ? 'away' : 'home'}
            getDerived={getDerived}
            phase={closePhase}
            topNote={topNote}
          />
          {/* Half-keyed so its tap-through `idx` resets to 0 on every half
              change. Harmless when `showTally` was only ever true for one
              transient postHalf window (this component would unmount between
              halves anyway) — but showTally now stays true across every
              revealed half paged through via RollingLine, and ConsoleBand
              itself never remounts on half change, so without this key a
              browsed half would inherit whatever card index the reader left
              the PREVIOUS revealed half showing. */}
          <BetweenInnings
            key={`${viewInning}-${viewHalf}`}
            feed={feed}
            bundle={bundle}
            marginNotes={marginNotes}
            inning={viewInning}
            half={viewHalf}
            revealedThrough={revealedThrough}
            workload={workload}
            gameDate={gameDate}
          />
        </div>
      )}
    </div>
  )
}
