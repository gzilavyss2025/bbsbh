// The same words the old Contracts tab's source line carried, so a reader who
// picked a date on this page learns the book did not move with it (ADR-0082).
export const MONEY_NOTE =
  'A season’s book, not a day’s — these figures do not move with a date. Pre-arbitration figures are estimates.'

// The four tiles, payroll first and the lead. Shapes for StatTile; the rank reads "22 of 30".
// `fmt` is the dollar formatter (moneyLabel), passed in so this file stays plain JS.
export function moneyTiles({ ledger, standing, clubCount }, fmt) {
  const { season, counts, years } = ledger
  return [
    {
      label: `${season} payroll`,
      value: fmt(ledger.payroll),
      lead: true,
      ...(standing ? { rank: { rank: standing.rank, of: clubCount } } : { caption: `${ledger.totals[0]?.players ?? 0} players` }),
    },
    { label: `Committed after ${season}`, value: fmt(ledger.committedAfter), caption: `Through ${years[years.length - 1]}` },
    { label: 'Option years', value: String(counts.option), caption: 'Not yet exercised' },
    { label: 'Arbitration years', value: String(counts.arbitration), caption: 'Figure not yet set' },
  ]
}

// The jump-bar badge: players on the book. The audit sets no Money count, so this is the
// count the loader already holds; nothing is fetched for it.
export const moneyCount = (data) => data?.ledger?.totals?.[0]?.players
