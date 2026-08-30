import { useNav } from '../../lib/nav.js'
import { runValuePath } from '../../lib/route.js'
import { useAsync } from '../../hooks/useAsync.js'
import {
  COMPONENTS,
  fetchRunValue,
  playerRunValue,
  signed,
} from '../../api/around-the-game/runValue.js'
import { RunValueSplit, splitScale } from '../around-the-game/RunValueParts.jsx'

// The player page's RUN VALUE card — his season split into the four things a
// player can do to move a run, on the one scale that lets them be added.
//
// WHY IT SITS ON THE ANALYTICS SHELF. The card above it (StatcastPercentiles)
// says how good his tools are against the league; this says what those tools
// were WORTH, in runs, and it is the only card on the page that can put a
// centre fielder's glove and a starter's arm in the same sentence. It reads the
// same kind of nightly Baseball Savant file the percentile strip does, so it
// belongs beside it rather than among the counting stats.
//
// SELF-FETCHING, like FoulCard and MilestoneWatchCard beside it. The file is
// read through staticJson, so the report page, the club card and this one share
// a single request per session however many of them a reader opens.
//
// NO `asOf` GATE, unlike FoulCard. That card hides on a spoiler-scoped page
// because its figures run to the current day; this file is last night's sweep
// and carries nothing from today's games at all, which is the same footing
// StatcastPercentiles has always had on this shelf (ADR-0034 — a stat line is
// not a score).
//
// Renders nothing when he is not in the file: a minor-leaguer, a September
// debut since the sweep, or a man who has not yet moved a run.
export function RunValueCard({ playerId }) {
  const navigate = useNav()
  const { data } = useAsync(() => fetchRunValue(), [])
  const view = playerRunValue(data, playerId)
  if (!view) return null

  return (
    <div className="rvcard">
      <h3 className="section__title">
        <span>Run value</span>
        <em>runs above average</em>
      </h3>

      <div className="rvcard__head">
        <p className="rvcard__total">{signed(view.total)}</p>
        {view.rank ? (
          <p className="rvcard__rank">
            {view.tied ? 'Tied ' : ''}
            {ordinal(view.rank)} of {view.of} {view.roleInProse}
          </p>
        ) : null}
      </div>

      {/* The scale is his own widest side, since this card draws one player and
          has no neighbours to share a ruler with — the club card and the board
          are the surfaces that pass a shared one. */}
      <RunValueSplit entry={view} scale={splitScale([view])} />

      <p className="rvcard__note">
        {leadWith(view)} Every event is scored against the runs an average team
        would go on to score from that base, out and count — so nothing here
        depends on the score of the game it happened in.
      </p>

      <button type="button" className="plink rvcard__more" onClick={() => navigate(runValuePath())}>
        League run value board ›
      </button>
    </div>
  )
}

// The one sentence a reader gets before the legend: which of the four carried
// his season. Written from the components rather than from a position, for the
// reason the role split is (runValue.js's ROLES) — a two-way player and a
// shortstop who cannot field are both described correctly by what they did.
function leadWith(view) {
  const best = COMPONENTS.map((c) => ({ ...c, v: view[c.key] ?? 0 })).sort((a, b) => b.v - a.v)[0]
  if (!best || best.v < 1) return 'A season within a run of average overall.'
  return `Most of it is ${best.inProse}: ${best.about}`
}

function ordinal(n) {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}
