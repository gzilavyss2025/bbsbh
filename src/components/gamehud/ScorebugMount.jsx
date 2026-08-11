import { revealRunsThrough } from '../../api/linescore.js'
import { useMediaQuery, WIDE_QUERY } from '../../hooks/useMediaQuery.js'
import { Scorebug } from './Scorebug.jsx'

// WHERE the scorebug lives, which is a different answer inside focus mode than
// out of it (ADR-0043). Split out of InningViewer.jsx — which was at its
// 1000-line budget — so the two placements, and the runs arithmetic they share,
// sit in one file instead of being spelled out twice at the call site.
//
//  • FOCUSED (a half still being scored): an ANCHORED band at the top of the
//    stage — `.gamehud--console`. Focus mode deliberately has no long page to
//    scroll (see InningViewer's RollingLine gate), so the floating dock's whole
//    reason for existing — surviving a page that scrolls its real linescore out
//    of view — is gone, and all a fixed overlay can do on a short page is cover
//    the at-bat card. That collision is the "scorebug over the Now pitching
//    card" bug; anchoring is the structural fix, not a z-index one.
//  • UNFOCUSED (a revealed half, the full stacked page): the floating dock
//    exactly as before — corner-stepping included. That page really does scroll
//    past its linescore, so the dock still earns its keep there.
//
// THE CHOSEN CORNER IS THE CALLER'S STATE, not this component's, and it has to
// stay that way. This component cannot be mounted once and reused: focus mode
// renders it as a grid child inside `.consolebar`, the ordinary page renders it
// as a fixed dock at the end of `.innings`, and those are two different
// positions in the tree — so InningViewer swaps which one exists as the reader
// moves between a sealed half and a revealed one. Holding `cornerIdx` HERE
// meant every such swap unmounted the dock and threw the reader's chosen corner
// away: move the dock off something at the bottom-left, advance to the next
// (sealed) half, reveal it, and the dock was back at its default. So the VALUE
// and its setter arrive as props from InningViewer, which outlives both
// placements, while the stepping arithmetic — and the media query the default
// depends on — stay here where they belong. A component's own `useState` is
// the wrong home for a preference that has to survive the component.
//
// Spoiler footing is unchanged from the call site this replaces.
// `revealRunsThrough` is reveal-only (linescore.js, ADR-0001) and is still
// reached only under the same `started && live` gate it always was — the early
// return below IS that gate, just moved one component down.
const CORNERS = ['top-right', 'bottom-right', 'bottom-left', 'top-left']

// The layout-driven default, held until the reader's first tap so the dock
// doesn't jump on mount: top-right on mobile, bottom-right on desktop.
// CORNERS[1] being the desktop default is why a first tap there lands on 2.
const defaultCornerIdx = (isWide) => (isWide ? 1 : 0)

export function ScorebugMount({
  started,
  live,
  feed,
  unlocked,
  revealedThrough,
  runsInProgress,
  meta,
  treatment,
  focused,
  pastLine,
  cornerIdx,
  setCornerIdx,
  viewIdx,
  viewInning,
  viewHalf,
}) {
  const isWide = useMediaQuery(WIDE_QUERY)
  if (!started || !live) return null

  // THE HALF ON SCREEN CAPS THE SCORE, not the reader's game-wide reveal mark.
  // The bug this fixes: page back to the bottom of the 1st in a game revealed
  // all the way through and the dock read 5-6 — the FINAL score, on a page
  // whose own linescore said 1-0. `revealedThrough` is a high-water mark for
  // the whole game, and a reader reviewing an earlier half is not asking what
  // the game came to; the dock captions the page it floats over. Clamped, it
  // freezes at the end of the half being read.
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

  const bug = (
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
      className={focused ? 'gamehud--console' : ''}
    />
  )

  // Anchored: a plain grid child, no dock wrapper, no corner affordance — it
  // sits where it sits, which is the point.
  if (focused) return bug

  const corner = CORNERS[cornerIdx ?? defaultCornerIdx(isWide)]
  const stepCorner = () =>
    setCornerIdx?.((prev) => ((prev ?? defaultCornerIdx(isWide)) + 1) % CORNERS.length)
  return (
    <div
      className={`gamehud-dock gamehud-dock--${corner} ${pastLine ? 'gamehud-dock--show' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Move scorebug to next corner"
      onClick={stepCorner}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          stepCorner()
        }
      }}
    >
      {bug}
    </div>
  )
}
