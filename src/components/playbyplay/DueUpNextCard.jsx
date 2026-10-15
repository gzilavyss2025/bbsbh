import { useMemo } from 'react'
import { selectDueUpNext } from '../../api/dueup.js'
import { batterLineText } from '../../api/boxscore/batterLine.js'
import { Headshot } from '../player/Headshot.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { Card } from '../ui/frame/Card.jsx'

// A preview of the OTHER team's next half: the first few spots due up, as a
// stamped card (the name tab says "Due up next", the count tag names the club).
// Each column is a bare headshot, the batting-order slot on its bottom-left
// corner, the name, and one line: "H-AB" in this game so far, or his average
// entering the game when he has no at-bat yet (".228").
//
// SPOILER FOOTING: selectDueUpNext returns null until the half on screen is
// fully revealed (see its own header comment), and `batterLineText` takes
// `revealedThrough` as its own hard boundary (the same tier DueUpConsole and
// the Pitchers table stand on, ADR-0009), so this is safe at render top level
// with no SealBox of its own. The first batter is the lead: his photo takes the
// soft stamped shadow, as the lead tile does elsewhere in the system.
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

  return (
    <Card frame="stamped" label="Due up next" count={teamName} className="dueup">
      <ol className="dueup__row">
        {info.batters.map((b, i) => (
          <li className={`dueup__col${i === 0 ? ' dueup__col--lead' : ''}`} key={b.id}>
            <span className="dueup__photo">
              <Headshot personId={b.id} name={b.last} teamId={teamId} tint={false} className="dueup__shot" />
              <span className="dueup__slot">{b.slot}</span>
            </span>
            <span className="dueup__name">
              <PlayerLink id={b.id}>{b.last}</PlayerLink>
            </span>
            <span className="dueup__line">{b.line}</span>
          </li>
        ))}
      </ol>
    </Card>
  )
}
