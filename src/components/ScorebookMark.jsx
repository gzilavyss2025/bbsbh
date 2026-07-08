// ScorebookMark — the app's brand mark: a hand-scored scorebook cell with its
// infield diamond shaded in pencil. It echoes the app icon (public/icons/icon.svg
// is a photo of the same drawn cell) and anchors the site identity next to the
// "Scorebook" wordmark. Drawn as vector so it stays crisp — and legible — down to
// the 14px footer mark, where a scan of the sketch would smudge.
//
// Below ~24px pass `simplified` to drop the cell's inner rules (the header bar
// and right-hand scoring columns) and keep just the bordered cell and its solid
// diamond centered, so the mark still reads clean at the small header/footer sizes
// (every current placement uses `simplified`). The full variant is the richer,
// large-format mark for the link-preview card and any future hero use.
export function ScorebookMark({
  size = 44,
  ink = 'var(--ink-1)',
  paper = 'var(--paper-2)',
  graphite = 'var(--graphite)',
  simplified = false,
  ...rest
}) {
  // The infield diamond: a square rotated 45°. Centered in the cell when
  // simplified; nudged down-left in the full variant to sit beside the scoring
  // columns, matching the sketch's composition.
  const cx = simplified ? 60 : 45
  const cy = simplified ? 60 : 73
  const d = simplified ? 26 : 22
  const diamond = `${cx},${cy - d} ${cx + d},${cy} ${cx},${cy + d} ${cx - d},${cy}`

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Scorebook" {...rest}>
      <rect
        x="14" y="14" width="92" height="92" rx="9"
        fill={paper} stroke={ink} strokeWidth={simplified ? 8 : 6}
      />
      {!simplified && (
        <g stroke={ink} strokeWidth="3">
          {/* header bar + the two narrow scoring columns down the right side */}
          <line x1="14" y1="40" x2="106" y2="40" />
          <line x1="76" y1="40" x2="76" y2="106" />
          <line x1="91" y1="40" x2="91" y2="106" />
        </g>
      )}
      <polygon
        points={diamond} fill={graphite} stroke={ink}
        strokeWidth={simplified ? 6 : 4} strokeLinejoin="round"
      />
    </svg>
  )
}
