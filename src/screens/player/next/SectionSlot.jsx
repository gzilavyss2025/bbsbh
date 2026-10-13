import { useNearView } from '../../../hooks/scroll/useNearView.js'
import { Card } from '../../../components/ui/frame/Card.jsx'

// An empty section of the new player page (#1884). Its id is its jump-bar key.
// It calls the lazy hook and says one line once it is near; the module issues
// put their fetch and their content here, behind `near`.
export function SectionSlot({ id, label, count }) {
  const [ref, near] = useNearView()
  return (
    <Card frame="stamped" label={label} count={count} id={id} ref={ref} className="pnext__slot">
      {/* A blank line holds the placeholder's height, so the page does not grow under a tap's scroll. */}
      <p className="hint">{near ? `${label} loads here.` : '\u00a0'}</p>
    </Card>
  )
}
