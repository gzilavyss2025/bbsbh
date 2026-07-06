// The Scorekeeper brand mark: a baseball infield diamond drawn from tokens.
// Ships with the design system as the one house-drawn glyph (it doubles as a
// base-occupancy indicator). Here it anchors the app's identity in the header.
export function DiamondGlyph({
  size = 22,
  filled = false,
  bases = [false, false, false],
  color = 'var(--ink-1)',
  ...rest
}) {
  const s = size
  const c = s / 2
  const r = s * 0.44
  const pts = {
    home: [c, c + r],
    first: [c + r, c],
    second: [c, c - r],
    third: [c - r, c],
  }
  const dot = (x, y, on) => (
    <rect
      x={x - s * 0.07}
      y={y - s * 0.07}
      width={s * 0.14}
      height={s * 0.14}
      transform={`rotate(45 ${x} ${y})`}
      fill={on ? 'var(--field)' : 'var(--paper-2)'}
      stroke={color}
      strokeWidth={s * 0.03}
    />
  )
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" aria-hidden="true" {...rest}>
      <polygon
        points={`${pts.home} ${pts.first} ${pts.second} ${pts.third}`}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={s * 0.05}
        strokeLinejoin="round"
      />
      {dot(...pts.first, bases[0])}
      {dot(...pts.second, bases[1])}
      {dot(...pts.third, bases[2])}
      {dot(...pts.home, false)}
    </svg>
  )
}
