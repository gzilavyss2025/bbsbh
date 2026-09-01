// THE DAY STRIP, AND THE REST RAIL UNDER IT.
//
// One cell a calendar day, shaded by what the pitcher threw (api/workload.js's
// LOAD_BANDS — the app's OWN tired thresholds, 25 and 35, so a cell's shade and
// the Bullpen Board's verdict can never tell different stories about one
// outing). TODAY IS NEVER SPENT: the file holds completed appearances only and
// he may still pitch tonight, so the last cell is dashed and carries no load.
//
// THE RAIL is the addition. A bar joins days worked BACK TO BACK — hairline at
// two, solid at three or more, where the rule stops counting flags and files an
// arm as down outright. Without it the strip cannot show its own sharpest
// signal: three light outings on three straight days shade exactly like three
// light outings across a fortnight, while the board calls the first man down
// and the second fresh.
//
// The row is a CSS grid rather than a flex row so the rail can be placed by
// GRID COLUMN — `grid-column: start / span len` covers the cells and the gaps
// between them with no pixel arithmetic, at any cell width, on any strip
// length. Rail runs come from restRunsFor; the caller passes them in so the
// staff grid computes them once a row instead of once a render.
export function DayStrip({ cells, runs = [], label, size = 'md' }) {
  if (!cells || cells.length === 0) return null
  const cols = `repeat(${cells.length}, minmax(0, 1fr))`
  return (
    <div
      className={`daystrip daystrip--${size}`}
      style={{ gridTemplateColumns: cols }}
      role="img"
      aria-label={label ?? stripLabel(cells, runs)}
    >
      {cells.map((c) => (
        <span
          key={c.date}
          className={`daystrip__day daystrip__day--${c.band}${c.today ? ' daystrip__day--today' : ''}`}
          aria-hidden="true"
        >
          {c.pitches ?? ''}
        </span>
      ))}
      {runs.map((r) => (
        <span
          key={r.start}
          className={`daystrip__rail${r.len >= 3 ? ' daystrip__rail--hard' : ''}`}
          style={{ gridColumn: `${r.start + 1} / span ${r.len}` }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

// What a screen reader gets instead of the drawing: the outings, then the runs.
// The cells carry no `title` — a hover tooltip is invisible on the phone this
// app is built for, and the pitch count is already printed in the cell.
function stripLabel(cells, runs) {
  const worked = cells.filter((c) => c.pitches != null)
  const head = worked.length === 0
    ? 'No appearances over this stretch'
    : `${worked.length} appearance${worked.length === 1 ? '' : 's'}, ${worked.reduce((a, c) => a + c.pitches, 0)} pitches`
  const longest = runs.reduce((a, r) => Math.max(a, r.len), 0)
  return longest >= 2 ? `${head}; ${longest} days in a row` : head
}

// The three shades and the rail, named. Wherever a strip leads a surface it
// needs this once — never once a strip.
export function DayStripKey() {
  return (
    <ul className="daystrip-key">
      <li>
        <span className="daystrip-key__swatch daystrip-key__swatch--light" aria-hidden="true" />
        <span>Light</span>
      </li>
      <li>
        <span className="daystrip-key__swatch daystrip-key__swatch--moderate" aria-hidden="true" />
        <span>25+</span>
      </li>
      <li>
        <span className="daystrip-key__swatch daystrip-key__swatch--heavy" aria-hidden="true" />
        <span>35+</span>
      </li>
      <li>
        <span className="daystrip-key__rail" aria-hidden="true" />
        <span>Days in a row</span>
      </li>
    </ul>
  )
}
