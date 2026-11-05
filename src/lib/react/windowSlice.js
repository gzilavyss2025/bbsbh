// Which rows of a fixed-height list to draw: the visible ones plus `buffer` each side.
// Pure. Unmeasured geometry (rowH 0) draws a first screenful (the box is five rows
// tall) plus the buffer, never NaN.
const SCREENFUL = 5

export function windowSlice({ scrollTop, viewH, rowH, total, buffer }) {
  if (!(rowH > 0)) return { start: 0, end: Math.min(total, SCREENFUL + buffer) }
  const first = Math.min(Math.floor(scrollTop / rowH), Math.max(total - 1, 0))
  const last = Math.ceil((scrollTop + viewH) / rowH)
  return { start: Math.max(0, first - buffer), end: Math.min(total, last + buffer) }
}
