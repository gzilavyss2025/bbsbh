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
