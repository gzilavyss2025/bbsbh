// The motion curves that JS reads (#2073). Each array is the control points of a
// token in src/tokens/effects.css, and test/motion-curves.test.js pins each pair
// together, so a change to a token cannot leave a tween behind. CSS reads the
// tokens. A requestAnimationFrame tween reads these.

// A CSS cubic-bezier as a function of progress: find the curve's parameter
// for x by bisection (the curve is monotonic in x), then return its y.
// Twenty halvings put x within 1e-6, finer than a pixel on any scroll.
// Moved here from lib/scorecard/glide.js, which re-exports it.
export function cubicBezier(x1, y1, x2, y2) {
  const at = (p1, p2, s) => 3 * p1 * s * (1 - s) ** 2 + 3 * p2 * s ** 2 * (1 - s) + s ** 3
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0
    let hi = 1
    for (let i = 0; i < 20; i += 1) {
      const mid = (lo + hi) / 2
      if (at(x1, x2, mid) < x) lo = mid
      else hi = mid
    }
    return at(y1, y2, (lo + hi) / 2)
  }
}

// --ease-stamp: a fast drop that settles with no overshoot. The stamp-in, the
// press, and new motion on the player page.
export const EASE_STAMP = [0.2, 0.9, 0.3, 1]
// --ease-unfold: softer at the end. A menu that folds to a rail, a panel that opens.
export const EASE_UNFOLD = [0.23, 1, 0.32, 1]

export const easeStamp = cubicBezier(...EASE_STAMP)
export const easeUnfold = cubicBezier(...EASE_UNFOLD)

// The canvas's `eo` (ArsenalReveal) and `easeOut` (PitchFlight): a quartic
// ease-out, clamped to [0, 1]. It has no token, because no CSS reads it.
export const easeOutQuart = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 4
