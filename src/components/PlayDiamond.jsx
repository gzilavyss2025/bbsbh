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

// An error-driven leg notation (E8, E5…, or a bare "E") inks red like every
// other error mark in the app (.pbp__code--error, .sc-ab__type--error) — "E"
// is never a prefix any other advance code uses (see ADVANCE_CODES in
// api/playbyplay.js), so this is unambiguous.
const isErrorCode = (code) => /^E\d*$/.test(code ?? '')

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

// The out code can now run to ~6 characters ("CS 2-4", "PK 3-1"), which would
// push off the viewBox from the advance LABELS above — 1st grows right off the
// edge, 3rd grows left off it. These anchor the out code to grow INWARD instead
// so a full "tag chain" stays in bounds at every base (2nd/home already centered).
const OUT_LABELS = {
  1: { x: 99, y: 45, anchor: 'end' },
  2: { x: 50, y: 13, anchor: 'middle' },
  3: { x: 1, y: 45, anchor: 'start' },
  4: { x: 50, y: 96, anchor: 'middle' },
}

// Where a red "PR" sits when a pinch runner took over at a base — pinned just
// above and outside that base, clear of the advance notations in LABELS.
const PR_LABELS = {
  1: { x: 84, y: 38, anchor: 'start' },
  2: { x: 66, y: 16, anchor: 'start' },
  3: { x: 16, y: 38, anchor: 'end' },
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

export function PlayDiamond({ reached = 0, scored = false, legNotations = {}, outAt = null, outCode = '', prBase = null, size = 108 }) {
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
          className={`pbp__advance ${isErrorCode(n.code) ? 'pbp__advance--error' : ''}`}
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
          x={OUT_LABELS[outAt].x}
          y={OUT_LABELS[outAt].y}
          textAnchor={OUT_LABELS[outAt].anchor}
        >
          {outCode}
        </text>
      )}
      {prBase != null && PR_LABELS[prBase] && (
        <text
          className="pbp__pr"
          x={PR_LABELS[prBase].x}
          y={PR_LABELS[prBase].y}
          textAnchor={PR_LABELS[prBase].anchor}
        >
          PR
        </text>
      )}
    </svg>
  )
}
