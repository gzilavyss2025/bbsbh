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

export function WinProbChart({ points, awayAbbr, homeAbbr, partial = false }) {
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

  // Contiguous runs of the same inning, for the dividing hairlines and the
  // inning-number labels centered under each run.
  const groups = []
  for (let i = 0; i < pts.length; i++) {
    const last = groups[groups.length - 1]
    if (last && last.inning === pts[i].inning) last.end = i
    else groups.push({ inning: pts[i].inning, start: i, end: i })
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

        {/* Inning dividers, between consecutive inning runs. */}
        {groups.slice(1).map((g) => {
          const bx = (x(g.start - 1) + x(g.start)) / 2
          return (
            <line
              key={`div-${g.inning}-${g.start}`}
              className="winprob__inningline"
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

        {/* Inning numbers along the foot. */}
        {groups.map((g) => (
          <text
            key={`in-${g.inning}-${g.start}`}
            className="winprob__inninglabel"
            x={(x(g.start) + x(g.end)) / 2}
            y={H - 7}
            textAnchor="middle"
          >
            {g.inning}
          </text>
        ))}
      </svg>
    </section>
  )
}
