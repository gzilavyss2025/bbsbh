import { Button } from '../../../../components/ui/control/Button.jsx'
import { pageOf } from './logPaging.js'

// The paging button under a game log table (see logPaging.js). Renders nothing for a short log.
export function LogMore({ total, limit, first, onPage }) {
  const p = pageOf(total, limit, first)
  if (!p.canToggle) return null
  return (
    <Button size="control" onClick={() => onPage(p.next)} aria-expanded={p.left === 0}>
      {p.label}
    </Button>
  )
}
