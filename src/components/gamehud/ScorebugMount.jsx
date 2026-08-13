import { revealRunsThrough } from '../../api/linescore.js'
import { Scorebug } from './Scorebug.jsx'

// The scorebug's one placement now: an ANCHORED band at the top of the stage
// (`.gamehud--console`, ConsoleBand.jsx), for every half — live or
// historical. Split out of InningViewer.jsx — which was at its 1000-line
// budget — so the runs arithmetic sits in one file instead of being spelled
// out at the call site.
//
// There used to be a second placement — a floating dock, corner-stepping
// affordance included, for a revealed half on the old unfocused stacked
// page — retired along with that page. The dock existed to survive a page
// that scrolled its own linescore out of view; every half gets the anchored
// band now, and nothing here scrolls the band out of reach, so there is
// nothing left for a floating dock to answer.
//
// Spoiler footing is unchanged from the call site this replaces.
// `revealRunsThrough` is reveal-only (linescore.js, ADR-0001) and is still
// reached only under the same `started && live` gate it always was — the early
// return below IS that gate, just moved one component down.
export function ScorebugMount({
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
}) {
  if (!started || !live) return null

  // THE HALF ON SCREEN CAPS THE SCORE, not the reader's game-wide reveal mark.
  // The bug this fixes: page back to the bottom of the 1st in a game revealed
  // all the way through and the dock read 5-6 — the FINAL score, on a page
  // whose own linescore said 1-0. `revealedThrough` is a high-water mark for
  // the whole game, and a reader reviewing an earlier half is not asking what
  // the game came to; the band captions the half it's placed above. Clamped,
  // it freezes at the end of the half being read.
  //
  // Never the other direction: `Math.min` can only show LESS than the reveal
  // mark permits, so the spoiler footing is untouched (revealRunsThrough is
  // still reveal-only, still reached under the same started/live gate).
  //
  // `runsInProgress` — the half currently being stepped — is reset per half by
  // InningViewer, so it can only ever describe `viewIdx`. Past the clamp its
  // own `> throughIdx` test simply stops matching on a reviewed half, whose
  // runs revealRunsThrough already counted.
  const throughIdx = Math.min(revealedThrough, viewIdx ?? revealedThrough)
  const runsFor = (side, parity) =>
    revealRunsThrough(feed, unlocked, throughIdx, side) +
    (runsInProgress && runsInProgress.idx % 2 === parity && runsInProgress.idx > throughIdx
      ? runsInProgress.runs
      : 0)

  // The inning/half indicator freezes with the score. A half that ended points
  // its indicator at what comes NEXT (HalfInning's composeLive), which is right
  // where the reader is standing at the frontier — the 3rd out just landed and
  // the next half is where they are going. It is wrong on a half they paged
  // BACK to: bottom of the 1st captioned "top 2nd", beside a score frozen at
  // the end of the 1st. `viewIdx < revealedThrough` is exactly "there are
  // revealed halves after this one", i.e. the reader is reviewing rather than
  // scoring.
  const reviewing = viewIdx != null && viewIdx < revealedThrough
  const shownInning = reviewing && viewInning != null ? viewInning : live.inning
  const shownHalf = reviewing && viewHalf != null ? viewHalf : live.half

  return (
    <Scorebug
      awayName={meta.away.clubName}
      homeName={meta.home.clubName}
      awayTeamId={meta.away.id}
      homeTeamId={meta.home.id}
      awayTreatment={treatment?.away}
      homeTreatment={treatment?.home}
      awayRuns={runsFor('away', 0)}
      homeRuns={runsFor('home', 1)}
      inning={shownInning}
      half={shownHalf}
      batter={live.batter}
      pitcher={live.pitcher}
      bases={live.bases}
      outs={live.outs}
      className="gamehud--console"
    />
  )
}
