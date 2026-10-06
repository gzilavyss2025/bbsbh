// Which names the history lines show (ADR-0100). One fixed rule, no random choice:
// newest birth or debut year first, then name. A missing year sorts last.
export const pickPeople = (list, cap) =>
  [...(list ?? [])]
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (a.name ?? '').localeCompare(b.name ?? ''))
    .slice(0, cap)

// A ballpark's venue.location -> [city, place] for api/history/birthplaces.js, or null.
// The place is the full state name for a US park and the country for any other
// (the birthplace key's own rule). The match stays exact.
export function parkPlace(location) {
  const city = location?.city
  const place = location?.country === 'USA' ? location.state : location?.country
  return city && place ? [city, place] : null
}
