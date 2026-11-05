// Which rows of a fixed-height list to draw: the visible ones plus `buffer` each side.
// Pure. Unmeasured geometry (rowH or viewH 0) draws the first `buffer` rows, never NaN.
export function windowSlice({ scrollTop, viewH, rowH, total, buffer }) {
  if (!(rowH > 0)) return { start: 0, end: Math.min(total, buffer) }
  const first = Math.min(Math.floor(scrollTop / rowH), Math.max(total - 1, 0))
  const last = Math.ceil((scrollTop + viewH) / rowH)
  return { start: Math.max(0, first - buffer), end: Math.min(total, last + buffer) }
}
