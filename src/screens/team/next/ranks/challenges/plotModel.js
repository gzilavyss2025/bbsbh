// THE FACE PLOT'S GEOMETRY — what the card's chart draws, as pure numbers.
//
// A marker is a player's face. The plot puts one face per qualified player
// (plus the MLB average) where two figures meet: for the Called view, the
// pitches he saw (or received) across and the reviews he called up; for the
// Success view, the reviews he called across and the share he won up. This file
// owns the scales, the tick choice, the outlier cap, the spreading of faces
// that would stack, and the place of the name tab. The component only paints
// what comes out, so every rule here is checked without a DOM.
//
// THE AXIS IS CAPPED FOR ONE OUTLIER, AND SAYS SO. One hitter called 37 reviews
// while the next most eager called 15. Scaled to 37, the other thirteen are
// squeezed into the bottom third of the plot. With five or more faces, a man
// past 1.6 times the runner-up is pinned to the top edge (`off`) instead, and
// the legend names the pin. His row and name tab still print the true figure.
//
// SPREADING MOVES THE FACE, NEVER THE FIGURE. A cluster of faces is pushed
// apart until none overlaps, and each moved face keeps a thin leader and a dot
// at its true place (the component draws both from `tx`/`ty`).

// The face's side in pixels. challenge-faces.css sets the same number as
// --chalplot-face; test/abs-challenge-plot.test.js pins the two together.
export const FACE_SIZE = 32

const STEPS = [1, 2, 2.5, 5, 10]

// The smallest round step (1, 2, 2.5, 5 times a power of ten) at or above `raw`.
export function niceStep(raw) {
  if (!(raw > 0)) return 1
  const mag = 10 ** Math.floor(Math.log10(raw))
  return STEPS.map((m) => m * mag).find((s) => s >= raw - 1e-9) ?? mag * 10
}

// Ticks at every multiple of `step` above `from` up to and including `to`.
export function ticksBetween(from, to, step) {
  const out = []
  for (let v = Math.floor(from / step) * step + step; v <= to + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6)
  return out
}

// "1k", "15k", "250". Axis labels are short; the list holds the exact figure.
export function tickLabel(v) {
  return v >= 1000 ? `${Math.round(v / 100) / 10}k`.replace('.0k', 'k') : String(v)
}

function xDomain(values, count) {
  const max = Math.max(...values, 1)
  const step = niceStep(max / count)
  const x1 = Math.ceil((max * 1.0001) / step) * step
  const min = Math.min(...values)
  // Start the axis at zero unless every face sits far from it: then drop to the
  // half-step under the lowest, so the left quarter of the plot is not empty.
  const half = step / 2
  const x0 = min > x1 * 0.25 ? Math.floor((min * 0.7) / half) * half : 0
  return { x0, x1, step }
}

function yDomain(values, count) {
  const sorted = [...values].sort((a, b) => b - a)
  const top = sorted[0] ?? 1
  const capped = sorted.length >= 5 && top > sorted[1] * 1.6
  const raw = (capped ? sorted[1] * 1.2 : top * 1.05) || 1
  const step = niceStep(raw / count)
  return { y1: Math.ceil(raw / step) * step, step, capped }
}

// The whole plot for one job and one measure.
//   job     a `challengeCard(...)` job model (rows, average, league, basis)
//   measure 'called' or 'success'
// Returns the scales, the ticks, the line, the faces (`points`), and the MLB
// average (`average`), all in DATA units; the component maps them to pixels.
export function buildPlot(job, measure) {
  const success = measure === 'success'
  const few = job.plotted.length < 5
  const count = few ? 3 : 4
  const rows = success ? job.plotted.filter((r) => r.pct != null) : job.plotted
  const avg = job.average

  const xs = rows.map((r) => (success ? r.calls : r.exposure))
  if (avg) xs.push(success ? avg.calls : avg.exposure)
  const xd = xDomain(xs.length ? xs : [1], count)

  let y1 = 100
  let yt = [25, 50, 75, 100]
  let capped = false
  if (!success) {
    const yd = yDomain(rows.map((r) => r.calls).concat(avg ? [avg.calls] : []), count)
    y1 = yd.y1
    yt = ticksBetween(0, y1, yd.step)
    capped = yd.capped
  }

  const points = rows.map((r) => {
    const x = success ? r.calls : r.exposure
    const y = success ? r.pct * 100 : r.calls
    return { row: r, x, y, over: success ? r.pct > job.league.success : r.over, thin: success && r.calls < 5, off: capped && y > y1 }
  })

  const leagueSuccess = job.league.success
  return {
    measure,
    few,
    x0: xd.x0,
    x1: xd.x1,
    xt: ticksBetween(xd.x0, xd.x1, xd.step),
    y1,
    yt,
    // The line a man sits on if he argues (or wins) at exactly the league's pace.
    line: success ? { flat: leagueSuccess * 100 } : { slope: job.league.frac },
    points,
    average: avg
      ? { x: success ? avg.calls : avg.exposure, y: success ? (leagueSuccess ?? 0) * 100 : avg.calls }
      : null,
    legend: { thin: points.some((p) => p.thin), off: points.some((p) => p.off) },
    xTitle: success ? 'Reviews called' : job.exposureTitle,
    yTitle: success ? 'Overturned' : 'Reviews called',
  }
}

// The faces' pixel places. `nodes` carry the true place (tx, ty); the result
// has x, y moved until no two centres are closer than `size + 1`, clamped to
// `bounds` (minX, maxX, minY, maxY). Deterministic: the same input gives the
// same picture on every render.
export function spread(nodes, { size, bounds, passes = 200 }) {
  const out = nodes.map((n) => ({ ...n, x: n.tx, y: n.ty }))
  const minDist = size + 1
  const clamp = (n) => {
    n.x = Math.min(bounds.maxX, Math.max(bounds.minX, n.x))
    n.y = Math.min(bounds.maxY, Math.max(bounds.minY, n.y))
  }
  const push = () => {
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]
        const b = out[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let d = Math.hypot(dx, dy)
        if (d >= minDist) continue
        if (d < 0.01) {
          dx = 1
          dy = 0.2
          d = Math.hypot(dx, dy)
        }
        const half = (minDist - d) / 2
        a.x -= (dx / d) * half
        a.y -= (dy / d) * half
        b.x += (dx / d) * half
        b.y += (dy / d) * half
      }
    }
  }
  // Push apart, with a gentle pull home so a face does not wander off its place.
  for (let pass = 0; pass < passes; pass++) {
    push()
    for (const n of out) {
      n.x += (n.tx - n.x) * 0.03
      n.y += (n.ty - n.y) * 0.03
      clamp(n)
    }
  }
  // Then settle with no pull, so the last move can only separate.
  for (let pass = 0; pass < 60; pass++) {
    push()
    for (const n of out) clamp(n)
  }
  return out
}

// Where the name tab of the picked face goes: above, right, left, then below,
// the first spot inside the plot that covers no other face (and never the
// picked face itself). The least-bad spot when every one is blocked.
export function tabPlacement(node, others, { tabWidth, tabHeight = 26, size, gap = 6, width, height, minX = 0 }) {
  const half = size / 2
  const clampX = (x) => Math.min(width - tabWidth - 2, Math.max(minX, x))
  const spots = [
    { x: node.x - tabWidth / 2, y: node.y - half - tabHeight - gap },
    { x: node.x + half + gap, y: node.y - tabHeight / 2 },
    { x: node.x - half - gap - tabWidth, y: node.y - tabHeight / 2 },
    { x: node.x - tabWidth / 2, y: node.y + half + gap },
  ].map((s) => ({ ...s, x: clampX(s.x) }))
  const covers = (s, o) => o.x + half > s.x && o.x - half < s.x + tabWidth && o.y + half > s.y && o.y - half < s.y + tabHeight
  const cost = (s) => (covers(s, node) ? 99 : 0) + others.filter((o) => covers(s, o)).length + (s.y < -4 || s.y + tabHeight > height ? 50 : 0)
  return spots.reduce((best, s) => (cost(s) < cost(best) ? s : best))
}
