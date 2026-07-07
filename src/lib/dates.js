// Date helpers. The MLB schedule endpoint expects YYYY-MM-DD in the park's
// local sense, but for slate selection the user's local date is close enough.

export function toApiDate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(date, n) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + n)
  return copy
}

// "Fri, Jul 5" style label for the slate header.
export function humanDate(apiDate) {
  const [y, m, d] = apiDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// "Fri, June 12, 2026" — the full date line the scorebook header wants, so it
// can be copied straight onto the sheet. Same parse as humanDate; returns ''
// for a missing/garbled date (thin MiLB feeds) so callers show the usual "—".
export function scorebookDate(apiDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(apiDate ?? '')) return ''
  const [y, m, d] = apiDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
