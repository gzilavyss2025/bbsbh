import { Headshot } from '../../player/Headshot.jsx'
import { PlayerLink } from '../../player/PlayerLink.jsx'
import { Card } from '../../ui/frame/Card.jsx'

// The stamped "who is due up" card, drawn once for both of focus mode's due-up
// previews: DueUpNextCard (the other side's next half) and UpNextBatters (the
// batting side's own half, before it starts). The name tab says which; the count
// tag names the club (never its colour, ADR-0030).
//
// Each column is a bare headshot, the batting-order slot on its bottom-left
// corner, the name, and one line: "H-AB" so far this game, or his average
// entering the game when he has no at-bat yet. The first batter is the lead: his
// photo takes the soft stamped shadow and a mint slot tag.
//
// It computes and fetches nothing. A caller hands it `batters` already carrying
// `line` (api/boxscore/batterLine.js), so each caller owns its spoiler gate.
export function DueUpBatters({ label, teamName, teamId, batters, className = '' }) {
  return (
    <Card frame="stamped" label={label} count={teamName} className={`dueup ${className}`.trim()}>
      <ol className="dueup__row">
        {batters.map((b, i) => (
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
