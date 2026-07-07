// Per-play base diamond for the play-by-play feed, drawn Numbers Game #22
// style: the batter's trip around the bases is penciled in as graphite-shaded
// legs — one triangular wedge per base reached (home→1st, 1st→2nd, 2nd→3rd,
// 3rd→home). A batter who came around to score fills all four wedges, so his
// diamond reads as a solid shaded diamond; a batter retired shows an empty
// outline. Each base he advanced to on a LATER play is annotated outside that
// base with how he got there (BB, GO, 2B…). Centered in the viewBox with room
// around it for those labels.
const HOME = [50, 80]
const FIRST = [80, 50]
const SECOND = [50, 20]
const THIRD = [20, 50]
const CENTER = [50, 50]

// The four base-path wedges, in running order. Wedge i is shaded once the
// runner has reached base i+1.
const LEGS = [
  [HOME, FIRST, CENTER],
  [FIRST, SECOND, CENTER],
  [SECOND, THIRD, CENTER],
  [THIRD, HOME, CENTER],
]

// Where each base's advance notation sits, just outside that base.
const LABELS = {
  1: { x: 85, y: 53, anchor: 'start' },
  2: { x: 50, y: 13, anchor: 'middle' },
  3: { x: 15, y: 53, anchor: 'end' },
  4: { x: 50, y: 96, anchor: 'middle' },
}

export function PlayDiamond({ reached = 0, scored = false, legNotations = {}, size = 140 }) {
  const filled = scored ? 4 : reached
  return (
    <svg
      className="pbp__diamond"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      {LEGS.slice(0, filled).map((pts, i) => (
        <polygon key={i} points={pts.map((p) => p.join(',')).join(' ')} fill="var(--graphite)" />
      ))}
      <polygon
        points={`${HOME} ${FIRST} ${SECOND} ${THIRD}`}
        fill="none"
        stroke="var(--ink-1)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {Object.entries(legNotations).map(([base, code]) => (
        <text
          key={base}
          className="pbp__advance"
          x={LABELS[base].x}
          y={LABELS[base].y}
          textAnchor={LABELS[base].anchor}
        >
          {code}
        </text>
      ))}
    </svg>
  )
}
