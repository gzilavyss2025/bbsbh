// A "which bases are occupied" diamond for compact game-state widgets (the
// Foul Tracker's PA-highs scorebug). Deliberately its OWN component rather
// than reusing DiamondGlyph (the app's brand mark, which also doubles as a
// base-occupancy indicator) — dropped into a dense data widget, DiamondGlyph's
// bright --field green and rotated-square dots read as a logo/sticker, not a
// scorekeeping notation. This instead borrows PlayDiamond's actual scorebook
// language (a quiet graphite ghost diamond, occupied marks penciled solid
// ink) so it reads as a notation mark, not a game-UI badge. Home plate isn't
// marked — it's the diamond's 4th vertex, never a "runner" position that
// varies here.
export function BaseoutDiamond({ bases = [false, false, false], size = 30 }) {
  const s = size
  const c = s / 2
  const r = s * 0.42
  const pts = {
    home: [c, c + r],
    first: [c + r, c],
    second: [c, c - r],
    third: [c - r, c],
  }
  const dotR = s * 0.1
  const mark = (key, on) => (
    <circle
      cx={pts[key][0]}
      cy={pts[key][1]}
      r={dotR}
      fill={on ? 'var(--ink-1)' : 'var(--paper-2)'}
      stroke={on ? 'var(--ink-1)' : 'var(--rule)'}
      strokeWidth={s * 0.035}
    />
  )
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
      <polygon
        points={`${pts.home} ${pts.first} ${pts.second} ${pts.third}`}
        fill="none"
        stroke="var(--rule)"
        strokeWidth={s * 0.045}
        strokeLinejoin="round"
      />
      {mark('first', bases[0])}
      {mark('second', bases[1])}
      {mark('third', bases[2])}
    </svg>
  )
}
