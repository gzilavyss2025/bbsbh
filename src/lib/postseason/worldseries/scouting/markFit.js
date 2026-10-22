// MARK FIT: a club mark is drawn inside a square, but each file carries its own empty margin, so
// two marks of the same box read at different sizes. The Roster card's club tabs measure the
// visible part of each mark (its alpha box) and scale it so the longer side fills the box. Pure:
// the canvas read is in cards/scouting/ClubMark.jsx.

// The alpha box of an RGBA grid, as fractions of the grid: { x0, y0, x1, y1 }. Null when nothing
// is visible. `data` is a Uint8ClampedArray, `w` by `h` pixels.
export function visibleBox(data, w, h, alphaMin = 24) {
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < alphaMin) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  if (x1 < 0) return null
  return { x0: x0 / w, y0: y0 / h, x1: (x1 + 1) / w, y1: (y1 + 1) / h }
}

// The CSS transform that centres the box in its square and scales the longer side to fill it.
// Null for no box, or a box too thin to trust (a stray pixel).
export function fitTransform(box, minSide = 0.15) {
  if (!box) return null
  const cw = box.x1 - box.x0
  const ch = box.y1 - box.y0
  const longest = Math.max(cw, ch)
  if (longest < minSide) return null
  const tx = (0.5 - (box.x0 + box.x1) / 2) * 100
  const ty = (0.5 - (box.y0 + box.y1) / 2) * 100
  const round = (n) => Math.round(n * 100) / 100
  return `scale(${round(1 / longest)}) translate(${round(tx)}%, ${round(ty)}%)`
}
