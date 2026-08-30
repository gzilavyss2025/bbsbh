import { useNav } from '../../../lib/nav.js'
import { runValuePath } from '../../../lib/route.js'
import { signed, tone } from '../../../api/around-the-game/runValue.js'
import { RunValueSplit, splitScale } from '../../../components/around-the-game/RunValueParts.jsx'
import { PlayerLink } from '../../../components/player/PlayerLink.jsx'
import { ChevronLink } from '../../../components/ui/ChevronLink.jsx'

// The team hub's RUN VALUE card, on the Numbers tab — what this club's season
// has been worth in runs, split four ways, and the men carrying it.
//
// WHY IT SITS BETWEEN THE RANK TABLES AND THE LEADERS LEDGER. The two tables
// above it rank the club on runs scored and runs allowed; this says where those
// runs came from — how much was the bats, how much the gloves, how much the
// legs, how much the arms — on one scale, which is a question neither table can
// answer. And it names players, so it reads straight into the ledger below it.
//
// CURRENT ROSTER, NOT THE CLUB'S SEASON, and the card says so. Baseball Savant
// carries one current club per player with no split, so a man traded in July is
// counted here in full for whoever holds him now (clubRunValue's header).
//
// MLB only: Savant runs no minor-league board, so `data` is null for an
// affiliate and the card does not render.
const TOP_PLAYERS = 6

export function TeamRunValueCard({ data, clubName }) {
  const navigate = useNav()
  if (!data) return null
  const { club, rank, of } = data
  const top = club.players.slice(0, TOP_PLAYERS)

  return (
    <div className="thub-card rvclub">
      <h3 className="section__title">
        <span>Run value</span>
        <em>runs above average</em>
      </h3>

      <div className="rvcard__head">
        <p className="rvcard__total">{signed(club.total)}</p>
        {rank ? (
          <p className="rvcard__rank">
            {ordinal(rank)} of {of} clubs
          </p>
        ) : null}
      </div>

      {/* One club, so the ruler is its own widest side — the same call the
          player card makes, and for the same reason: there are no neighbouring
          cards on this page to share a scale with. */}
      <RunValueSplit entry={club} scale={splitScale([club])} />

      <ol className="rvclub__list">
        {top.map((p, i) => (
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
        Every {clubName} player Baseball Savant has a season figure for —{' '}
        {club.players.length} of them — counted for the club that holds him now.
        A man traded in July brings his whole season with him.
      </p>

      <div className="thub-door">
        <ChevronLink onClick={() => navigate(runValuePath())}>League run value board</ChevronLink>
      </div>
    </div>
  )
}

// Same small helper the player card carries. Two copies of four lines rather
// than a shared export nothing else would ever call — the convention
// absChallenges.js's own local `ranked` sets.
function ordinal(n) {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}
