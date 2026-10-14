// Play through the Contact balls (#2073): the order, the steps, and the season timeline.
// Pure. The flight itself is contactFlight.js; this decides which ball flies next.

export const DWELL_MS = 1150 // the rest after a ball lands, before the next one flies
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_MS = 86400000
const dayOf = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}

// The marks in season order, the order they play in (and drop in, slice 17a). Stable: two
// balls on one day keep their order. A ball with no date goes last.
export function byDate(marks) {
  return marks
    .map((m, i) => [m, i])
    .sort(([a, i], [b, j]) => (a.b.date ?? '9999').localeCompare(b.b.date ?? '9999') || i - j)
    .map(([m]) => m)
}

// The timeline, first to last ball date: pos(date) is 0-100, months are the first of each
// month between, with their place. Null with no dates.
export function seasonAxis(dates) {
  const days = dates.filter(Boolean).map(dayOf)
  if (!days.length) return null
  const d0 = Math.min(...days)
  const d1 = Math.max(...days)
  const span = d1 - d0
  const pos = (s) => (s && span ? Math.min(100, Math.max(0, ((dayOf(s) - d0) / span) * 100)) : 0)
  const months = []
  if (span) {
    const first = new Date(d0 * DAY_MS)
    let y = first.getUTCFullYear()
    let m = first.getUTCMonth() + 1
    for (;;) {
      if (m > 11) {
        y += 1
        m = 0
      }
      const d = Date.UTC(y, m, 1) / DAY_MS
      if (d > d1) break
      months.push({ t: MONTHS[m], l: ((d - d0) / span) * 100 })
      m += 1
    }
  }
  return { pos, months }
}

// Play starts at the ball after the current one; from the first when none is picked or
// the last one is.
export const playStart = (i, n) => (i < 0 || i >= n - 1 ? 0 : i + 1)
// After a ball's rest: the next index, or null when the run ends.
export const afterDwell = (i, n) => (i < n - 1 ? i + 1 : null)
// A ball not played yet in this run.
export const isAhead = (i, cur, playing) => playing && i > cur
// The ball whose tick is nearest the scrubber value (0-100).
export function nearestBall(positions, v) {
  let best = 0
  positions.forEach((p, i) => {
    if (Math.abs(p - v) < Math.abs(positions[best] - v)) best = i
  })
  return best
}
export const counter = (i, n) => (i < 0 ? `${n} ${n === 1 ? 'ball' : 'balls'}` : `${i + 1} of ${n}`)
