import { useState } from 'react'
import { winProbSplit } from '../api/winprob.js'
import { teamChipColors } from '../lib/teams.js'
import { ordinal } from '../lib/format.js'

// The win-probability "story of the game", drawn the scorebook way: one ink line
// tracing the home team's win % across every plotted play, the plot split into
// two bands at the line — the HOME share below it (soft navy), the AWAY share
// above (soft clay) — so the line's height reads directly as who's ahead. A
// dashed 50% midline marks an even game; faint hairlines divide the innings;
// small clay ticks flag the scoring plays that moved it. Real per-team brand
// color is reserved for identity chrome (header swatches/splitbar, ledger
// chips, the linked big-swing markers below) — never the bands/line, whose
// job is structural ("which side of 50%") and has to stay legible regardless
// of which two clubs are playing (see teams.js's teamChipColors).
//
// SPOILER RULE: this only draws what it's handed. `points` comes from
// selectWinProbPath (api/winprob.js), a REVEAL-ONLY selector — the box score
// passes the whole game (inside its seal), the innings view passes only the
// plays through the revealed half. So there's nothing sealed to leak here; this
// component never reaches for the feed itself. Renders nothing on an empty path
// (no data / a MiLB park with no win-prob endpoint), so callers can drop it in
// unconditionally.
//
// `partial` tags the innings-view instance for its accessible summary; the box
// score omits it.

const W = 328
const H = 168
const PAD_L = 28
const PAD_R = 16
const PAD_T = 10
const PAD_B = 22
const PLOT_L = PAD_L
const PLOT_R = W - PAD_R
const PLOT_T = PAD_T
const PLOT_B = H - PAD_B
const PLOT_W = PLOT_R - PLOT_L
const PLOT_H = PLOT_B - PLOT_T

// A team's brand pair for chip/marker chrome, falling back to a neutral
// graphite pair for a team teamChipColors doesn't know (no teamId handed in,
// or an unrecognized MiLB id) rather than rendering an undefined color.
function chipColorsFor(teamId) {
  return teamChipColors(teamId) ?? { primary: '#6B6558', secondary: '#938C7C', text: '#FBF6E9' }
}

export function WinProbChart({
  points,
  bigPlays = [],
  awayAbbr,
  homeAbbr,
  awayId,
  homeId,
  partial = false,
}) {
  // Linked highlighting: `pinnedIdx` survives until the same marker/row is
  // tapped again or the card is tapped elsewhere (this app is phone-first —
  // a phone has no hover, so pinning is the interaction that has to work).
  // `hoveredIdx` is a desktop-only bonus layered on top, cleared on
  // pointer-leave; a pin always wins over a stray hover. Both key off
  // `p.idx` — selectWinProbBigPlays' own index into `points`, not a
  // synthesized row id, so chart and ledger read the exact same identity.
  const [pinnedIdx, setPinnedIdx] = useState(null)
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const activeIdx = pinnedIdx ?? hoveredIdx
  const hasActive = activeIdx != null
  const togglePin = (idx) => setPinnedIdx((was) => (was === idx ? null : idx))
  const linkedProps = (idx, label) => ({
    tabIndex: 0,
    role: 'button',
    'aria-label': label,
    onPointerEnter: () => setHoveredIdx(idx),
    onPointerLeave: () => setHoveredIdx(null),
    onClick: (e) => {
      e.stopPropagation()
      togglePin(idx)
    },
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        togglePin(idx)
      }
    },
  })

  if (!points || points.length === 0) return null

  const away = awayAbbr || 'AWY'
  const home = homeAbbr || 'HOM'
  const split = winProbSplit(points)
  const awayColors = chipColorsFor(awayId)
  const homeColors = chipColorsFor(homeId)

  // Prepend a synthetic even-game origin so the line starts on the midfield 50%
  // (the score is 0–0 at first pitch); its inning matches the first real play so
  // the inning bands stay right.
  const pts = [{ home: 50, inning: points[0].inning, half: 'start' }, ...points]
  const n = pts.length

  const x = (i) => (n === 1 ? PLOT_L : PLOT_L + (i / (n - 1)) * PLOT_W)
  const y = (h) => PLOT_T + (1 - h / 100) * PLOT_H

  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.home).toFixed(1)}`)
    .join(' ')

  // Home band: the area between the line and the baseline. The away band is the
  // plot rect behind it, so the two always tile the full height.
  const homeArea =
    `M ${x(0).toFixed(1)} ${PLOT_B} ` +
    pts.map((p, i) => `L ${x(i).toFixed(1)} ${y(p.home).toFixed(1)}`).join(' ') +
    ` L ${x(n - 1).toFixed(1)} ${PLOT_B} Z`

  // Contiguous runs of the same half-inning (not just the same inning), for the
  // dividing hairlines and the inning-number labels centered under each run —
  // this is what lets top and bottom of an inning show as two distinct spans
  // instead of one merged block.
  const groups = []
  for (let i = 0; i < pts.length; i++) {
    const key = `${pts[i].inning}-${pts[i].half}`
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.end = i
    else groups.push({ inning: pts[i].inning, half: pts[i].half, key, start: i, end: i })
  }

  const scoring = pts
    .map((p, i) => (p.isScoring ? i : -1))
    .filter((i) => i >= 0)

  const summary =
    `Win probability${partial ? ' through the revealed half' : ''}: ` +
    `${home} ${split.home}%, ${away} ${split.away}%.`

  return (
    <section className={`winprob${hasActive ? ' is-active' : ''}`} onClick={() => setPinnedIdx(null)}>
      <div className="winprob__head">
        <h3 className="winprob__title">Win probability</h3>
        <div className="winprob__split" aria-hidden="true">
          <span className="winprob__team winprob__team--away" style={{ '--team-color': awayColors.primary }}>
            {away} <span className="winprob__pct">{split.away}%</span>
          </span>
          <span className="winprob__team winprob__team--home" style={{ '--team-color': homeColors.primary }}>
            {home} <span className="winprob__pct">{split.home}%</span>
          </span>
        </div>
      </div>

      {/* A one-line proportional recap of the split, in each team's own real
          color — the header swatches already carry the identity, this just
          echoes it as a shape. Purely decorative (the split pills carry the
          real numbers), hidden from assistive tech. */}
      <div className="winprob__splitbar" aria-hidden="true">
        <span
          className="winprob__splitbar-seg"
          style={{ width: `${split.away}%`, background: awayColors.primary }}
        />
        <span
          className="winprob__splitbar-seg"
          style={{ width: `${split.home}%`, background: homeColors.primary }}
        />
      </div>

      <svg
        className="winprob__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={summary}
      >
        {/* Away band fills the whole plot; the home band is painted over it. */}
        <rect
          className="winprob__band winprob__band--away"
          x={PLOT_L}
          y={PLOT_T}
          width={PLOT_W}
          height={PLOT_H}
        />
        <path className="winprob__band winprob__band--home" d={homeArea} />

        {/* Dividers between consecutive half-inning runs: a solid hairline
            between innings, a subtle dashed stripe between the top and
            bottom of the same inning. The synthetic origin point (groups[0],
            half 'start') gets no divider of its own. */}
        {groups.slice(1).map((g, idx) => {
          const prev = groups[idx] // groups.slice(1)[idx] follows groups[idx]
          const bx = (x(g.start - 1) + x(g.start)) / 2
          const sameInning = prev.half !== 'start' && prev.inning === g.inning
          return (
            <line
              key={`div-${g.key}`}
              className={sameInning ? 'winprob__halfline' : 'winprob__inningline'}
              x1={bx}
              y1={PLOT_T}
              x2={bx}
              y2={PLOT_B}
            />
          )
        })}

        {/* Even-game reference. */}
        <line
          className="winprob__mid"
          x1={PLOT_L}
          y1={y(50)}
          x2={PLOT_R}
          y2={y(50)}
        />

        {/* The win-probability line itself. */}
        <path className="winprob__line" d={linePath} />

        {/* Scoring plays — where the line took its steps. Flattened into the
            line on purpose (small, dim, no stroke halo, no pointer affordance):
            not every scoring play is a big swing, so this layer must stay
            visibly inert rather than read as a second kind of tappable dot —
            see the big-swing markers below, a DIFFERENT set of plays. */}
        {scoring.map((i) => (
          <circle
            key={`sc-${i}`}
            className="winprob__scoremark"
            cx={x(i)}
            cy={y(pts[i].home)}
            r={1.4}
          />
        ))}

        {/* The current/final point. */}
        <circle
          className="winprob__now"
          cx={x(n - 1)}
          cy={y(pts[n - 1].home)}
          r={3}
        />

        {/* Y ticks: 0 / 50 / 100. */}
        {[0, 50, 100].map((v) => (
          <text
            key={`y-${v}`}
            className="winprob__ylabel"
            x={PLOT_L - 4}
            y={y(v) + 3}
            textAnchor="end"
          >
            {v}
          </text>
        ))}

        {/* Inning numbers along the foot, one per half — an up arrow for the
            top half, a down arrow for the bottom, so the axis itself reads
            which half each span covers. Card-wide rule: these are the ONLY
            ▲/▼ glyphs on this card — the ledger below carries direction as a
            team-colored chip instead, so the same characters never mean two
            different things in one card. The synthetic origin point (half
            'start') gets no label. */}
        {groups.filter((g) => g.half !== 'start').map((g) => (
          <text
            key={`in-${g.key}`}
            className="winprob__inninglabel"
            x={(x(g.start) + x(g.end)) / 2}
            y={H - 7}
            textAnchor="middle"
          >
            <tspan className="winprob__inningarrow">{g.half === 'top' ? '▲' : '▼'}</tspan>
            {g.inning}
          </text>
        ))}

        {/* Linked highlighting, chart half: one hand-drawn baseball marker per
            selectWinProbBigPlays() entry, at points[bigPlay.idx]'s exact
            position — bigPlays isn't the same set as the scoring flecks above
            (a replay-reversed double play can swing win% hard with no run
            involved), so this is its own layer, not a reuse. `+1` accounts for
            the synthetic origin point prepended to `pts`. Idle markers sit at
            equal, unhighlighted weight; once anything is active every OTHER
            marker fades (`.winprob.is-active .winprob__bigdot:not(.is-active)`,
            see index.css) and the active one grows, tints toward the favored
            team's real brand color, and shows its value label. */}
        {bigPlays.map((p) => {
          const ptsIdx = p.idx + 1
          const cx = x(ptsIdx)
          const cy = y(pts[ptsIdx].home)
          const toHome = p.delta > 0
          const abbr = toHome ? home : away
          const colors = chipColorsFor(toHome ? homeId : awayId)
          const val = Math.round(Math.abs(p.delta))
          const labelText = `${abbr} +${val}%`
          const labelW = 16 + labelText.length * 6.4
          const labelBelow = cy < PLOT_T + PLOT_H * 0.32
          const labelY = labelBelow ? cy + 18 : cy - 14
          const labelCx = Math.min(W - 3 - labelW / 2, Math.max(3 + labelW / 2, cx))
          // Two mirrored seam arcs sized off the ball's r=3.5 body — a
          // simplified stand-in for real stitching, legible at this scale.
          const seamL = `M ${(cx - 1.9).toFixed(1)},${(cy - 2.6).toFixed(1)} Q ${(cx - 0.5).toFixed(1)},${cy.toFixed(1)} ${(cx - 1.9).toFixed(1)},${(cy + 2.6).toFixed(1)}`
          const seamR = `M ${(cx + 1.9).toFixed(1)},${(cy - 2.6).toFixed(1)} Q ${(cx + 0.5).toFixed(1)},${cy.toFixed(1)} ${(cx + 1.9).toFixed(1)},${(cy + 2.6).toFixed(1)}`
          const isActive = activeIdx === p.idx
          return (
            <g
              key={`bp-${p.idx}`}
              className={`winprob__bigdot${isActive ? ' is-active' : ''}`}
              style={{ '--team-color': colors.primary, '--team-text': colors.text }}
              {...linkedProps(
                p.idx,
                `Biggest swing: ${labelText}, ${p.half === 'top' ? 'top' : 'bottom'} of the ${ordinal(p.inning)}`,
              )}
            >
              <circle className="winprob__bigdot-hit" cx={cx} cy={cy} r={11} />
              <circle className="winprob__bigdot-ring" cx={cx} cy={cy} />
              <g className="winprob__bigdot-ball">
                <circle className="winprob__ball-body" cx={cx} cy={cy} r={3.5} />
                <path className="winprob__ball-seam" d={seamL} />
                <path className="winprob__ball-seam" d={seamR} />
              </g>
              <g className="winprob__bigdot-label" transform={`translate(${labelCx.toFixed(1)},${labelY.toFixed(1)})`}>
                <rect
                  className="winprob__bigdot-label-bg"
                  x={-labelW / 2}
                  y={-9}
                  width={labelW}
                  height={15}
                  rx={7.5}
                />
                <text className="winprob__bigdot-label-text" textAnchor="middle" dy={2}>
                  {labelText}
                </text>
              </g>
            </g>
          )
        })}
      </svg>

      {bigPlays.length > 0 && (
        <div className="winprob__ledger">
          <h4 className="winprob__subhead">Biggest swings</h4>
          <ol className="winprob__ledger-list">
            {bigPlays.map((p) => {
              const toHome = p.delta > 0
              const abbr = toHome ? home : away
              const colors = chipColorsFor(toHome ? homeId : awayId)
              const val = Math.round(Math.abs(p.delta))
              const chipText = `${abbr} +${val}%`
              const tag = `${p.half === 'top' ? 'T' : 'B'}${p.inning}`
              const isActive = activeIdx === p.idx
              return (
                <li
                  className={`winprob__ledger-row${isActive ? ' is-active' : ''}`}
                  key={`bp-${p.idx}`}
                  style={{ '--team-color': colors.primary }}
                  {...linkedProps(
                    p.idx,
                    `Biggest swing: ${chipText}, ${p.half === 'top' ? 'top' : 'bottom'} of the ${ordinal(p.inning)}`,
                  )}
                >
                  <span className="winprob__ledger-meta">
                    <span
                      className="winprob__ledger-chip"
                      style={{ background: colors.primary, color: colors.text }}
                    >
                      {chipText}
                    </span>
                    <span className="winprob__ledger-half">{tag}</span>
                  </span>
                  <p className="winprob__ledger-desc">{p.desc || `${abbr} rally`}</p>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </section>
  )
}
