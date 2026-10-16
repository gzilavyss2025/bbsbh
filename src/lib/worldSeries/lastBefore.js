// Every World Series history lookup goes through here (ADR-0087): rows dated
// strictly before `before`, newest first. A missing or malformed `before`
// throws, so a caller can never fall open to "all history".
const ISO = /^\d{4}-\d{2}-\d{2}$/

export function lastBefore(rows, { before, tag, filter } = {}) {
  if (typeof before !== 'string' || !ISO.test(before)) {
    throw new Error('lastBefore: `before` must be an ISO date (YYYY-MM-DD)')
  }
  return rows
    .filter((r) => r.date < before && (!tag || r.tag === tag) && (!filter || filter(r)))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
