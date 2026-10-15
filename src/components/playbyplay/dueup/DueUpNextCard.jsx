import { useMemo } from 'react'
import { selectDueUpNext } from '../../../api/dueup.js'
import { batterLineText } from '../../../api/boxscore/batterLine.js'
import { DueUpBatters, dueUpMotionKey } from './DueUpBatters.jsx'

// A preview of the OTHER team's next half: the first few spots due up, drawn by
// DueUpBatters (the stamped card, the headshots and the one stat line each).
//
// SPOILER FOOTING: selectDueUpNext returns null until the half on screen is
// fully revealed (see its own header comment), and `batterLineText` takes
// `revealedThrough` as its own hard boundary (the same tier DueUpConsole and
// the Pitchers table stand on, ADR-0009), so this is safe at render top level
// with no SealBox of its own.
export function DueUpNextCard({ feed, inning, half, revealedThrough, awayId, homeId, awayName, homeName }) {
  const info = useMemo(() => {
    const due = selectDueUpNext(feed, inning, half, revealedThrough)
    if (!due) return null
    const batters = due.batters.map((b) => ({
      ...b,
      line: batterLineText(feed, due.battingSide, b.id, revealedThrough),
    }))
    return { ...due, batters }
  }, [feed, inning, half, revealedThrough])
  if (!info) return null
  const teamId = info.battingSide === 'away' ? awayId : homeId
  const teamName = info.battingSide === 'away' ? awayName : homeName

  return <DueUpBatters label="Due up next" teamName={teamName} teamId={teamId} batters={info.batters} motionKey={dueUpMotionKey(feed, inning, half, 'next')} className="dueupnext" />
}
