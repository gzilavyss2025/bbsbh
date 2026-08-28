import { ordinal, shortDate } from '../../../../api/teamRecords.js'
import { situationalRecordsPath } from '../../../../lib/route.js'
import { useNav } from '../../../../lib/nav.js'

// The "Scoring by inning" group, drawn as a grid instead of a list.
//
// The group is nineteen rows — scoring in the top and the bottom of each of
// the first nine innings, plus one bucket for extras — and printed as flat
// `.tstatrow`s they would have been longer than the rest of the card put
// together. A grid says the same thing in ten lines, because the inning number
// is the row and the half is the column. It also makes the shape of the data
// visible: a club bats ONE half per game, so its top-of-the-2nd record is its
// road games and its bottom-of-the-2nd record is its home ones. Two different
// questions, side by side, which is exactly how they read here.
//
// Each cell keeps the affordance every other row on this card has: it opens
// that one split ranked across the whole level (/situational-records).
//
// The extras row spans both columns — a club's extra-inning scoring is one
// bucket, the same way the `x` flag already treats extras, so splitting it by
// half would print two mostly-empty cells.

const DASH = '—'

function Cell({ row, sportId, half, month }) {
  const navigate = useNav()
  if (!row) {
    return (
      <span className="trecinn__cell trecinn__cell--none" aria-hidden="true">
        {DASH}
      </span>
    )
  }
  const last = row.last ? `${shortDate(row.last.date)} ${row.last.result}` : DASH
  return (
    <button
      type="button"
      className="trecinn__cell"
      aria-label={`${row.k}: ${row.v}${row.last ? `, last on ${row.last.date}` : ''}`}
      onClick={() => navigate(situationalRecordsPath({ metric: row.id, half, month, s: sportId }))}
    >
      <span className="trecinn__rec">{row.v}</span>
      <span className="trecinn__pct">{row.pct}</span>
      <span className="trecinn__last">{last}</span>
    </button>
  )
}

export function InningScoringGrid({ rows, sportId, half, month }) {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const innings = Array.from({ length: 9 }, (_, i) => i + 1).filter(
    (n) => byId.has(`scored-top-${n}`) || byId.has(`scored-bottom-${n}`),
  )
  const extras = byId.get('scored-extras')
  if (!innings.length && !extras) return null

  return (
    <div className="trecinn">
      <p className="trecinn__legend">W-L, win pct, and the last time it happened.</p>
      <div className="trecinn__grid">
        <span className="trecinn__colhead trecinn__colhead--inn">Inn</span>
        <span className="trecinn__colhead">Top</span>
        <span className="trecinn__colhead">Bottom</span>
        {innings.map((n) => [
          <span className="trecinn__rowhead" key={`h${n}`}>{ordinal(n)}</span>,
          <Cell key={`t${n}`} row={byId.get(`scored-top-${n}`)} sportId={sportId} half={half} month={month} />,
          <Cell key={`b${n}`} row={byId.get(`scored-bottom-${n}`)} sportId={sportId} half={half} month={month} />,
        ])}
      </div>
      {extras && (
        <div className="trecinn__extras">
          <span className="trecinn__rowhead">Extras</span>
          <Cell row={extras} sportId={sportId} half={half} month={month} />
        </div>
      )}
    </div>
  )
}
