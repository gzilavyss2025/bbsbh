import { METRICS } from '../../../lib/scout/metrics.js'
import { arsenalFor } from '../../../api/matchup/savant.js'
import { EmptyState } from '../../../components/ui/state/EmptyState.jsx'
import { HitterLine } from '../HitterLine.jsx'
import { Rich } from '../Rich.jsx'
import { verdict } from './edge.js'

// THE EDGE TAB (#1490): who the matchup favors, by pitch type, then by
// location. The verdict writes the page's figures out in words (edge.js);
// the ledger draws the same rates, one row per pill, on one scale per metric.
// A row is a pitch pill too: a tap selects that pitch, a second tap clears it.
//
// With no hitter grid (the Phase 1 state) there is no league comparison to
// make, so the panel prints the hitter's Savant line per pitch type instead,
// labelled regular season (HitterLine.jsx). It never invents one.
const SCOPE_WORDS = { reg: 'regular season', post: 'postseason', all: 'regular season + postseason' }
const HAND_WORDS = { R: 'right-handed pitchers', L: 'left-handed pitchers' }


export function EdgePanel({ data, board, sides, metric, sel, stance, scope, hand }) {
  const names = { hitter: data.hitter.last, pitcher: data.pitcher.last }
  if (!board) {
    return (
      <section className="scout__panel" aria-label="Edge">
        <EmptyState size="compact">Not posted</EmptyState>
      </section>
    )
  }
  const v = verdict({ board, sides, names, stance })
  const side = sides[metric]
  if (!v || !side) {
    return (
      <section className="scout__panel" aria-label="Edge">
        <p className="scout__kicker">{data.hitter.name} by pitch type · Savant · Regular season</p>
        <HitterLine line={arsenalFor(data.savant, data.hitter.id, 'batting')} types={board.types} code={sel} />
      </section>
    )
  }
  return (
    <section className="scout__panel" aria-label="Edge">
      <div className="scout__verdict">
        <p className="scout__kicker">By pitch type · {METRICS[v.metric].label}</p>
        <p className="scout__lean">
          {v.lean ? <>Lean <span className={`scout__leanname scout__leanname--${v.lean}`}>{v.leanName}</span></> : 'Close to even'}
        </p>
        {v.typeLines.map((parts, i) => <p key={i} className="scout__verdictline"><Rich parts={parts} /></p>)}
        {v.locationLines.length > 0 && (
          <>
            <hr className="scout__verdictrule" />
            <p className="scout__kicker">By location · the page’s expected value</p>
            <p className="scout__verdictline">
              {v.locationLines.map((parts, i) => <span key={i}>{i > 0 && ' '}<Rich parts={parts} /></span>)}
            </p>
          </>
        )}
      </div>

      <p className="scout__note">
        Whole-pitch rates, {data.season ?? ''} {SCOPE_WORDS[scope]}, {HAND_WORDS[hand] ?? 'both pitcher hands'}.
      </p>
    </section>
  )
}
