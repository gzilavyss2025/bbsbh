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
}) {
  const isWide = useMediaQuery(WIDE_QUERY)
  if (!started || !live) return null

  // Runs AS OF the reader's own reveal progress: committed halves via
  // revealRunsThrough, plus the currently-stepped half's own running count.
  // The same figure RollingLine's totals column shows.
  const runsFor = (side, parity) =>
    revealRunsThrough(feed, unlocked, revealedThrough, side) +
    (runsInProgress && runsInProgress.idx % 2 === parity && runsInProgress.idx > revealedThrough
      ? runsInProgress.runs
      : 0)

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
      inning={live.inning}
      half={live.half}
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
