// Per-play field diagram for the play-by-play feed: a base-occupancy diamond
// (same idea as DiamondGlyph, redrawn at inline-card scale with room above it
// for the outfield) plus, when the ball was put in play, a dot marking roughly
// where it was fielded. This is a stylized diagram, not a to-scale spray
// chart — see hitToXY below.
const HOME = [50, 90]
const R = 14
const FIRST = [50 + R, 90 - R]
const SECOND = [50, 90 - 2 * R]
const THIRD = [50 - R, 90 - R]

// The feed's hit coordinates are centered on x=125 (foul line to foul line)
// with y counting down from ~205 at home plate to ~20 at a deep fence.
// Calibrated against real plays (see api/playbyplay.js), not exact physics.
function hitToXY({ x, y }) {
  const nx = (x - 125) / 105
  const ny = (205 - y) / 185
  return [Math.min(96, Math.max(4, 50 + nx * 40)), Math.min(90, Math.max(8, 90 - ny * 78))]
}

function baseDot(x, y, on) {
  return (
    <rect
      x={x - 5}
      y={y - 5}
      width={10}
      height={10}
      transform={`rotate(45 ${x} ${y})`}
      fill={on ? 'var(--field)' : 'var(--paper-2)'}
      stroke="var(--ink-1)"
      strokeWidth={1.5}
    />
  )
}

export function PlayDiamond({ bases = [false, false, false], hit = null, size = 40 }) {
  const hitXY = hit ? hitToXY(hit) : null
  return (
    <svg
      className="pbp__diamond"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <polygon
        points={`${HOME} ${FIRST} ${SECOND} ${THIRD}`}
        fill="none"
        stroke="var(--ink-1)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {baseDot(...FIRST, bases[0])}
      {baseDot(...SECOND, bases[1])}
      {baseDot(...THIRD, bases[2])}
      {hitXY && (
        <>
          <line
            x1={HOME[0]}
            y1={HOME[1]}
            x2={hitXY[0]}
            y2={hitXY[1]}
            stroke="var(--graphite)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
          <circle cx={hitXY[0]} cy={hitXY[1]} r={4} fill="var(--graphite)" />
        </>
      )}
    </svg>
  )
}
