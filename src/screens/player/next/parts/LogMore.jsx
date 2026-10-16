import { Button } from '../../../../components/ui/control/Button.jsx'
import { pageOf } from './logPaging.js'

// The paging button under a game log table (see logPaging.js). Renders nothing for a short log.
// When it folds back to the first page, the table stays in view instead of the page jumping away.
export function LogMore({ total, limit, first, onPage }) {
  const p = pageOf(total, limit, first)
  if (!p.canToggle) return null
  const click = (e) => {
    const table = e.currentTarget.parentElement?.querySelector('.logtable')
    onPage(p.next)
    if (p.left === 0) requestAnimationFrame(() => table?.scrollIntoView({ block: 'nearest' }))
  }
  return (
    <Button size="control" onClick={click} aria-expanded={limit > first}>
      {p.label}
    </Button>
  )
}
