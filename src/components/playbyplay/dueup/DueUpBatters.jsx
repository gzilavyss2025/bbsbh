import { useEffect, useState } from 'react'
import { hasSeen, markSeen, viewKey } from '../../../lib/motion/inViewOnce.js'
import { Headshot } from '../../player/Headshot.jsx'
import { PlayerLink } from '../../player/PlayerLink.jsx'
import { Card } from '../../ui/frame/Card.jsx'

export const dueUpMotionKey = (feed, inning, half, which) => viewKey(feed?.gamePk, `dueup-${which}-${inning}-${half}`)

// The stamped "who is due up" card, drawn once for both of focus mode's due-up
// previews: DueUpNextCard (the other side's next half) and UpNextBatters (the
// batting side's own half, before it starts). The name tab says which. The card names no club
// (a club colour belongs to a head that names it, ADR-0030).
//
// Each column is a bare headshot, the batting-order slot on its bottom-left
// corner, the name, and one line: "H-AB" so far this game, or his average
// entering the game when he has no at-bat yet.
//
// The card stamps in the first time it shows for one half in this page visit
// (`motionKey`, the one-shot gate in lib/motion/inViewOnce.js), and rests on a
// return. Reduced motion is the stamp-in CSS's own switch.
//
// It computes and fetches nothing. A caller hands it `batters` already carrying
// `line` (api/boxscore/batterLine.js), so each caller owns its spoiler gate.
export function DueUpBatters({ label, teamId, batters, motionKey, className = '' }) {
  const [still] = useState(() => hasSeen(motionKey))
  useEffect(() => {
    markSeen(motionKey)
  }, [motionKey])
  return (
    <Card frame="stamped" label={label} stampIn={!still} className={`dueup ${className}`.trim()}>
      <ol className="dueup__row">
        {batters.map((b) => (
          <li className="dueup__col" key={b.id}>
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
