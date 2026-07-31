// The scorebug's base-occupancy indicator: three individually-outlined
// rotated squares (one per base — no home plate shape, it isn't a base a
// runner occupies), white-bordered with a transparent interior, filling
// solid white when a runner currently stands there. Deliberately its OWN
// small geometry rather than reusing PlayDiamond's HOME/FIRST/SECOND/THIRD
// constants — PlayDiamond draws one play's traveled base PATH on a 0–100
// viewBox sized for the play-by-play card; this is a different enough shape
// (three discrete squares, not one continuous outline) that reusing its
// coordinate space would only add indirection with no shared code.
//
// Each square's near corner stops just short of the shared center (a small
// gap, so the three read as distinct shapes rather than one overlapping
// blob) and its far corner reaches the same vertex the old single-outline
// diamond used, so the three together read as one diamond silhouette
// filling the same footprint — rather than sitting as small dots inside a
// mostly-empty outline.
const BASE_SIZE = 7.3
const REACH = 7.6 // center-to-center distance from the shared middle
const CENTER = { second: [17, 17 - REACH], first: [17 + REACH, 17], third: [17 - REACH, 17] }

function BaseSquare({ cx, cy, filled }) {
  const half = BASE_SIZE / 2
  return (
    <rect
      x={cx - half}
      y={cy - half}
      width={BASE_SIZE}
      height={BASE_SIZE}
      transform={`rotate(45 ${cx} ${cy})`}
      fill={filled ? 'var(--paper-3)' : 'transparent'}
      stroke="var(--paper-3)"
      strokeWidth="1.6"
    />
  )
}

export function BaseState({ bases = { first: false, second: false, third: false }, size = 32 }) {
  return (
    <svg
      className="gamehud__diamond"
      width={size}
      height={size}
      viewBox="0 0 34 34"
      aria-hidden="true"
    >
      <BaseSquare cx={CENTER.second[0]} cy={CENTER.second[1]} filled={bases.second} />
      <BaseSquare cx={CENTER.first[0]} cy={CENTER.first[1]} filled={bases.first} />
      <BaseSquare cx={CENTER.third[0]} cy={CENTER.third[1]} filled={bases.third} />
    </svg>
  )
}
