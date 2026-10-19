import { arsenalFor } from '../../../api/matchup/savant.js'
import { EmptyState } from '../../../components/ui/state/EmptyState.jsx'
import { Stack } from '../../../components/ui/layout/Stack.jsx'
import { HitterLine } from '../HitterLine.jsx'
import { matchupVerdict } from '../hitterBoard.js'
import { VerdictCard } from './VerdictCard.jsx'
import { Pushes } from './Pushes.jsx'
import { Watch } from './Watch.jsx'
import { watchList } from './edge.js'

// THE EDGE (#1490, #2319, ADR-0118): one verdict, what pushes it, and what to
// watch. The verdict is the hitter's expected xwOBA (est.) on the pitcher's
// whole mix against the league's (matchupVerdict); the pitch-by-pitch detail is
// the next section.
//
// With no hitter grid (the Phase 1 state) there is no league comparison to
// make, so the panel prints the hitter's Savant line per pitch type instead,
// labelled regular season (HitterLine.jsx). It never invents one.
export function EdgePanel({ data, board, sides, sel, stance }) {
  const names = { hitter: data.hitter.last, pitcher: data.pitcher.last }
  if (!board) {
    return <EmptyState size="compact">Not posted</EmptyState>
  }
  const v = matchupVerdict(board, sides.xwoba)
  if (!v) {
    return (
      <Stack>
        <p className="scout__kicker">{data.hitter.name} by pitch type · Savant · Regular season</p>
        <HitterLine line={arsenalFor(data.savant, data.hitter.id, 'batting')} types={board.types} code={sel} />
      </Stack>
    )
  }
  const crowd = stance === 'L' ? 'lefties' : 'righties'
  return (
    <Stack gap="loose">
      <VerdictCard v={v} names={names} />
      <Pushes v={v} names={names} crowd={crowd} />
      <Watch items={watchList({ board, sides, names, stance })} players={{ hitter: data.hitter, pitcher: data.pitcher }} />
    </Stack>
  )
}
