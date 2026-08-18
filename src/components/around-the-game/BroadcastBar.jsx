// The two chart primitives every report board shares: a bar drawn behind a
// number, and a month-by-month trend strip.
//
// WHY A BAR BEHIND THE NUMBER RATHER THAN BESIDE IT. A ranked table of thirty
// clubs is read by scanning the leftmost column and then the number; a bar in
// its own column makes the eye cross the row twice. Drawn as the cell's own
// background, the length is picked up in the same glance as the figure, which
// is exactly how a broadcast bar chart works and why they are drawn that way.
//
// The scale is the CALLER's, not the bar's. `min` defaults to zero, and a
// board whose interesting range starts well above zero (game length: every
// club is between 2:35 and 2:50, and a zero-based bar shows thirty identical
// bars) passes its own floor. That choice is a judgement about the data, so it
// belongs to the page that knows the data — but it is a judgement that can
// mislead, so every page using a non-zero floor says so in the caption.

// One bar cell. `value` is the number the bar is drawn from; `children` is
// what is PRINTED (often a formatted version of the same number).
export function BarCell({ value, min = 0, max, tone, children }) {
  const span = max - min
  const pct = span > 0 && value != null ? Math.max(0, Math.min(100, ((value - min) / span) * 100)) : 0
  return (
    <span className={`barcell${tone ? ` barcell--${tone}` : ''}`}>
      <span className="barcell__fill" style={{ width: `${pct}%` }} aria-hidden="true" />
      <span className="barcell__text">{children}</span>
    </span>
  )
}

// A club's month-by-month figures as a row of columns, scaled across the
// LEAGUE's range rather than its own — so two clubs' strips can be compared
// down the page, which is the whole reason the strip is on a table row instead
// of in its own card.
//
// `months` is the ordered list of month keys the board covers, `byMonth` this
// club's own map. A month the club did not play is drawn as a gap, not a zero.
export function TrendStrip({ months, byMonth, min, max, label }) {
  const span = max - min
  return (
    <span className="trendstrip" role="img" aria-label={label}>
      {months.map((m) => {
        const cell = byMonth?.[m]
        if (!cell || cell.avg == null) {
          return <span key={m} className="trendstrip__col trendstrip__col--none" />
        }
        const h = span > 0 ? Math.max(6, Math.min(100, ((cell.avg - min) / span) * 100)) : 6
        return (
          <span key={m} className="trendstrip__col">
            <span className="trendstrip__fill" style={{ height: `${h}%` }} />
          </span>
        )
      })}
    </span>
  )
}

// The three-way status meter The Pen uses: fresh / limited / down as one
// stacked bar, so a club's bullpen health is one shape rather than three
// numbers a reader has to add up.
export function StatusMeter({ fresh, limited, down, label }) {
  const total = fresh + limited + down
  if (!total) return null
  const w = (n) => `${(n / total) * 100}%`
  return (
    <span className="statusmeter" role="img" aria-label={label}>
      <span className="statusmeter__seg statusmeter__seg--fresh" style={{ width: w(fresh) }} />
      <span className="statusmeter__seg statusmeter__seg--limited" style={{ width: w(limited) }} />
      <span className="statusmeter__seg statusmeter__seg--down" style={{ width: w(down) }} />
    </span>
  )
}
