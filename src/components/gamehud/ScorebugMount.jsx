import { useState } from 'react'
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
// The corner the dock parks in is state, so this component is mounted
// unconditionally and returns null itself rather than being conditionally
// rendered by the caller: `live` goes null on every half change (see
// InningViewer's forIdx-tagged `liveState`), and a caller-side guard would
// unmount this on each navigation and reset the reader's chosen corner with it.
//
// Spoiler footing is unchanged from the call site this replaces.
// `revealRunsThrough` is reveal-only (linescore.js, ADR-0001) and is still
// reached only under the same `started && live` gate it always was — the early
// return below IS that gate, just moved one component down.
const CORNERS = ['top-right', 'bottom-right', 'bottom-left', 'top-left']

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
}) {
  const isWide = useMediaQuery(WIDE_QUERY)
  // Null until the reader's first tap so the dock keeps its layout-driven
  // default (top-right on mobile, bottom-right on desktop) rather than jumping
  // on mount; CORNERS[1] is that desktop default, so a first tap there advances
  // to index 2 as expected.
  const [cornerIdx, setCornerIdx] = useState(null)
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

  const corner = CORNERS[cornerIdx ?? (isWide ? 1 : 0)]
  const stepCorner = () => setCornerIdx((prev) => ((prev ?? (isWide ? 1 : 0)) + 1) % CORNERS.length)
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
