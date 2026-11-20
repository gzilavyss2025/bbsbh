// Every dollar in the app reads in millions, deliberately, even when the league
// total runs to billions: a reader compares a club's payroll to a position's
// spend to one player's salary in the same glance, and three different units
// would make that arithmetic something you do rather than something you see.
// Under a million the millions form loses the number entirely ($0.8M for a
// league-minimum deal), so those read in thousands — the same way a scorebook
// and Cot's both write them.
//
// The `<data value>` wrapper carries the exact figure for anything reading the
// page rather than looking at it, with the full dollars on hover.
import { moneyLabel } from '../../lib/format.js'

export { moneyLabel }

const exact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
function exactMoney(value) {
  return value == null || !Number.isFinite(value) ? '—' : exact.format(value)
}

export function Money({ value }) {
  if (value == null || !Number.isFinite(value)) return '—'
  return (
    <data value={value} title={exactMoney(value)}>
      {moneyLabel(value)}
    </data>
  )
}
