// Per-play base diamond for the play-by-play feed, drawn the way a scorer pens
// it: the diamond sits in a faint gray by default, and the bases the batter
// actually legged out are traced over in a darker pencil gray — one edge per
// base reached (home→1st, 1st→2nd…), all four when he came around to score.
// Each base he advanced to on a LATER play is annotated outside that base with
// how he got there and which lineup spot drove him (GO⁵, 1B³…). A runner
// thrown out on the bases gets his path capped with a short perpendicular
// stroke and the out type (CS, 4-6…) by that base.
const HOME = [50, 80]
const FIRST = [80, 50]
const SECOND = [50, 20]
const THIRD = [20, 50]
// Indexed by base number: 0 = home (start), 1/2/3 = first/second/third,
// 4 = home again (a run scored).
const BASES = [HOME, FIRST, SECOND, THIRD, HOME]

// Where each base's notation sits, just outside that base. Third base hugs the
// diamond's left edge (x=20); its label is anchored to END right against it so
// a two-char code with a superscript slot ("2B⁵") grows leftward into the
// margin instead of off the viewBox / into the strike lane.
const LABELS = {
  1: { x: 85, y: 53, anchor: 'start' },
  2: { x: 50, y: 13, anchor: 'middle' },
  3: { x: 19, y: 53, anchor: 'end' },
  4: { x: 50, y: 96, anchor: 'middle' },
}

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

// Two endpoints of a short stroke perpendicular to segment a→b, centered at p.
function perpStroke(a, b, p, len = 6) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const n = Math.hypot(dx, dy) || 1
  const ux = -dy / n
  const uy = dx / n
  return [
    [p[0] - ux * len, p[1] - uy * len],
    [p[0] + ux * len, p[1] + uy * len],
  ]
}

export function PlayDiamond({ reached = 0, scored = false, legNotations = {}, outAt = null, outCode = '', size = 108 }) {
  const traveled = scored ? 4 : reached

  // Geometry for a baserunning out: the path is drawn to where he was safe,
  // then a half-leg toward the base he was retired at (or nothing, if he was
  // doubled off the base he stood on), capped by the perpendicular stroke.
  let outHalf = null
  let outTick = null
  if (outAt != null) {
    if (outAt > reached) {
      const a = BASES[reached]
      const b = BASES[outAt]
      const m = mid(a, b)
      outHalf = [a, m]
      outTick = perpStroke(a, b, m)
    } else {
      const a = BASES[Math.max(0, outAt - 1)]
      const b = BASES[outAt]
      outTick = perpStroke(a, b, b)
    }
  }

  return (
    <svg
      className="pbp__diamond"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      {scored ? (
        // A run: the whole diamond penciled solid.
        <polygon
          points={`${HOME} ${FIRST} ${SECOND} ${THIRD}`}
          fill="var(--graphite)"
          stroke="var(--graphite)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      ) : (
        <>
          <polygon
            points={`${HOME} ${FIRST} ${SECOND} ${THIRD}`}
            fill="none"
            stroke="var(--rule)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          {Array.from({ length: traveled }).map((_, i) => (
            <line
              key={i}
              x1={BASES[i][0]}
              y1={BASES[i][1]}
              x2={BASES[i + 1][0]}
              y2={BASES[i + 1][1]}
              stroke="var(--graphite)"
              strokeWidth={3}
              strokeLinecap="round"
            />
          ))}
        </>
      )}
      {outHalf && (
        <line
          x1={outHalf[0][0]}
          y1={outHalf[0][1]}
          x2={outHalf[1][0]}
          y2={outHalf[1][1]}
          stroke="var(--graphite)"
          strokeWidth={3}
          strokeLinecap="round"
        />
      )}
      {outTick && (
        <line
          x1={outTick[0][0]}
          y1={outTick[0][1]}
          x2={outTick[1][0]}
          y2={outTick[1][1]}
          stroke="var(--clay)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      )}
      {Object.entries(legNotations).map(([base, n]) => (
        <text
          key={base}
          className="pbp__advance"
          x={LABELS[base].x}
          y={LABELS[base].y}
          textAnchor={LABELS[base].anchor}
        >
          {n.code}
          {n.slot != null && (
            <tspan className="pbp__advslot" dy={-3}>
              {n.slot}
            </tspan>
          )}
        </text>
      ))}
      {outAt != null && outCode && (
        <text
          className="pbp__advance pbp__advance--out"
          x={LABELS[outAt].x}
          y={LABELS[outAt].y}
          textAnchor={LABELS[outAt].anchor}
        >
          {outCode}
        </text>
      )}
    </svg>
  )
}
