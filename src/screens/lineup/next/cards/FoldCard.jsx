import { useId, useState } from 'react'
import { Card } from '../../../../components/ui/frame/Card.jsx'

// A stamped card folded shut until its head is tapped (Former teammates, Bullpen). The head
// is the button; the body mounts only when open, so nothing inside it loads or draws first.
export function FoldCard({ title, count, className = '', children }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  return (
    <Card as="div" frame="stamped" body="flush" className={`lfold ${className}`.trim()}>
      <h3 className="lfold__title">
        <button type="button" className="lfold__head" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
          <span className="lfold__name">{title}</span>
          {count != null && <span className="lfold__count">{count}</span>}
          <span className="lfold__chev" aria-hidden="true" />
        </button>
      </h3>
      {open && (
        <div className="lfold__body" id={bodyId}>
          {children}
        </div>
      )}
    </Card>
  )
}
