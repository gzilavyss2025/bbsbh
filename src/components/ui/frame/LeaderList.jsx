import { leaderListClassName, leaderRowClassName } from '../../../lib/design/report/classes.js'
import { Pill } from '../control/Pill.jsx'
import { Card } from './Card.jsx'

// THE LEADER LIST AND ITS ROW (ADR-0112) — a ranked board. The list is a stamped,
// named Card; each row is a rank, a mark slot, a name over a small line, and a
// figure. Styled once, in styles/system/report/leader.css.
//
// LeaderList
//   label     the card's name tab, and its accessible name ("Payroll leaders").
//   count     the tag across the top-right edge ("30 clubs").
//   zebra     stripe every second row.
//   className the caller's namespace.
// LeaderRow
//   rank      the number in the rank pill.
//   mark      a node for the 36px slot: a TeamLogo or a Headshot. The caller draws
//             it; this file knows no club and no player.
//   name      the row's name, one line, clipped with an ellipsis.
//   sub       the small mono line under the name (a division, a position).
//   figure    the figure on the right, already formatted. `unit` is its caption.
//   state     'lead' (the field wash and a marker rank pill) or 'mine' (the
//             reader's own club: an ink tint and an ink bar on the left).
//
// Both compute and fetch nothing. The figures are the caller's, so a reveal gate
// stays where the caller put it.
export function LeaderList({ label, count, zebra = false, className = '', children, ...rest }) {
  return (
    <Card frame="stamped" body="flush" label={label} labelAs="h3" count={count} className={className} {...rest}>
      <ol className={leaderListClassName({ zebra })}>{children}</ol>
    </Card>
  )
}

export function LeaderRow({ rank, mark, name, sub, figure, unit, state, className = '' }) {
  return (
    <li className={leaderRowClassName({ state, className })}>
      <Pill figure mark fill={state === 'lead' ? 'marker' : 'outline'}>
        {rank}
      </Pill>
      <span className="leaderrow__mark">{mark}</span>
      <div>
        <div className="leaderrow__name">{name}</div>
        {sub != null && sub !== '' && <span className="leaderrow__sub">{sub}</span>}
      </div>
      <div className="leaderrow__figure">
        {figure}
        {unit != null && unit !== '' && <span className="leaderrow__unit">{unit}</span>}
      </div>
    </li>
  )
}
