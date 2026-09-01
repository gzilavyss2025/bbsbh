// Per-play base diamond for the play-by-play feed, drawn the way a scorer pens
// it: the diamond sits in a faint gray by default, and the bases the batter
// actually legged out are traced over in a darker pencil gray — one edge per
// base reached (home→1st, 1st→2nd…), all four when he came around to score.
// Each base he advanced to on a LATER play is annotated outside that base with
// how he got there and which lineup spot drove him (GO⁵, 1B³…). A runner
// thrown out on the bases gets his path capped with a short perpendicular
// stroke and the out type (CS, 4-6…) by that base — following the actual
// basepath through every base he legally touched first, even one thrown out
// two bases past where he last stood safely (2nd, out at home).
import { outLegBases } from './playDiamondGeometry.js'

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

// Where a red "PR" (and the incoming runner's jersey number, stacked on the
// line below it) sits when a pinch runner took over at a base — hugging that
// base the same way the advance notations in LABELS do, offset just enough
// to clear them rather than drifting toward the next base.
const PR_LABELS = {
  1: { x: 84, y: 40, anchor: 'start' },
  2: { x: 58, y: 15, anchor: 'start' },
  3: { x: 16, y: 40, anchor: 'end' },
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

// The extra-innings automatic runner is GIVEN his first bases — he never ran
// them — so the scorer's convention leaves that stretch of the diamond
// un-inked: a dotted path from home to the base he was placed on, with
// everything beyond it drawn normally. `placedAt` is that base number (2 under
// the current rule; kept a base rather than a boolean so a different placement
// needs no second prop). On a run the polygon still fills solid — a filled
// diamond means "he scored" everywhere else in the app and that has to hold —
// with the ghost legs overdrawn on top in paper colour so the given bases stay
// legible through the fill. His run is unearned by rule, so the red outline is
// already there reinforcing it.
const GHOST_DASH = '3 3'

export function PlayDiamond({ reached = 0, scored = false, earned = true, legNotations = {}, outAt = null, outCode = '', prBase = null, prJersey = null, placedAt = null, size = 108 }) {
  const { traveled: outTraveled, legA, legB } = outLegBases(reached, outAt)
  const traveled = scored ? 4 : outTraveled
  // Legs [0, ghostLegs) were given, not run: dotted, never inked solid.
  const ghostLegs = placedAt != null ? Math.min(placedAt, 4) : 0
  // An UNEARNED run is circled, the scorer's convention — a red ring around the
  // solid diamond. Only meaningful when he scored.
  const unearned = scored && !earned

  // Geometry for a baserunning out: the path is drawn to where he was safe,
  // then a half-leg toward the base he was retired at (or nothing, if he was
  // doubled off the base he stood on), capped by the perpendicular stroke.
  let outHalf = null
  let outTick = null
  if (outAt != null) {
    const a = BASES[legA]
    const b = BASES[legB]
    if (outAt > reached) {
      const m = mid(a, b)
      outHalf = [a, m]
      outTick = perpStroke(a, b, m)
    } else {
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
        // A run: the whole diamond penciled solid. An UNEARNED run keeps the
        // scorer's red mark, but as the diamond's own outline (same weight as
        // the ring this replaced) rather than a circle drawn around it — the
        // solid shape stays legible as one mark instead of two concentric ones.
        <polygon
          points={`${HOME} ${FIRST} ${SECOND} ${THIRD}`}
          fill="var(--graphite)"
          stroke={unearned ? 'var(--clay)' : 'var(--graphite)'}
          strokeWidth={unearned ? 2.5 : 2}
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
          {/* `pbp__leg` and `--leg-i` are for the write-on's basepath trace
              (styles/motion/playbyplay.css, beat 2) and nothing else. Every
              leg is the same length — sqrt(30**2 + 30**2) = 42.43 units in this
              0 0 100 100 viewBox — so one fixed stroke-dasharray draws all of
              them, and the index is already travel order because that is the
              order this loop emits them in. The GHOST legs below are
              deliberately not marked: they carry their own dash pattern, which
              a trace would overwrite. */}
          {Array.from({ length: traveled }).map((_, i) =>
            i < ghostLegs ? null : (
              <line
                key={i}
                className="pbp__leg"
                style={{ '--leg-i': i - ghostLegs }}
                x1={BASES[i][0]}
                y1={BASES[i][1]}
                x2={BASES[i + 1][0]}
                y2={BASES[i + 1][1]}
                stroke="var(--graphite)"
                strokeWidth={3}
                strokeLinecap="round"
              />
            ),
          )}
        </>
      )}
      {/* The given bases. Drawn last so they read over a scored diamond's
          solid fill (paper colour there, graphite over the open outline). */}
      {Array.from({ length: ghostLegs }).map((_, i) => (
        <line
          key={`ghost-${i}`}
          x1={BASES[i][0]}
          y1={BASES[i][1]}
          x2={BASES[i + 1][0]}
          y2={BASES[i + 1][1]}
          stroke={scored ? 'var(--paper-2)' : 'var(--graphite-soft)'}
          strokeWidth={scored ? 2 : 2.5}
          strokeLinecap="round"
          strokeDasharray={GHOST_DASH}
        />
      ))}
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
          <tspan x={PR_LABELS[prBase].x}>PR</tspan>
          {prJersey && (
            <tspan className="pbp__prnum" x={PR_LABELS[prBase].x} dy={9}>
              {prJersey}
            </tspan>
          )}
        </text>
      )}
    </svg>
  )
}
