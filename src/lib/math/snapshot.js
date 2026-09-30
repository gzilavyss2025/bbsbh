// The value of the latest dated entry at or before a cutoff, or null. Pure:
// `snapshots` is a { 'YYYY-MM-DD': value } map and `cutoff` a 'YYYY-MM-DD'
// string (ISO dates compare as plain strings). No cutoff means no limit. The
// CALLER decides which cutoff is spoiler-safe; this only applies it.
export function latestAtOrBefore(snapshots, cutoff) {
  const dates = Object.keys(snapshots).filter((date) => !cutoff || date <= cutoff).sort()
  return dates.length ? snapshots[dates[dates.length - 1]] : null
}
