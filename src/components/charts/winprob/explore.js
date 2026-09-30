// Pure exploration helpers over already revealed chart input.
export function nearestWinProbEvent(fraction, count) {
  // Never select the chart's synthetic origin.
  return Math.max(0, Math.min(count - 1, Math.round(fraction * count) - 1))
}
// `final`: the point is the last play of a finished game, which reads as the
// result rather than as one more play. It keeps its change: the decisive play
// is often the biggest swing.
export function winProbReadout(point, { final = false } = {}) {
  if (final) return { context: 'Final', delta: point.delta ?? null }
  const half = point.half === 'top' ? '▲' : '▼'
  const outs = point.outs == null ? '' : point.outs === 3 ? ' · Half over' : ` · ${point.outs} out${point.outs === 1 ? '' : 's'}`
  return { context: `${half}${point.inning}${outs}`, delta: point.delta ?? null }
}
// The club that gained on a play and by how much, in whole percent. A change
// that rounds to 0 names neither club.
export function winProbChangeLabel(delta, home, away) {
  const val = Math.round(Math.abs(delta))
  return val === 0 ? 'No change' : `${delta > 0 ? home : away} +${val}%`
}
// A click within `tolerance` (a fraction of the plot width) of a big-swing
// marker selects that marker's play; anything else, the nearest play. A
// marker for play idx sits at (idx + 1) / count, past the synthetic origin.
export function snapToMarker(fraction, count, markers, tolerance) {
  let best = null
  for (const idx of markers) {
    const off = Math.abs(fraction - (idx + 1) / count)
    if (off <= tolerance && (best == null || off < best.off)) best = { idx, off }
  }
  return best ? best.idx : nearestWinProbEvent(fraction, count)
}
// A touch on the chart selects only once it moves sideways past the slop; a
// mostly vertical move is the page scrolling, which the chart must not follow.
const TOUCH_SLOP = 8
export function touchIntent(dx, dy) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < TOUCH_SLOP) return 'pending'
  return Math.abs(dx) > Math.abs(dy) ? 'drag' : 'scroll'
}
// A picked play holds only while the play count holds: a reveal or a live poll
// that adds plays drops the pick, so the chart shows the latest play again.
export function followLatest(state, count) {
  return state.count === count ? state : { count, idx: null }
}
// Focus that lands within this many ms of a pointer down on the slider came
// from that pointer (a click's own focus(), or the browser's focus on a tap).
// Any other focus (Tab, Shift+Tab) is keyboard focus and keeps its ring. A
// pointer down that never led to focus goes stale after the window.
export const POINTER_FOCUS_MS = 500
export function focusInput(pointerDownAt, now) {
  return pointerDownAt != null && now - pointerDownAt <= POINTER_FOCUS_MS ? 'pointer' : 'key'
}
