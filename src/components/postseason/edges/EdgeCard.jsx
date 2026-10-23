import { Card } from '../../ui/frame/Card.jsx'

// One of the series' edge cards (Today's edges, the scouting report): a stamped card named on its
// ink tab, as the World Series home's cards are. `note` is the tag across the top-right edge.
export function EdgeCard({ title, note, className, children }) {
  return (
    <Card frame="stamped" label={title} labelAs="h3" count={note} className={className}>
      {children}
    </Card>
  )
}
