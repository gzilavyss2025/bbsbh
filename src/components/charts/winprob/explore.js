// Pure exploration helpers over already revealed chart input.
export function nearestWinProbEvent(fraction, count) {
  // Never select the chart's synthetic origin.
  return Math.max(0, Math.min(count - 1, Math.round(fraction * count) - 1))
}
export function winProbReadout(point) {
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
