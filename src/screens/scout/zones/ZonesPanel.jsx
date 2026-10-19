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
import { leftOut } from '../edge/edge.js'
import { Answer, Key, Readout, Sides, SpotTiles } from './MapParts.jsx'

// THE WHERE SECTION (#1490, ADR-0118): one 13-region map, with a Show control
// (Both draws the hitter's result as the fill and the pitcher's share as an
// ink square; Locations and Results draw each original map alone) and the
// Metric control, then the expected value; the readout and the key sit under
// the map in its panel. Every share and rate prints its "%", and on All + xwOBA
// (est.) two tiles under the panel say how much of the mix goes into the
// hitter's hot spots and cold spots (`spots`; on a desktop the page shows them
// beside the scene instead).
//
// The map draws the hitter's view only.
const lower = (s) => s.toLowerCase() // caps-js-exempt: a pitch name inside a caption
const SHOWS = [['both', 'Both'], ['locations', 'Locations'], ['results', 'Results']]

export function ZonesPanel({ data, board, side, spots, map, hmap, sel, selType, view, stance, hitterStance, metric, metrics, onMetric, onPitch, picked, onPick }) {
  const [show, setShow] = useState('both')
  // With no hitter map there is only the pitcher's to draw.
  const mode = hmap ? show : 'locations'
  // Locations: the share, and the pitch count under it.
  const shown = mode === 'locations' && map
    ? { ...map, cells: Object.fromEntries(Object.entries(map.cells).map(([r, c]) => [r, { ...c, count: map.regionN[r] }])) }
    : mode === 'locations' ? null : hmap
  const crowd = stance === 'L' ? 'lefties' : 'righties'
  const names = { hitter: data.hitter.last, pitcher: data.pitcher.last }
  const typeName = selType ? selType.name : 'All pitches'
  return (
    <section className="scout__panel" aria-label="Zones">
      {board && (
        <div className="scout__chipstrip" role="group" aria-label="Pitch">
          <Pill role="control" fill="paper" pressed={sel === null} onClick={() => onPitch(null)}>All</Pill>
          {board.types.map((t) => (
            <Pill key={t.code} data-code={t.code} role="control" fill="paper" pressed={sel === t.code} onClick={() => onPitch(t.code)}>
              <PitchMark mark={pitchMark(t.code)} size={12} /> {t.name}
            </Pill>
          ))}
        </div>
      )}
      {side && (
        <Answer
          metric={metric}
          sub={sel
            ? `${typeName}${selType.mph ? ` · ${selType.mph} mph` : ''} · on his spots`
            : `${typeName}${side.overall.covered != null ? ` · ${Math.round(side.overall.covered * 100)}% of pitches mapped` : ''}`}
          value={sel ? hmap?.exp : side.overall.value}
          league={sel ? hmap?.league : side.overall.league}
          leftOut={sel ? null : leftOut(board)}
        />
      )}

      <div className="scout__controls">
        {hmap && <Choice label="Show" options={SHOWS} value={show} onChange={setShow} />}
        {side && <Choice label="Metric" options={metrics.map((k) => [k, METRICS[k].label])} value={metric} onChange={onMetric} />}
      </div>

      <figure className="scout__fig scout__mappanel">
        <figcaption className="scout__figcap">
          <span>
            {mode === 'locations'
              ? `Where ${names.pitcher} throws${selType ? ` the ${lower(selType.name)}` : ''}`
              : `${mode === 'both' ? 'Both' : names.hitter} · ${METRICS[metric].label}`}
          </span>
          {shown && (
            <span className="scout__figcount">
              {mode === 'locations' && map.thin ? `Under ${MIN_COMMAND_PITCHES} pitches · ` : ''}
              {selType ? selType.name : 'All'} · {(mode === 'results' || !map ? hmap.seen : map.n).toLocaleString()} pitches
              {mode === 'locations' && selType ? ` · ${selType.mph} mph` : ''}
            </span>
          )}
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
              className={mode === 'locations' ? 'scout__map--loc' : `scout__map--${metric}`}
              homeSet={data.homeSet}
              picked={picked}
              onSelect={onPick}
              label={`${typeName}: ${mode === 'locations' ? 'location share' : `hitter’s ${METRICS[metric].label}`} by region, ${view} view`}
            />
            <Sides view={view} />
          </>
        ) : (
          <EmptyState size="compact">Not posted</EmptyState>
        )}
        {map && (
          <Readout
            picked={picked}
            map={map}
            hit={hmap?.hit}
            metric={metric}
            stance={!side || stance === hitterStance ? stance : null}
            names={names}
          />
        )}
        <Key metric={side ? metric : null} mode={mode} names={names} />
      </figure>
      <SpotTiles spots={spots} className="scout__spots--narrow" />
      {!side && !data.grid && board && (
        // No hitter map to join: his Savant line per pitch type instead.
        <figure className="scout__fig">
          <figcaption className="scout__figcap">{names.hitter} · {selType ? selType.name : 'by pitch'}</figcaption>
          <HitterLine line={arsenalFor(data.savant, data.hitter.id, 'batting')} types={board.types} code={sel} />
        </figure>
      )}
    </section>
  )
}
