import { MIN_COMMAND_PITCHES } from '../../../api/commandMap.js'
import { arsenalFor } from '../../../api/matchup/savant.js'
import { METRICS } from '../../../lib/scout/metrics.js'
import { EmptyState } from '../../../components/ui/state/EmptyState.jsx'
import { ScoutMap } from '../../../components/scout/ScoutMap.jsx'
import { HitterLine } from '../HitterLine.jsx'
import { Rich } from '../Rich.jsx'
import { leftOut } from '../edge/edge.js'
import { Answer, Key, Readout, Sides } from './MapParts.jsx'
import { zoneCallout } from './callout.js'

// THE ZONES TAB (#1490): the two 13-region maps (where the pitcher throws,
// where the hitter does damage), the expected value that joins them, the tap
// readout and the key. The same maps as before the tabs; the captions now
// say whose map is whose, every share and rate prints its "%", and on All +
// xwOBA (est.) a callout under the readout says what the two maps add up to.
//
// The maps mirror with the View (ADR-0093 decision 2), which now sits on the
// scene's bar; `turns` keys the turn-over motion on a View tap (scout.css).
const lower = (s) => s.toLowerCase() // caps-js-exempt: a pitch name inside a caption


export function ZonesPanel({ data, board, side, xside, map, hmap, sel, selType, view, stance, hitterStance, metric, picked, onPick, turns }) {
  const crowd = stance === 'L' ? 'lefties' : 'righties'
  const names = { hitter: data.hitter.last, pitcher: data.pitcher.last }
  const typeName = selType ? selType.name : 'All pitches'
  const callout = !sel && metric === 'xwoba' ? zoneCallout({ board, side: xside, stance, names }) : null
  const pick = (r) => onPick((p) => (p === r ? null : r))
  return (
    <section className="scout__panel" aria-label="Zones">
      {side && (
        <Answer
          metric={metric}
          typeName={typeName}
          mph={selType?.mph}
          value={sel ? hmap?.exp : side.overall.value}
          league={sel ? hmap?.league : side.overall.league}
          leftOut={sel ? null : leftOut(board)}
        />
      )}

      <div key={turns} className={`scout__maps${turns ? ' is-turning' : ''}`}>
        <figure className="scout__fig">
          <figcaption className="scout__figcap">
            Where {names.pitcher} throws {selType ? `the ${lower(selType.name)} ` : ''}to {crowd} · % of pitches
          </figcaption>
          {map ? (
            <>
              <ScoutMap
                view={view}
                stance={stance}
                cells={map.cells}
                unit="%"
                picked={picked}
                onSelect={pick}
                label={`${typeName}: location share by region, ${view} view`}
              />
              <Sides view={view} />
              <span className="scout__cap">
                {map.thin ? `Under ${MIN_COMMAND_PITCHES} pitches · ` : ''}
                {map.n.toLocaleString()} pitches{selType ? ` · ${selType.mph} mph` : ''}
              </span>
            </>
          ) : (
            <EmptyState size="compact">Not posted</EmptyState>
          )}
        </figure>
        {side ? (
          <figure className="scout__fig">
            <figcaption className="scout__figcap">Where {names.hitter} does damage · {METRICS[metric].label}</figcaption>
            {hmap ? (
              <>
                <ScoutMap
                  view={view}
                  stance={hitterStance}
                  cells={hmap.cells}
                  unit={metric === 'xwoba' ? '' : '%'}
                  picked={picked}
                  onSelect={pick}
                  label={`${typeName}: hitter’s ${METRICS[metric].label} by region, ${view} view`}
                />
                <Sides view={view} />
                <span className="scout__cap">{hmap.seen.toLocaleString()} pitches seen</span>
              </>
            ) : (
              <EmptyState size="compact">Not posted</EmptyState>
            )}
          </figure>
        ) : data.grid || !board ? (
          // His map joins the pitcher's pitch types: with no pitcher board for
          // this scope, it has none to show.
          <figure className="scout__fig">
            <figcaption className="scout__figcap">Where {names.hitter} does damage</figcaption>
            <EmptyState size="compact">Not posted</EmptyState>
          </figure>
        ) : (
          <figure className="scout__fig">
            <figcaption className="scout__figcap">{names.hitter} · {selType ? selType.name : 'by pitch'}</figcaption>
            <HitterLine line={arsenalFor(data.savant, data.hitter.id, 'batting')} types={board.types} code={sel} />
          </figure>
        )}
      </div>

      {map && (
        <Readout
          picked={picked}
          map={map}
          hit={hmap?.hit}
          metric={metric}
          stance={!side || stance === hitterStance ? stance : null}
        />
      )}
      {callout && <p className="scout__callout"><Rich parts={callout} /></p>}
      <Key metric={side ? metric : null} />
    </section>
  )
}
