// The ribbon's win-chance line for one finished game (ADR-0087): `wp` is the
// home club's win chance, 0-100, at most 26 points (slice 1's game shape). The
// line is drawn from one club's side: `flip` is true when that club was away.
// Returns SVG point strings in a w x h box (high chance = top), the share above
// the middle line and the share below it as two fills (closed along the middle).
// Null when there is no line to draw (the degrade convention).
const pt = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`

export function wpSpark(wp, { flip = false, w = 100, h = 26 } = {}) {
  if (!Array.isArray(wp) || wp.length < 2 || !wp.every(Number.isFinite)) return null
  const mid = h / 2
  const pts = wp.map((p, i) => ({ x: (i / (wp.length - 1)) * w, y: (1 - (flip ? 100 - p : p) / 100) * h }))
  const trace = (clamp) => pts.map(({ x, y }) => pt(x, clamp(y))).join(' ')
  const closed = (clamp) => `${trace(clamp)} ${pt(w, mid)} ${pt(0, mid)}`
  return { line: trace((y) => y), up: closed((y) => Math.min(y, mid)), down: closed((y) => Math.max(y, mid)) }
}
