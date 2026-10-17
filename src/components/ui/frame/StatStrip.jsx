import { Card } from './Card.jsx'

// THE STAT STRIP (ADR-0112) — all the figures of a report row in ONE stamped box,
// the cells split by hairline rules. For three or four figures that read together
// (the Around the game pages' four tiles under the masthead). A figure that
// stands alone is StatTile look="band". The strip is a stamped Card with a flush
// body; styles/system/report/stat.css draws the cells.
//
//   children  StatCell parts. One StatCell may lead.
//   className the caller's namespace, for its place on the page.
//
// It computes and fetches nothing: every figure arrives formatted, and a reveal
// gate stays where the caller put it.
export function StatStrip({ className = '', children, ...rest }) {
  return (
    <Card as="div" frame="stamped" body="flush" className={`statstrip ${className}`.trim()} {...rest}>
      {children}
    </Card>
  )
}

// One cell: a label, a mono figure, a note. `lead` fills it ink and sets its
// figure in the marker. One lead per strip, at most. `className` is the caller's
// namespace for a state of its own (the World Series cards' "leads the two" fill).
export function StatCell({ label, value, note, lead = false, className = '' }) {
  return (
    <div className={`${lead ? 'statcell statcell--lead' : 'statcell'}${className ? ` ${className}` : ''}`}>
      <span className="statcell__label">{label}</span>
      <span className="statcell__value">{value}</span>
      {note != null && note !== '' && <span className="statcell__note">{note}</span>}
    </div>
  )
}
