import { useMemo } from 'react'
import { selectTeamMeta } from '../../../api/select.js'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { Stack } from '../../../components/ui/layout/Stack.jsx'
import '../../../styles/lineup-next/page.css'

// The new lineup page (docs/lineup-redesign.md), at `?look=new` on lineup1 and lineup2.
// Slice S0: the shell. It takes the props TeamInfo takes, so GameView swaps one for the
// other and the slices fill the page in.
export function LineupNextPage({ feed, side, onNext, nextLabel }) {
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  return (
    <Stack gap="section" className="lnext__page">
      <Card label={side === 'away' ? 'Away' : 'Home'} className="lnext__shell">
        <h2 className="lnext__name">{meta.name || 'Team'}</h2>
        <button type="button" className="btn btn--ink btn--next" onClick={onNext}>
          {nextLabel}
        </button>
      </Card>
    </Stack>
  )
}
