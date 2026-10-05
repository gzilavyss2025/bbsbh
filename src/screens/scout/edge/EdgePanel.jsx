import { METRICS } from '../../../lib/scout/metrics.js'
import { arsenalFor } from '../../../api/matchup/savant.js'
import { Choice } from '../../../components/scout/Choice.jsx'
import { EmptyState } from '../../../components/ui/state/EmptyState.jsx'
import { HitterLine } from '../HitterLine.jsx'
import { Rich } from '../Rich.jsx'
import { ledgerRows, ledgerScale, rowTag, verdict, versus } from './edge.js'

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


export function EdgePanel({ data, board, sides, metric, metrics, onMetric, sel, onSelect, stance, scope, hand }) {
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
  const rows = ledgerRows(board.types, side, metric)
  const scale = ledgerScale(rows)
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

      <div className="scout__ledgerhead">
        <span className="scout__ledgertitle">{names.hitter} vs league, {METRICS[metric].label}</span>
        <span className="scout__ledgerkey" aria-hidden="true">
          <span className="scout__keytick" />league
          <span className="scout__keydot" />{names.hitter}
          <span className="scout__keyusage" />usage
        </span>
      </div>
      <div className="scout__ledger" role="group" aria-label={`${METRICS[metric].label} by pitch`}>
        {rows.map((r) => {
          const tag = rowTag(r, names)
          const has = r.value != null && r.league != null && scale
          const a = has ? scale.at(r.value) : 0
          const b = has ? scale.at(r.league) : 0
          return (
            <button
              key={r.code}
              type="button"
              className="scout__lrow"
              data-family={r.family}
              data-tone={tag.tone}
              aria-pressed={sel === r.code}
              aria-label={`${r.name}: ${tag.word}, ${versus(metric, r)}`}
              onClick={() => onSelect(sel === r.code ? null : r.code)}
            >
              <span className="scout__lname">
                <span className="scout__lpitch">{r.name}</span>
                <span className="scout__lsub">{r.pct}% · {r.mph} mph</span>
              </span>
              <span className="scout__lplot" aria-hidden="true">
                <span className="scout__laxis" />
                {has && (
                  <>
                    <span className="scout__lgap" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%` }} />
                    <span className="scout__ltick" style={{ left: `${b}%` }} />
                    <span className="scout__ldot" style={{ left: `${a}%` }} />
                  </>
                )}
                <span className="scout__lusage" style={{ width: `${r.pct}%` }} />
              </span>
              <span className="scout__ltag">
                <span className="scout__lword">{tag.word}</span>
                <span className="scout__lvs">{versus(metric, r)}</span>
              </span>
            </button>
          )
        })}
      </div>
      <Choice
        label="Metric"
        options={metrics.map((k) => [k, METRICS[k].label])}
        value={metric}
        onChange={onMetric}
      />
      <p className="scout__note">
        Whole-pitch rates, {data.season ?? ''} {SCOPE_WORDS[scope]}, {HAND_WORDS[hand] ?? 'both pitcher hands'}.
      </p>
    </section>
  )
}
