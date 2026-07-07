// BaseballMark — the app's brand mark: a baseball with accurate figure-eight
// "facing" seams (F1) and waxed-thread stitches. It anchors the site identity
// in the header (next to the "Scorebook" wordmark) and is the source drawing
// for the PWA app icon / favicon (see public/icons/icon.svg).
//
// Geometry is generated (bezier seams + laddered stitches) so it scales
// crisply. Below ~44px pass `simplified` to drop the fine stitches and bold the
// seams so the mark stays legible small.
export function BaseballMark({
  size = 44,
  ink = 'var(--ink-1)',
  cream = 'var(--paper-2)',
  seam = 'var(--clay)',
  simplified = false,
  ...rest
}) {
  const cx = 60, cy = 60, R = 44
  const L = [[cx - R * 0.6, cy - R * 0.74], [cx - R * 0.06, cy], [cx - R * 0.6, cy + R * 0.74]]
  const Rt = [[cx + R * 0.6, cy - R * 0.74], [cx + R * 0.06, cy], [cx + R * 0.6, cy + R * 0.74]]
  const seamPath = (p) => `M${p[0][0]},${p[0][1]} Q${p[1][0]},${p[1][1]} ${p[2][0]},${p[2][1]}`

  const qpt = (p0, p1, p2, t) => {
    const u = 1 - t
    return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]
  }
  const qtan = (p0, p1, p2, t) => {
    const u = 1 - t
    const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
    const dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
    const m = Math.hypot(dx, dy) || 1
    return [dx / m, dy / m]
  }

  function stitchEls(p, key) {
    const n = 9, len = 6, gap = 3.2, els = []
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, pt = qpt(p[0], p[1], p[2], t), d = qtan(p[0], p[1], p[2], t)
      const nx = -d[1], ny = d[0], ax = d[0], ay = d[1]
      const mk = (sx, sy) => ({
        x1: pt[0] - nx * gap + sx, y1: pt[1] - ny * gap + sy,
        x2: pt[0] + nx * gap + sx, y2: pt[1] + ny * gap + sy,
      })
      const a = mk(ax * len * 0.5, ay * len * 0.5), b = mk(-ax * len * 0.5, -ay * len * 0.5)
      els.push(<line key={key + 'a' + i} {...a} stroke={seam} strokeWidth="1.7" strokeLinecap="round" />)
      els.push(<line key={key + 'b' + i} {...b} stroke={seam} strokeWidth="1.7" strokeLinecap="round" />)
    }
    return els
  }

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Baseball" {...rest}>
      <circle cx={cx} cy={cy} r={R} fill={cream} stroke={ink} strokeWidth={simplified ? 7 : 4} />
      {simplified ? (
        <>
          <path d={seamPath(L)} fill="none" stroke={seam} strokeWidth="5" strokeLinecap="round" />
          <path d={seamPath(Rt)} fill="none" stroke={seam} strokeWidth="5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d={seamPath(L)} fill="none" stroke={seam} strokeWidth="1.4" opacity="0.55" />
          <path d={seamPath(Rt)} fill="none" stroke={seam} strokeWidth="1.4" opacity="0.55" />
          {stitchEls(L, 'l')}
          {stitchEls(Rt, 'r')}
        </>
      )}
    </svg>
  )
}
