// Which names the history lines show (ADR-0100). One fixed rule, no random choice:
// newest birth or debut year first, then name. A missing year sorts last.
export const pickPeople = (list, cap) =>
  [...(list ?? [])]
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (a.name ?? '').localeCompare(b.name ?? ''))
    .slice(0, cap)

// A ballpark's venue.location -> { lat, lon } for api/history/birthplaces.js, or null.
// The feed carries the park's map point in defaultCoordinates (checked against
// gamePk 823570, Citi Field). A placeholder venue has none, and gets no line.
export function parkPoint(location) {
  const lat = location?.defaultCoordinates?.latitude
  const lon = location?.defaultCoordinates?.longitude
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
}
