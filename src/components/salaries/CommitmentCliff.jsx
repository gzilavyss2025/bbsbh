import { moneyLabel } from './Money.jsx'

// One bar per season the source covers, drawn against the tallest of them. This
// is the club ledger's headline graphic and the reason the page exists: a book
// that empties in three years and a book that runs to 2030 look nothing alike,
// and the difference is a shape long before it is a subtraction.
//
// Its own card rather than only the grid's header row, because the grid has to
// scroll sideways on a phone and the shape must not scroll with it.
export function CommitmentCliff({ totals, scale }) {
  if (!totals?.length) return null
  const max = scale || Math.max(1, ...totals.map((entry) => entry.committed))
  return (
    <div className="cliff">
      <div className="metricbar">
        <span className="metricbar__title">The commitment cliff</span>
      </div>
      <div className="cliff__row">
        {totals.map((entry) => (
          <div key={entry.year} className="cliff__col">
            <span className="cliff__value">{moneyLabel(entry.committed)}</span>
            <span className="cliff__track">
              {/* Percentage height, not a class per bucket: the bar IS the
                  number, so rounding it to a step would be drawing a different
                  figure than the one printed above it. */}
              <span className="cliff__bar" style={{ height: `${(entry.committed / max) * 100}%` }} />
            </span>
            <span className="cliff__year">{entry.year}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
