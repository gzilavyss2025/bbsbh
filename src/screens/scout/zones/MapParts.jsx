import { MIN_COMMAND_PITCHES } from '../../../api/commandMap.js'
import { METRICS, fmtValue } from '../../../lib/scout/metrics.js'
import { regionLabel, sidesInOrder } from '../../../lib/zone/regions.js'
import { Stack } from '../../../components/ui/layout/Stack.jsx'

// THE PARTS AROUND THE SCOUT'S MAP: the side labels under it, the
// answer line above them, the readout for a tapped region, and the key. The
// same parts as the Design Lab prototype (screens/designlab/scout/).

const pct = (x) => `${Math.round(x * 100)}`

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

// THE ANSWER STRIP (V15): the expected value on the selected pitch (or the usage-weighed
// line for All), read against the league's. Here it stays a figure; the Edge
// section's verdict writes the same figure out as a sentence (#1490, Gary's
// mockup review; docs/scout-design.md E). `sub` is the line under the title;
// `leftOut` names the pilled types whose pitcher map is too thin to weigh.
export function Answer({ metric, sub, value, league, leftOut }) {
  return (
    <div className="scout__answer">
      <span className="scout__answertext">
        <span className="scout__controllabel">Expected {METRICS[metric].label}</span>
        <span className="scout__answersub">{sub}</span>
        {leftOut?.length > 0 && value != null && (
          <span className="scout__answersub">Leaves out {leftOut.map((t) => `${t.name} (${t.n})`).join(', ')}: too few for a map</span>
        )}
      </span>
      <span className="scout__answernum">
        <span key={value} className="scout__answervalue">{fmtValue(metric, value)}</span>
        {value != null && league != null && <span className="scout__answersub">league {fmtValue(metric, league)}</span>}
      </span>
    </div>
  )
}

// A tapped region's exact figures, from both maps (`hit` is the hitter's
// regions, absent in Phase 1), in a box under the map: "Pivetta 6% · 15 of 263
// pitches", "Chourio .604 · 31 PA-ending pitches". It keeps its height when
// nothing is picked, so a tap never moves the maps. `stance` is null when the
// two maps stand on different sides (a switch hitter against the other hand):
// then the label names the field side only (Gary, item 11).
export function Readout({ picked, map, hit, metric, stance, names }) {
  if (!picked) return <p className="scout__readout"><span className="scout__cap">Tap a region for its numbers</span></p>
  const h = hit?.[picked]
  const under = h && h.value == null
  const unit = METRICS[metric]?.unit
  return (
    <p className="scout__readout" aria-live="polite">
      <span className="scout__readoutlabel">{regionLabel(picked, stance)}</span>
      <span className="scout__readoutfact">
        <b className="scout__who scout__who--pitcher">{names.pitcher}</b> {map.thin ? '—' : `${pct(map.share[picked])}%`} · {map.regionN[picked].toLocaleString()} of {map.n.toLocaleString()} pitches
      </span>
      {h && (
        <span className="scout__readoutfact">
          <b className="scout__who scout__who--hitter">{names.hitter}</b> {under ? '—' : fmtValue(metric, h.value)} · {under ? `${h.n} of ${METRICS[metric].floor} ${unit}` : `${h.n.toLocaleString()} ${unit}`}
        </span>
      )}
    </p>
  )
}

// The hot and cold tiles (V09): the share of the pitcher's mix that goes into the
// hitter's hottest spots and into his coldest, and which regions those are.
// `spots` is callout.js `spotShares`. Null shows nothing.
const TILES = [['hot', 'Into his hot spots'], ['cold', 'Into his cold spots']]
export function SpotTiles({ spots, className }) {
  if (!spots || !(spots.hot || spots.cold)) return null
  return (
    <div className={`scout__spots ${className}`}>
      {TILES.filter(([k]) => spots[k]).map(([k, title]) => (
        <div key={k} className={`scout__spot scout__spot--${k}`}>
          <span className="scout__spottitle">{title}</span>
          <span className="scout__spotvalue">{pct(spots[k].share)}%</span>
          <span className="scout__spotnames">{spots[k].names.join('; ')}{spots[k].range[0] != null && `: ${spots[k].range.join(' to ')}`}</span>
        </div>
      ))}
    </div>
  )
}

// The key: the pitcher's ramp, the hitter's diverging scale against the
// league as one bar (when his map is on), and the hatch for a map or region
// under its floor. The bar's ends name the side that tone favors: below the
// league is the pitcher's on xwOBA (est.), the hitter's on Whiff % (scout.css
// flips the tones); Swing % favors neither.
const ENDS = { xwoba: ['pitcher', 'hitter'], whiff: ['hitter', 'pitcher'] }
export function Key({ metric, mode, names }) {
  const m = metric ? METRICS[metric] : null
  const [lo, hi] = ENDS[metric]?.map((k) => `${names[k]}’s side`) ?? ['Below league', 'Above league']
  return (
    <Stack gap="tight" className={`scout__key ${mode === 'locations' ? '' : `scout__map--${metric}`}`.trim()} aria-label="Colour scale">
      {mode === 'both' ? (
        <p className="scout__keyrow">
          <svg className="scout__swatch" aria-hidden="true"><rect className="scout__share" x="4" y="4" width="6" height="6" /></svg>
          <span className="scout__keylabel">Square: how often he throws there</span>
        </p>
      ) : mode !== 'results' && (
        <p className="scout__keyrow">
          <span className="scout__keylabel">Location share: less</span>
          {[1, 2, 3, 4].map((k) => <Swatch key={k} tone={`s${k}`} />)}
          <span className="scout__keylabel">more</span>
        </p>
      )}
      {m && mode !== 'locations' && (
        <div className="scout__keyscale">
          <svg className="scout__keybar" viewBox="0 0 5 1" preserveAspectRatio="none" aria-hidden="true">
            {['lo2', 'lo1', 'mid', 'hi1', 'hi2'].map((k, i) => <rect key={k} className={`scout__region scout__region--${k}`} x={i} width="1" height="1" />)}
          </svg>
          <span className="scout__keyends"><span>◀ {lo}</span><span>league</span><span>{hi} ▶</span></span>
        </div>
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
