import { SectionHead } from '../../ui/frame/SectionHead.jsx'
import { Card } from '../../ui/frame/Card.jsx'

// One of "Today's edges": a label head on a hairline, then a card of paper
// under it (the same pairing SeriesStarters and SeriesTotals use).
export function EdgeCard({ title, note, className, children }) {
  return (
    <section>
      <SectionHead look="label" note={note}>
        {title}
      </SectionHead>
      <Card as="div" className={className}>
        {children}
      </Card>
    </section>
  )
}
