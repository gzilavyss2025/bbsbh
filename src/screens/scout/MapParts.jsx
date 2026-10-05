import { MIN_COMMAND_PITCHES } from '../../api/commandMap.js'
import { METRICS, band, fmtMetric } from '../../lib/scout/metrics.js'
import { regionLabel, sidesInOrder } from '../../lib/zone/regions.js'
import { Stack } from '../../components/ui/layout/Stack.jsx'

// THE PARTS AROUND THE SCOUT'S TWO MAPS: the side labels under each, the
// answer line above them, the readout for a tapped region, and the key. The
// same parts as the Design Lab prototype (screens/designlab/scout/).

const pct = (x) => `${Math.round(x * 100)}`
const toneOf = (b) => (b == null ? null : b < 0 ? `lo${-b}` : b > 0 ? `hi${b}` : 'mid')

export function Swatch({ tone }) {
  return (
    <svg className="scout__swatch" aria-hidden="true">
      <rect className={`scout__region scout__region--${tone}`} width="14" height="14" />
    </svg>
  )
}

// The map's two sides of the field, the one on the viewer's left first.
// Never "left" or "right" (ADR-0077).
export function Sides({ view }) {
  const [a, b] = sidesInOrder(view)
  return (
    <span className="scout__sides" aria-hidden="true"><span>{a}</span><span>{b}</span></span>
  )
}

// THE ANSWER: the expected value on the selected pitch (or the usage-weighed
// line for All), read against the league's. A figure, never a sentence.
export function Answer({ metric, typeName, mph, value, league, covered }) {
  return (
    <div className="scout__answer">
      <span className="scout__controllabel">
        Expected {METRICS[metric].label} · {typeName}{mph ? ` · ${mph} mph` : ''}
      </span>
      <span key={value} className="scout__answervalue">{fmtMetric(metric, value)}</span>
      {value != null && league != null && (
        <span className="scout__answerleague">
          <Swatch tone={toneOf(band(metric, value, league))} />
          <span className="scout__cap">League {fmtMetric(metric, league)}</span>
        </span>
      )}
      {covered != null && value != null && <span className="scout__cap">{pct(covered)}% of pitches</span>}
    </div>
  )
}

// A tapped region's exact figures, from both maps (`hit` is the hitter's
// regions, absent in Phase 1). It keeps its height when nothing is picked, so
// a tap never moves the maps. `stance` is null when the two maps stand on
// different sides (a switch hitter against the other hand): then the label
// names the field side only (Gary, item 11).
export function Readout({ picked, map, hit, metric, stance }) {
  if (!picked) return <p className="scout__readout"><span className="scout__cap">Tap a region for its numbers</span></p>
  const h = hit?.[picked]
  const under = h && h.value == null
  const unit = METRICS[metric]?.unit
  return (
    <p className="scout__readout" aria-live="polite">
      <span className="scout__readoutlabel">{regionLabel(picked, stance)}</span>
      <span className="scout__readoutfact">
        <span className="scout__cap">Pitcher</span>
        <span className="scout__readoutvalue">{map.thin ? '—' : `${pct(map.share[picked])}%`}</span>
        <span className="scout__cap">{map.regionN[picked].toLocaleString()} of {map.n.toLocaleString()} pitches</span>
      </span>
      {h && (
        <span className="scout__readoutfact">
          <span className="scout__cap">Hitter</span>
          <span className="scout__readoutvalue">{under ? '—' : fmtMetric(metric, h.value)}</span>
          <span className="scout__cap">{under ? `${h.n} of ${METRICS[metric].floor} ${unit}` : `${h.n.toLocaleString()} ${unit}`}</span>
        </span>
      )}
    </p>
  )
}

// The key: the pitcher's ramp, the hitter's diverging scale against the
// league (when his map is on), and the hatch for a map or region under its
// floor.
export function Key({ metric }) {
  const m = metric ? METRICS[metric] : null
  return (
    <Stack gap="tight" className="scout__key" aria-label="Colour scale">
      <p className="scout__keyrow">
        <span className="scout__keylabel">Location share: less</span>
        {[1, 2, 3, 4].map((k) => <Swatch key={k} tone={`s${k}`} />)}
        <span className="scout__keylabel">more</span>
      </p>
      {m && (
        <p className="scout__keyrow">
          <span className="scout__keylabel">{m.label} vs league: below</span>
          {['lo2', 'lo1', 'mid', 'hi1', 'hi2'].map((k) => <Swatch key={k} tone={k} />)}
          <span className="scout__keylabel">above</span>
        </p>
      )}
      <p className="scout__keyrow">
        <span className="scout__swatch scout__swatch--hatch" />
        <span className="scout__keylabel">
          Under {MIN_COMMAND_PITCHES} pitches{m ? `, or ${m.floor} ${m.unit}` : ''}: count only
        </span>
      </p>
    </Stack>
  )
}
