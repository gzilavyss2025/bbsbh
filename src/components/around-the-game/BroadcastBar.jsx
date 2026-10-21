import '../../styles/report/charts.css'

// The chart primitives every report board shares: a bar drawn behind a number,
// a month-by-month trend strip, a three-way status meter, and — for the boards
// that ask a question no table row can answer — a column chart and a line chart
// with axes of their own.
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

// A BAR MEASURED FROM A BASELINE RATHER THAN FROM ZERO, drawn from the middle
// of the track outward: right in navy when the value is above the line, left in
// clay when it is below.
//
// WHY, AND WHEN IT IS WORTH IT. A plain bar answers "how big"; this one answers
// "more or less than usual", which is the only question some columns are asked.
// A plate umpire at 5.40 challenges a game means nothing until a reader holds
// 4.18 beside it, and a bar that starts at the league line says it in one
// glance. It earns the extra ink ONLY where both sides get used — a board whose
// view shows one end alone leaves half of every track empty and buys nothing
// over BarCell.
//
// `span` is the half-width: the distance from `center` that fills the track to
// its end. It is the caller's, for the same reason BarCell's `min` is — the
// judgement about which range matters belongs to the page that knows the data.
//
// NAVY AND CLAY, NOT A THREE-WAY HUE SPLIT. Clay against field green fails the
// colourblind check (delta-E 4.4 under protanopia) and clay against graphite is
// no better at 4.8. Navy against clay is the pair that survives it, and the
// direction is carried by the SIDE of the centre line as well as by the colour,
// so the bar still reads with no colour at all.
export function DivergingBarCell({ value, center, span, children }) {
  const off = value != null && center != null && span > 0 ? value - center : null
  const pct = off == null ? 0 : Math.min(50, (Math.abs(off) / span) * 50)
  const side = off != null && off < 0 ? 'under' : 'over'
  return (
    <span className="barcell barcell--diverge">
      <span className="barcell__axis" aria-hidden="true" />
      {off != null && (
        <span
          className={`barcell__fill barcell__fill--${side}`}
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      )}
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

// A COLUMN CHART — the one shape a report board cannot make out of table rows.
//
// TrendStrip above is a column chart too, and it is deliberately not this one:
// it is 68px of sparkline inside a table cell, read as a shape beside a number
// and never for a value. This is a chart a reader looks AT — it carries an
// axis, a scale somebody chose, and labels under every column.
//
// IT IS HTML AND CSS, NOT SVG, and that is a typography decision rather than a
// drawing one. Text inside an SVG scales with the viewBox, so a chart that fits
// a 390px phone would set its axis labels a third larger on a 960px screen, and
// an inline `font-size` in SVG is invisible to check-typography, which reads
// stylesheets only. Flex columns with percentage heights draw the same picture
// with every font in src/styles/68-around-the-game.css, where the guard can see
// it.
//
// `columns` is `[{ key, label, value, hollow }]` and `ticks` is
// `[{ value, label }]` — both the caller's, because the scale a chart is drawn
// on is a judgement about the data and belongs to the page that knows it. A
// column with a null value draws nothing rather than a zero.
//
// THIN EVIDENCE IS DRAWN HOLLOW, NOT GREY AND NOT IN A SECOND COLOUR. The
// extra-innings column pools thirteen games' worth of nights against nine
// columns of a full season, and it has to say so. Clay against graphite fails
// the colourblind check at delta-E 4.8 under protanopia and grey on this paper
// fails AA, so the outline carries it: an unfilled bar reads as "counted
// differently" with no colour at all.
//
// TWO OPTIONAL MARKS. `tone` inks one column differently from its neighbours:
// `mark` is clay, for the column whose own rows the board goes on to print, so
// a reader can see which slice of the distribution they are about to read;
// `soft` is the second shade of the SAME hue, for a pair of bars that are two
// halves of one question rather than a thing and its alarm. Clay is this
// palette's alarm token and "after a loss" is a neutral category, so a pair
// drawn navy-against-clay would call one of them a problem.
//
// Either way the split is TWO-way and never rests on hue alone: the marked
// column is the one the rows name, and a pair of bars carries its own figures
// and its own labels. That is what keeps this clear of the three-way-by-colour
// trap the diverging bar records above.
//
// `note` prints a figure over one column. Nothing here can be hovered — a
// `title` tooltip is invisible on a touch screen and is not used in this app —
// so the one or two values a reader came for are printed where they sit, the
// same answer LineChart's `endLabels` gives.
// THE GRIDLINES A CALLER ASKS FOR, at a round step it picks. The STEP is the
// judgement — 8 challenges per hundred chances and 100 club-games are different
// questions — and where the lines then fall is arithmetic, so the caller keeps
// the first and hands the second here. It stops at the tallest column, which is
// what keeps a chart to three or four lines rather than to a ruled page.
export function roundTicks(max, step) {
  const out = []
  for (let v = step; v <= max; v += step) out.push({ value: v, label: String(v) })
  return out
}

//
// `rules` marks a VALUE on the x axis — a median, a mean — as `[{ key, pos,
// label, tone }]`, where `pos` is a 0-to-1 fraction of the drawn columns. The
// fraction is the caller's because it belongs to the caller's scale: a
// histogram's median lands through its bin edges (api/around-the-game/
// absExposure.js's binPosition), and a mark placed by a hand-counted index
// drifts from its own label the first time the data moves.
export function ColumnChart({ columns, max, ticks = [], rules = [], label, size = 'full' }) {
  const height = (v) => (max > 0 && v != null ? `${Math.max(1, Math.min(100, (v / max) * 100))}%` : '0%')
  return (
    <div className={`colchart colchart--${size}`}>
      <div className="colchart__plot" role="img" aria-label={label}>
        {ticks.map((t) => (
          <span key={t.value} className="colchart__tick" style={{ bottom: height(t.value) }}>
            <span className="colchart__ticklabel">{t.label}</span>
          </span>
        ))}
        <span className="colchart__cols">
          {columns.map((c) => (
            <span key={c.key} className="colchart__col">
              <span
                className={`colchart__bar${c.hollow ? ' colchart__bar--hollow' : ''}${
                  c.tone ? ` colchart__bar--${c.tone}` : ''
                }`}
                style={{ height: height(c.value) }}
              >
                {c.note ? <span className="colchart__value">{c.note}</span> : null}
              </span>
            </span>
          ))}
          {/* Drawn after the columns so they paint over them, which is what a
              rule marking a value across a distribution has to do. */}
          {rules.map((r) =>
            r.pos == null ? null : (
              <span
                key={r.key}
                className={`colchart__rule colchart__rule--${r.tone ?? 'mark'}`}
                style={{ left: `${r.pos * 100}%` }}
              >
                <span
                  className={`colchart__rulelabel${
                    r.pos > 0.5 ? ' colchart__rulelabel--before' : ''
                  }`}
                >
                  {r.label}
                </span>
              </span>
            ),
          )}
        </span>
      </div>
      <span className="colchart__labels">
        {columns.map((c) => (
          <span key={c.key} className="colchart__label">
            {c.label}
          </span>
        ))}
      </span>
    </div>
  )
}

// A LINE CHART ON ITS OWN SCALE — for the series that must never share an axis
// with the columns above it.
//
// WHY IT IS A SEPARATE CHART AND NOT A SECOND AXIS. Challenges per chance rises
// across the game and the share won falls across it, and drawn on one pair of
// axes the two lines cross wherever the second scale happens to be pinned. The
// crossing point is an artefact of that choice and a reader cannot tell it from
// a finding. Two charts, each with its own ticks, say the same two things and
// invent nothing.
//
// THE PATH IS SVG BECAUSE A LINE IS A LINE; everything with letters in it is
// HTML, for the reason ColumnChart gives. `preserveAspectRatio="none"` lets the
// path stretch to whatever width the page gives it, and `vector-effect` keeps
// the stroke one weight while it does.
export function LineChart({ points, min, max, ticks = [], label, endLabels }) {
  const span = max - min
  const usable = points.filter((p) => p.value != null)
  // THE POINTS SIT AT THE COLUMN CENTRES, not at the plot's edges, because the
  // labels under them are centred cells of one shared row (.colchart__labels)
  // and a line drawn edge to edge lands half a cell left of every label it
  // belongs to.
  const x = (i) => ((i + 0.5) / points.length) * 100
  const y = (v) => (span > 0 ? 100 - ((v - min) / span) * 100 : 50)
  const pct = (v) => (span > 0 ? `${((v - min) / span) * 100}%` : '50%')
  const path = points
    .map((p, i) => (p.value == null ? null : `${x(i)},${y(p.value)}`))
    .filter(Boolean)
    .join(' ')

  return (
    <div className="colchart colchart--line">
      <div className="colchart__plot" role="img" aria-label={label}>
        {ticks.map((t) => (
          <span key={t.value} className="colchart__tick" style={{ bottom: pct(t.value) }}>
            <span className="colchart__ticklabel">{t.label}</span>
          </span>
        ))}
        <svg
          className="colchart__svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline className="colchart__path" points={path} vectorEffect="non-scaling-stroke" />
        </svg>
        {/* THE TWO ENDS CARRY THEIR OWN FIGURES. Nothing else on the line is
            labelled and nothing can be hovered — a `title` tooltip is invisible
            on a touch screen and is not used anywhere in this app — so the
            first and last values are printed where they sit. They are also the
            two the reader came for: the fall from one to the other IS the
            finding. */}
        {usable.length > 1 &&
          endLabels?.map((e) => (
            <span
              key={e.key}
              className={`colchart__end colchart__end--${e.side}`}
              style={{ bottom: pct(e.value) }}
            >
              {e.text}
            </span>
          ))}
      </div>
      <span className="colchart__labels">
        {points.map((p) => (
          <span key={p.key} className="colchart__label">
            {p.label}
          </span>
        ))}
      </span>
    </div>
  )
}
