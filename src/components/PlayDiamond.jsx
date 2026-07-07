// Per-play base diamond for the play-by-play feed, drawn Numbers Game #22
// style: the batter's trip around the bases is penciled in as graphite-shaded
// legs — one triangular wedge per base reached (home→1st, 1st→2nd, 2nd→3rd,
// 3rd→home). A batter who came around to score fills all four wedges, so his
// diamond reads as a solid shaded diamond; a batter left on second shows two
// wedges; a batter retired shows an empty outline.
const HOME = [50, 90]
const R = 14
const FIRST = [50 + R, 90 - R]
const SECOND = [50, 90 - 2 * R]
const THIRD = [50 - R, 90 - R]
const CENTER = [50, 90 - R]

// The four base-path wedges, in running order. Wedge i is shaded once the
// runner has reached base i+1.
const LEGS = [
  [HOME, FIRST, CENTER],
  [FIRST, SECOND, CENTER],
  [SECOND, THIRD, CENTER],
  [THIRD, HOME, CENTER],
]

export function PlayDiamond({ reached = 0, scored = false, size = 76 }) {
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
    </svg>
  )
}
