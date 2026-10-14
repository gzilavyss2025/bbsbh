// "Wed Oct 14": the date as the fact strip prints it. `iso` is a calendar date (YYYY-MM-DD).
export function shortDate(iso) {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).replace(',', '')
}

// "Dodger Stadium" from "UNIQLO Field at Dodger Stadium": a sponsor's name for the park is
// dropped when the venue is written "<sponsor> at <park>". Any other name stays whole.
export function parkShort(venue) {
  if (!venue) return ''
  const parts = venue.split(' at ')
  return parts.length > 1 ? parts[parts.length - 1].trim() : venue
}
