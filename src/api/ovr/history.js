// Pure readers of one player's OVR history (docs/ovr-rating.md, "Rating changes over
// time"). A snapshot is { date: 'YYYY-MM-DD', ovr, bars, seeded }. `seeded` marks a
// prospect-trend percentile that stands in for a rating until a real snapshot exists.
// Spoiler-free: season rating figures, no game result (ADR-0034).

const epochDay = (date) => Date.parse(date) / 864e5
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)

// { delta, from, to } from the newest snapshot back to the newest one at least `days`
// older, or null. Measured against the newest snapshot, not a clock. null too when one
// end is seeded and the other is not: a percentile and a rating are not one scale.
export function changeSince(snapshots, days = 7) {
  const sorted = [...snapshots].sort(byDate)
  const to = sorted.at(-1)
  const from = to && sorted.findLast((s) => epochDay(to.date) - epochDay(s.date) >= days)
  if (!from || from.seeded !== to.seeded) return null
  return { delta: to.ovr - from.ovr, from, to }
}

// One calendar year's snapshots, in date order.
export const seasonSeries = (snapshots, season) =>
  snapshots.filter((s) => s.date.startsWith(String(season))).sort(byDate)
