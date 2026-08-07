import '../../styles/26a-percentile-strip.css'
import { useState } from 'react'
import { deviationBar, dotFraction } from '../../lib/percentileStrip.js'

const DASH = '—'

// STATCAST — the season percentile strip. One shared 0–100 axis, one ruled row
// per metric: the measure, the raw rate behind it, a dot at the player's rank,
// and the rank itself. All scale math comes from the pure, unit-tested
// lib/percentileStrip.js; this file only turns fractions into CSS custom
// properties.
//
// No chart library, deliberately — the app has none, and a strip is a list of
// rows. Plain DOM rather than the SVG the radar needed means the labels and
// numbers ARE the design system's type, not text drawn at a viewBox's mercy.
//
// WHAT THE READER GETS THAT THE RADAR COULDN'T GIVE THEM (ADR-0040):
//
//   - Every metric, not five of them. Rows are independent, so nothing has to
//     be cut to keep a shape legible.
//   - One reading of "how good is this". Position along a common scale is the
//     encoding people decode most accurately; a polygon's area grows as the
//     square of the quantity, so an 80th-percentile player looked more than
//     twice as good as a 40th.
//   - A stable layout. Row three is the same metric on every player's page.
//   - Both numbers on one line, in their own columns. The radar printed the
//     RAW rate at a spoke whose LENGTH was the percentile — two scales in one
//     graphic, with nothing saying so, and for a "lower is better" metric they
//     ran in opposite directions.
//
// ACCESSIBILITY. Unlike the radar, this is not decorative and is not
// aria-hidden: every row is real text in reading order (measure, raw rate,
// rank), so a screen reader gets the table without needing a parallel card
// grid built for it. Only the track — the ruled line, the deviation bar and
// the dot — is aria-hidden, because the rank it draws is printed beside it.
//
// The seal amber is deliberately not used anywhere in here — that ink is
// reserved for score covers (CLAUDE.md's spoiler rule), and this is
// spoiler-free season aggregate data.
// No axis caption and no footnote: the strip carries its own reading. The
// league-average rule is drawn as a pencilled reference line, every dot sits
// visibly left or right of it, and each row prints its own rank in figures —
// so there is nothing left for a line of prose to add. The radar this replaced
// had no caption either; this is parity, not a subtraction.
export function PercentileStrip({ rows }) {
  if (!rows?.length) return null

  return (
    <ul className="pctstrip">
      {rows.map((row) => (
        <StripRow key={row.key} row={row} />
      ))}
    </ul>
  )
}

function StripRow({ row }) {
  const [open, setOpen] = useState(false)
  const { label, value, percentile, lowerIsBetter, def } = row
  const bar = deviationBar(percentile)
  const dot = dotFraction(percentile)
  if (bar == null) return null

  // The visible row is four aligned columns, which is right to LOOK at and
  // wrong to LISTEN to — "xwOBA .380 95" says neither what .380 is nor what 95
  // is. So the row carries its own prose name and the columns are hidden from
  // the accessibility tree, rather than each column trying to caption itself.
  const spoken = [
    `${label}:`,
    value != null ? `${value},` : null,
    `${percentile}th percentile`,
    lowerIsBetter ? '(a lower rate is better; the rank accounts for it)' : null,
    open ? `— ${def}` : '— tap for definition',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li className="pctstrip__row">
      <button
        type="button"
        className="pctstrip__btn"
        aria-expanded={open}
        aria-label={spoken}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pctstrip__label" aria-hidden="true">
          {label}
          {lowerIsBetter && (
            <span className="pctstrip__downMark">
              {' '}
              ↓
            </span>
          )}
        </span>

        <span className="pctstrip__value" aria-hidden="true">
          {value ?? DASH}
        </span>

        <span className="pctstrip__track" aria-hidden="true">
          <span
            className={`pctstrip__bar pctstrip__bar--${bar.side}`}
            style={{ '--start': bar.start, '--width': bar.width }}
          />
          <span className="pctstrip__dot" style={{ '--pct': dot }} />
        </span>

        <span className="pctstrip__rank" aria-hidden="true">
          {percentile}
        </span>
      </button>

      {open && (
        <p className="pctstrip__def" aria-hidden="true">
          {def}
        </p>
      )}
    </li>
  )
}
