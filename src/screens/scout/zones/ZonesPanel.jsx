import { useState } from 'react'
import { MIN_COMMAND_PITCHES } from '../../../api/commandMap.js'
import { arsenalFor } from '../../../api/matchup/savant.js'
import { METRICS } from '../../../lib/scout/metrics.js'
import { EmptyState } from '../../../components/ui/state/EmptyState.jsx'
import { pitchMark } from '../../../lib/pitch/pitchTypes.js'
import { PitchMark } from '../../../components/playbyplay/pitcherCard/PitchMark.jsx'
import { Pill } from '../../../components/ui/control/Pill.jsx'
import { Choice } from '../../../components/scout/Choice.jsx'
import { ScoutMap } from '../../../components/scout/ScoutMap.jsx'
import { HitterLine } from '../HitterLine.jsx'
import { Rich } from '../Rich.jsx'
import { leftOut } from '../edge/edge.js'
import { Answer, Key, Readout, Sides } from './MapParts.jsx'
import { zoneCallout } from './callout.js'

// THE WHERE SECTION (#1490, ADR-0118): one 13-region map, with a Show control
// (Both draws the hitter's result as the fill and the pitcher's share as an
// ink square; Locations and Results draw each original map alone) and the
// Metric control, then the expected value, the tap readout, the callout and
// the key. Every share and rate prints its "%", and on All + xwOBA (est.) a
// callout under the readout says what the two maps add up to.
//
// The map draws the hitter's view only.
const lower = (s) => s.toLowerCase() // caps-js-exempt: a pitch name inside a caption
const SHOWS = [['both', 'Both'], ['locations', 'Locations'], ['results', 'Results']]

export function ZonesPanel({ data, board, side, xside, map, hmap, sel, selType, view, stance, hitterStance, metric, metrics, onMetric, onPitch, picked, onPick }) {
  const [show, setShow] = useState('both')
  // With no hitter map there is only the pitcher's to draw.
  const mode = hmap ? show : 'locations'
  const shown = mode === 'locations' ? map : hmap
  const crowd = stance === 'L' ? 'lefties' : 'righties'
  const names = { hitter: data.hitter.last, pitcher: data.pitcher.last }
  const typeName = selType ? selType.name : 'All pitches'
  const callout = !sel && metric === 'xwoba' ? zoneCallout({ board, side: xside, stance, hitterStance, names }) : null
  const pick = (r) => onPick((p) => (p === r ? null : r))
  return (
    <section className="scout__panel" aria-label="Zones">
      {board && (
        <div className="scout__chipstrip" role="group" aria-label="Pitch">
          <Pill role="control" fill="paper" pressed={sel === null} onClick={() => onPitch(null)}>All</Pill>
          {board.types.map((t) => (
            <Pill key={t.code} role="control" fill="paper" pressed={sel === t.code} onClick={() => onPitch(t.code)}>
              <PitchMark mark={pitchMark(t.code)} size={12} /> {t.name}
            </Pill>
          ))}
        </div>
      )}
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

      <div className="scout__controls">
        {hmap && <Choice label="Show" options={SHOWS} value={show} onChange={setShow} />}
        {side && <Choice label="Metric" options={metrics.map((k) => [k, METRICS[k].label])} value={metric} onChange={onMetric} />}
      </div>

      <figure className="scout__fig">
        <figcaption className="scout__figcap">
          {mode === 'locations'
            ? `Where ${names.pitcher} throws ${selType ? `the ${lower(selType.name)} ` : ''}to ${crowd} · % of pitches`
            : `${mode === 'both' ? 'Both' : names.hitter} · ${METRICS[metric].label}`}
        </figcaption>
        {mode === 'both' && map?.thin && (
          <p className="scout__note">{typeName}: {map.n.toLocaleString()} pitches to {crowd}, under the {MIN_COMMAND_PITCHES}-pitch floor.</p>
        )}
        {shown ? (
          <>
            <ScoutMap
              view={view}
              stance={mode === 'locations' ? stance : hitterStance}
              cells={shown.cells}
              unit={mode === 'locations' || metric !== 'xwoba' ? '%' : ''}
              shares={mode === 'both' && map && !map.thin && stance === hitterStance ? map.share : undefined}
              className={mode === 'locations' ? '' : `scout__map--${metric}`}
              picked={picked}
              onSelect={pick}
              label={`${typeName}: ${mode === 'locations' ? 'location share' : `hitter’s ${METRICS[metric].label}`} by region, ${view} view`}
            />
            <Sides view={view} />
            <span className="scout__cap">
              {mode === 'locations'
                ? `${map.thin ? `Under ${MIN_COMMAND_PITCHES} pitches · ` : ''}${map.n.toLocaleString()} pitches${selType ? ` · ${selType.mph} mph` : ''}`
                : `${hmap.seen.toLocaleString()} pitches seen`}
            </span>
          </>
        ) : (
          <EmptyState size="compact">Not posted</EmptyState>
        )}
      </figure>
      {!side && !data.grid && board && (
        // No hitter map to join: his Savant line per pitch type instead.
        <figure className="scout__fig">
          <figcaption className="scout__figcap">{names.hitter} · {selType ? selType.name : 'by pitch'}</figcaption>
          <HitterLine line={arsenalFor(data.savant, data.hitter.id, 'batting')} types={board.types} code={sel} />
        </figure>
      )}

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
      <Key metric={side ? metric : null} mode={mode} />
    </section>
  )
}
