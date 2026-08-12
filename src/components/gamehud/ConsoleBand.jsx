import { DueUpConsole } from './DueUpConsole.jsx'
import { HalfTally } from './HalfTally.jsx'
import { ScorebugMount } from './ScorebugMount.jsx'

// Focus mode's console row (ADR-0043) — the whole top of the scorer's console,
// as one component rather than ninety lines inside InningViewer.jsx (which is
// at its own size budget, and where the row's three states read as three
// unrelated conditionals).
//
// The band itself is `ScorebugMount focused`: the same scorebug, placed rather
// than floated, at its own dock width. Beside it, exactly one of two cards
// spends the width the band does not use — and which one is a plain statement
// of where the reader is in the half:
//
//  • STILL SCORING IT -> `DueUpConsole`, the next three batters.
//  • THE HALF IS OVER -> `HalfTally`, its line and pitch analysis.
//  • NEITHER -> nothing, and that is now open paper rather than a slab.
//    `.gamehud--console:only-child` used to stretch the band across the row
//    whenever it stood alone, which at 1280 drew a ~930px navy rectangle
//    holding two 24px club marks. The rule is retired (styles/focus/console.css);
//    the band keeps its size at every width.
//
// Both companions are desktop-only in CSS. A phone gives the row's whole width
// to the band and has the least vertical room to spare, so it reads the same
// three names from `.upnext` in the stage below and the same numbers from
// Summary.
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
  postHalf,
  steps,
  stepFrontierIdx,
  stepAtBatIndex,
}) {
  // THE DUE-UP CARD'S TWO CONDITIONS, each shutting off a way it can lie or
  // loiter:
  //   • `!postHalf` — not once the half is OVER. "Who's due up" is meaningless
  //     after the 3rd out.
  //   • `steps === 0 || stepFrontierIdx != null` — the card tracks the batting
  //     order as the reader steps, and it can only do that with
  //     `lastAtBatIndex`, which InningViewer has only for the half immediately
  //     after the reveal mark (see its win-prob clamp). Reach a half via
  //     RollingLine's navigator and step it and the arithmetic silently falls
  //     back to the PRE-half leadoff slot — the card would name the same three
  //     men no matter how far in the reader got, and a card that quietly stops
  //     being true is worse than no card. BEFORE the first step, though, that
  //     fallback is not a fallback: the pre-half leadoff slot is the right
  //     answer for any half, which is the very figure UpNextBatters shows.
  //
  // THE OPENING STATE IS THIS CARD'S TOO. It used to start only at the first
  // step, leaving the band alone in the row on the state the reader lands in
  // every half. The half's first three batters fill that width instead.
  // `.upnext` in the stage below stands down while this card is up, so the same
  // three men are not named twice (styles/focus/console.css).
  const showDueUp = !postHalf && (steps === 0 || stepFrontierIdx != null)

  // The tally takes the due-up card's slot once the half is done. `viewIdx <=
  // revealedThrough` is what `postHalf` already implies, stated because it is
  // the gate HalfTally's reveal-only reads actually stand on (ADR-0001).
  const showTally = postHalf && viewIdx <= revealedThrough
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
        <HalfTally
          feed={feed}
          inning={viewInning}
          half={viewHalf}
          battingSide={viewHalf === 'top' ? 'away' : 'home'}
          getDerived={getDerived}
        />
      )}
    </div>
  )
}
