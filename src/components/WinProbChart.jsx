import { winProbSplit } from '../api/winprob.js'

// The win-probability "story of the game", drawn the scorebook way: one ink line
// tracing the home team's win % across every plotted play, the plot split into
// two bands at the line — the HOME share below it (soft navy), the AWAY share
// above (soft clay) — so the line's height reads directly as who's ahead. A
// dashed 50% midline marks an even game; faint hairlines divide the innings;
// small clay ticks flag the scoring plays that moved it.
//
// SPOILER RULE: this only draws what it's handed. `points` comes from
// selectWinProbPath (api/winprob.js), a REVEAL-ONLY selector — the box score
// passes the whole game (inside its seal), the innings view passes only the
// plays through the revealed half. So there's nothing sealed to leak here; this
// component never reaches for the feed itself. Renders nothing on an empty path
// (no data / a MiLB park with no win-prob endpoint), so callers can drop it in
// unconditionally.
//
// `partial` tags the innings-view instance ("so far"); the box score omits it.

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

// The Swing Stubs strip — a short seismograph beneath the line: one signed bar
// per revealed half (the derivative the line hides). Same horizontal padding as
// the plot so it reads on the same axis; its own short viewBox.
const SW_W = W
const SW_H = 72
const SW_PAD_T = 8
const SW_PAD_B = 8
const SW_BASE = SW_PAD_T + (SW_H - SW_PAD_T - SW_PAD_B) / 2 // the even-game baseline
const SW_MAX_BAR = (SW_H - SW_PAD_T - SW_PAD_B) / 2 // full-height bar reach
// A FIXED clamp (not an auto-max): a half swinging the home win % by this many
// points draws a full-height bar; anything past it gets an overflow notch. A
// constant keeps the geometry stable and can't hint a future swing is coming.
const SW_MAX_SWING = 30

export function WinProbChart({
  points,
  swings = [],
  bigPlays = [],
  awayAbbr,
  homeAbbr,
  partial = false,
}) {
  if (!points || points.length === 0) return null

  const away = awayAbbr || 'AWY'
  const home = homeAbbr || 'HOM'
  const split = winProbSplit(points)

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
    <section className="winprob">
      <div className="winprob__head">
        <h3 className="winprob__title">
          Win probability
          {partial && <span className="winprob__sofar"> · so far</span>}
        </h3>
        <div className="winprob__split" aria-hidden="true">
          <span className="winprob__team winprob__team--away">
            {away} <span className="winprob__pct">{split.away}%</span>
          </span>
          <span className="winprob__team winprob__team--home">
            {home} <span className="winprob__pct">{split.home}%</span>
          </span>
        </div>
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

        {/* Scoring plays — where the line took its steps. */}
        {scoring.map((i) => (
          <circle
            key={`sc-${i}`}
            className="winprob__scoremark"
            cx={x(i)}
            cy={y(pts[i].home)}
            r={2}
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
            which half each span covers. The synthetic origin point (half
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
      </svg>

      {swings.length > 0 && (
        <>
          <h4 className="winprob__subhead">Swing by half</h4>
          <svg
            className="winprob__swings"
            viewBox={`0 0 ${SW_W} ${SW_H}`}
            role="img"
            aria-label={`Net win-probability swing of each ${
              partial ? 'revealed ' : ''
            }half-inning, toward ${home} below the line or ${away} above it.`}
          >
            {/* The even-game baseline the bars grow from. */}
            <line
              className="winprob__stubbase"
              x1={PLOT_L}
              y1={SW_BASE}
              x2={PLOT_R}
              y2={SW_BASE}
            />
            {swings.map((s, k) => {
              const slotW = (SW_W - PAD_L - PAD_R) / swings.length
              const cx = PAD_L + (k + 0.5) * slotW
              const barW = Math.max(1.5, Math.min(9, slotW * 0.5))
              const mag = Math.min(Math.abs(s.swing), SW_MAX_SWING) / SW_MAX_SWING
              const h = mag * SW_MAX_BAR
              if (s.swing === 0) return null // a dead-even half: no bar (baseline only)
              const toHome = s.swing > 0 // toward home ⇒ down/navy; away ⇒ up/clay
              const tone = toHome ? 'home' : 'away'
              const tipY = toHome ? SW_BASE + h : SW_BASE - h
              const overflow = Math.abs(s.swing) > SW_MAX_SWING
              const notch = toHome
                ? `${cx - 3},${tipY} ${cx + 3},${tipY} ${cx},${tipY + 4}`
                : `${cx - 3},${tipY} ${cx + 3},${tipY} ${cx},${tipY - 4}`
              return (
                <g key={`sw-${s.inning}-${s.half}`}>
                  <rect
                    className={`winprob__stub winprob__stub--${tone}`}
                    x={cx - barW / 2}
                    y={toHome ? SW_BASE : SW_BASE - h}
                    width={barW}
                    height={h}
                  />
                  {overflow && (
                    <polygon
                      className={`winprob__stubnotch winprob__stubnotch--${tone}`}
                      points={notch}
                    />
                  )}
                </g>
              )
            })}
          </svg>
        </>
      )}

      {bigPlays.length > 0 && (
        <div className="winprob__ledger">
          <h4 className="winprob__subhead">Biggest swings</h4>
          <ol className="winprob__ledger-list">
            {bigPlays.map((p) => {
              const toHome = p.delta > 0
              const tone = toHome ? 'home' : 'away'
              const tag = `${p.half === 'top' ? 'T' : 'B'}${p.inning}`
              return (
                <li className="winprob__ledger-row" key={`bp-${p.idx}`}>
                  <span className={`winprob__ledger-swing winprob__ledger-swing--${tone}`}>
                    <span className="winprob__ledger-arrow" aria-hidden="true">
                      {toHome ? '▼' : '▲'}
                    </span>
                    {Math.abs(Math.round(p.delta))}
                  </span>
                  <span className="winprob__ledger-desc">
                    {p.desc || `${toHome ? home : away} rally`}
                  </span>
                  <span className="winprob__ledger-tag">{tag}</span>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </section>
  )
}
