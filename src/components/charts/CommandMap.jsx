import '../../styles/26d-command-map.css'
import { useState } from 'react'
import { GRID, commandCell, normalizePitch } from '../../lib/zone/zoneGeometry.js'
import { MIN_COMMAND_PITCHES, commandHandCounts, commandTypes, commandView } from '../../api/commandMap.js'
import { pitchFamily } from '../../api/pitchArsenal.js'

// THE COMMAND MAP — where a pitcher puts each pitch, over a season.
//
// The arsenal card above it says WHAT he throws and HOW HARD. Nothing on the
// page said where he puts it, which is the same shape of hole a hitter's spray
// map fills: "by handedness" says who he beat, nothing says where the ball went.
//
// IT REUSES THE IN-GAME STRIKE ZONE's vocabulary, not something like it. The
// frame, the nine cells, the plate and the plot maths are literally
// StrikeZone.jsx's, out of lib/zone/zoneGeometry.js, and a lattice test pins
// this card's binning to that diagram's own projection. A reader who taps out
// of an at-bat and into this card is looking at the same zone.
//
// THE DENSITY IS DRAWN AS THE BINS IT IS — 5x5 cells, one clay hue in four
// steps — rather than as a smooth wash. Blocks are ground and marks are figure,
// so the two do not compete; it also looks like what it is, a scorer shading
// boxes in. The marks take the spray map's own sizes so severity reads the same
// on both pages: a small navy dot is a called strike, a large one with a paper
// ring is a whiff, and an amber diamond is a home run allowed, plotted where he
// THREW it rather than where it landed.
//
// Below Triple-A there is no pitch tracking at all, so there is no grid and the
// card renders nothing rather than an empty zone.

// Four steps, capped so the marks stay legible on the hottest cell — see
// 26d-command-map.css, where the pairings are pinned in check-contrast.mjs.
const BANDS = 4

// A cell's index -> its rect, in the same viewBox the zone frame is drawn in.
function cellRects(zx, zyT, cw, ch) {
  const out = []
  for (let i = 0; i < GRID * GRID; i++) {
    const col = i % GRID
    const row = Math.floor(i / GRID)
    out.push({ i, x: zx + (col - 1) * cw, y: zyT + (row - 1) * ch })
  }
  return out
}

export function CommandMap({ entry, level = 'mlb', throws = null }) {
  const [stand, setStand] = useState(null)
  const [code, setCode] = useState(null)

  const hands = commandHandCounts(entry, level)
  const types = commandTypes(entry, { level, stand })
  const view = commandView(entry, { level, code, stand })
  if (!view) return null

  // The zone box, from the shared geometry. A median zone: the card is a season
  // of different batters, so it draws the rulebook shape rather than any one
  // man's, and every pitch was normalised against the zone it was thrown into.
  const zx = 54.35
  const zr = 135.65
  const zyT = 70.57
  const zyB = 167.43
  const cw = (zr - zx) / 3
  const ch = (zyB - zyT) / 3
  const rects = cellRects(zx, zyT, cw, ch)
  const step = (n) => (view.max > 0 ? Math.min(BANDS, Math.ceil((n / view.max) * BANDS)) : 0)

  // Marks sit at their cell's centre. A season has no individual pitch to plot
  // — one dot per cell, sized by nothing, says "this happened here".
  const centre = (i) => ({ cx: rects[i].x + cw / 2, cy: rects[i].y + ch / 2 })

  return (
    <div className="cmdmap">
      <div className="cmdmap__chips" role="group" aria-label="Batter hand">
        <Chip on={stand === null} onSelect={() => setStand(null)} label="All" n={hands.L + hands.R} />
        <Chip on={stand === 'R'} onSelect={() => setStand('R')} label="vs RHH" n={hands.R} />
        <Chip on={stand === 'L'} onSelect={() => setStand('L')} label="vs LHH" n={hands.L} />
      </div>
      <div className="cmdmap__chips cmdmap__chips--types" role="group" aria-label="Pitch type">
        <Chip on={code === null} onSelect={() => setCode(null)} label="All" small />
        {types.map((t) => (
          <Chip
            key={t.code}
            on={code === t.code}
            thin={t.thin}
            onSelect={() => setCode(t.code)}
            label={t.code}
            family={pitchFamily(t.code)}
            small
          />
        ))}
      </div>

      <svg
        className="cmdmap__plot"
        viewBox="0 40 190 200"
        role="img"
        aria-label={`Command map: ${view.pitches} pitches, ${view.zonePct}% in the strike zone`}
      >
        {rects.map((r) => (
          <rect
            key={r.i}
            className={`cmdmap__cell cmdmap__cell--b${step(view.cells[r.i])}`}
            x={r.x}
            y={r.y}
            width={cw}
            height={ch}
          />
        ))}
        {/* The zone's own nine, ruled ON TOP of the density so the frame
            survives the hottest cell — at --rule it vanished exactly where the
            data was densest. */}
        <rect className="cmdmap__frame" x={zx} y={zyT} width={zr - zx} height={zyB - zyT} />
        {[1, 2].map((n) => (
          <g key={n}>
            <line className="cmdmap__third" x1={zx + n * cw} y1={zyT} x2={zx + n * cw} y2={zyB} />
            <line className="cmdmap__third" x1={zx} y1={zyT + n * ch} x2={zr} y2={zyT + n * ch} />
          </g>
        ))}
        <path
          className="cmdmap__plate"
          d={`M ${zx} 221 L ${zr} 221 L ${zr} 228 L ${(zx + zr) / 2} 234 L ${zx} 228 Z`}
        />
        {view.calledStrikes.map((n, i) =>
          n > 0 ? <circle key={`c${i}`} className="cmdmap__called" r="2.6" {...centre(i)} /> : null,
        )}
        {view.whiffs.map((n, i) =>
          n > 0 ? <circle key={`w${i}`} className="cmdmap__whiff" r="4.4" {...centre(i)} /> : null,
        )}
        {view.homers.map((n, i) =>
          n > 0 ? (
            <rect
              key={`h${i}`}
              className="cmdmap__homer"
              x={centre(i).cx - 4}
              y={centre(i).cy - 4}
              width="8"
              height="8"
              transform={`rotate(45 ${centre(i).cx} ${centre(i).cy})`}
            />
          ) : null,
        )}
      </svg>

      <p className="cmdmap__key">
        <span className="cmdmap__keyitem cmdmap__keyitem--density">Pitches per cell</span>
        <span className="cmdmap__keyitem cmdmap__keyitem--called">Called strike</span>
        <span className="cmdmap__keyitem cmdmap__keyitem--whiff">Whiff</span>
        <span className="cmdmap__keyitem cmdmap__keyitem--homer">Home run allowed</span>
      </p>

      <dl className="factgrid cmdmap__facts">
        <Fact label="Zone" value={view.zonePct} />
        <Fact label="Heart" value={view.heartPct} />
        <Fact label="1st pitch" value={view.firstZonePct} />
        <Fact label="Whiff" value={view.whiffPct} />
      </dl>

      <p className="hint cmdmap__note">
        {view.pitches.toLocaleString()} tracked pitches
        {throws ? ` · throws ${throws}` : ''} · counted off this card&#8217;s own grid, not
        Savant&#8217;s published rates · Hawk-Eye parks only · updates nightly
      </p>
    </div>
  )
}

function Chip({ on, thin, onSelect, label, n, small, family }) {
  return (
    <button
      type="button"
      className={`cmdmap__chip${on ? ' cmdmap__chip--on' : ''}${small ? ' cmdmap__chip--sm' : ''}${thin ? ' cmdmap__chip--thin' : ''}`}
      onClick={onSelect}
      aria-pressed={on}
      data-family={family}
    >
      {label}
      {n != null && <span className="cmdmap__chipn">{n.toLocaleString()}</span>}
    </button>
  )
}

function Fact({ label, value }) {
  return (
    <div className="fact">
      <dt className="fact__label">{label}</dt>
      <dd className="fact__value">{value == null ? '—' : `${value}%`}</dd>
    </div>
  )
}

// Re-exported so a caller can bin a single live pitch the same way the season
// grid does — the guarantee the lattice test pins.
export { commandCell, normalizePitch, MIN_COMMAND_PITCHES }
