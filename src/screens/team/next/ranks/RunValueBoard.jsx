import { signed, tone } from '../../../../api/around-the-game/runValue.js'
import { RunValueSplit, splitScale } from '../../../../components/around-the-game/RunValueParts.jsx'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { StatTile } from '../../../../components/ui/frame/StatTile.jsx'
import { runValuePath } from '../../../../lib/route.js'
import { useNav } from '../../../../lib/nav.js'

// Run value, on a stamped card (the module is TeamRunValueCard's; the data is n.runValue). A lead
// tile carries the total and its rank, the split bar carries the four parts in its legend, then the
// club's top six. MLB only: `data` is null for an affiliate and the card does not render.
const TOP_PLAYERS = 6

export function RunValueBoard({ data, clubName, asOf, sportId, still }) {
  const navigate = useNav()
  if (!data) return null
  const { club, rank, of } = data
  return (
    <Card frame="stamped" label="Run value" labelAs="h3" count="runs above average" stampIn={!still} className="rnk__card">
      <StatTile
        tone="ink"
        className="stattile--compact rnk__lead"
        label="Club total"
        value={signed(club.total)}
        rank={rank ? { rank, of } : undefined}
      />
      <RunValueSplit entry={club} scale={splitScale([club])} />
      <ol className="rvclub__list">
        {club.players.slice(0, TOP_PLAYERS).map((p, i) => (
          <li className="rvclub__row" key={p.id}>
            <span className="rvclub__seat">{i + 1}</span>
            <span className="rvclub__name">
              <PlayerLink id={p.id} name={p.name}>
                {p.name}
              </PlayerLink>
            </span>
            {p.pos ? <span className="rvclub__pos">{p.pos}</span> : null}
            <span className={`rvclub__value rv__num--${tone(p.total)}`}>{signed(p.total)}</span>
          </li>
        ))}
      </ol>
      <p className="rvcard__note">
        Every {clubName} player Baseball Savant has a season figure for, {club.players.length} of them, counted for the club
        that holds him now. A man traded in July brings his whole season with him.
      </p>
      <div className="thub__door">
        <Door onClick={() => navigate(runValuePath({ d: asOf, s: sportId }))}>League run value board</Door>
      </div>
    </Card>
  )
}
