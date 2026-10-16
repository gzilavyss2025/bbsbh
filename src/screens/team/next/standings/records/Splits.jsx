import { shortDate } from '../../../../../api/teamRecords.js'
import { RankBar } from '../../../../../components/ui/frame/RankBar.jsx'
import { useNav } from '../../../../../lib/nav.js'
import { rankThird } from '../../../../../components/ui/frame/rankBar.js'

// A split row (S5b) and a count row (S5d), the ledger rows of the Records card. Line 1: the label,
// a door to the whole level at /situational-records. Line 2: W-L over the pct (a count: the number).
// Line 3: the rank, "4 of 30", on its own line; a split with no rank reads "—" and draws no bar.
// The top-third rank wears the marker (.rankmark); the others are plain caption mono.

export function RankLine({ rank }) {
  if (!rank) return <span className="rec__rank">—</span>
  const top = rankThird(rank.rank, rank.of) === 'top'
  return <span className={`rec__rank${top ? ' rankmark' : ''}`}>{`${rank.rank} of ${rank.of}`}</span>
}

export function SplitRow({ row, label = row.k, count = false }) {
  const navigate = useNav()
  return (
    <li className="rec__split">
      <button type="button" className="rec__door" onClick={() => navigate(row.to)}>{label}</button>
      {count ? (
        <span className="rec__fig"><span className="rec__wl">{row.value}</span></span>
      ) : (
        <span className="rec__fig">
          <span className="rec__wl">{row.v}</span>
          <span className="rec__pct">{row.pct}</span>
          {row.last && <span className="rec__last">{`Last ${shortDate(row.last.date)} ${row.last.result}`}</span>}
        </span>
      )}
      <RankLine rank={row.rank} />
      {row.rank && <span className="rec__bar"><RankBar rank={row.rank.rank} of={row.rank.of} /></span>}
    </li>
  )
}

export function SplitList({ rows, count }) {
  return (
    <ul className="rec__splits">
      {rows.map((r) => <SplitRow key={r.id} row={r} count={count} />)}
    </ul>
  )
}
