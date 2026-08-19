import { PlayerLink } from '../player/PlayerLink.jsx'
import { teamChipColors } from '../../lib/teams.js'
import { Money } from './Money.jsx'

// Highest paid players, filtered two ways at once — by club from the rail above
// the page, by position from the chips under this masthead. Rank, club-colour
// rail and a bar, so the distance between first and twelfth is a shape rather
// than a subtraction the reader has to do.
//
// The bar is chart-only (tokens/colors.css's rule for every club-coloured fill
// in the app): no text ever sits on it, so a pale club primary needs no contrast
// treatment here. The club TAG does carry text, which is why it takes its ink
// from teamChipColors rather than assuming light on dark.
export function SalaryBoard({ players, positions, position, onPosition, context, top }) {
  return (
    <section className="payboard" aria-labelledby="payboard-title">
      <div className="metricbar">
        <span className="metricbar__title" id="payboard-title">
          Highest paid players
        </span>
        <span className="payboard__context">{context}</span>
      </div>

      <div className="payboard__filter" role="group" aria-label="Filter by position">
        <button
          type="button"
          className={`payboard__chip${position == null ? ' is-active' : ''}`}
          aria-pressed={position == null}
          onClick={() => onPosition(null)}
        >
          All positions
        </button>
        {positions.map((pos) => (
          <button
            key={pos}
            type="button"
            className={`payboard__chip${pos === position ? ' is-active' : ''}`}
            aria-pressed={pos === position}
            onClick={() => onPosition(pos === position ? null : pos)}
          >
            {pos}
          </button>
        ))}
      </div>

      {players.length === 0 && (
        <p className="payboard__empty">No salaried player at this club and position.</p>
      )}

      {players.map((player, index) => {
        const chip = teamChipColors(player.teamId)
        return (
          <div
            key={player.id}
            className={`payboard__row${index === 0 ? ' payboard__row--lead' : ''}`}
            style={{ '--club': chip?.primary, '--club-2': chip?.secondary }}
          >
            <span className="payboard__rank">{index + 1}</span>
            <span className="payboard__body">
              <span className="payboard__line">
                <span className="payboard__name">
                  <PlayerLink id={player.id}>{player.name}</PlayerLink>
                </span>
                {player.pos && <span className="payboard__tag">{player.pos}</span>}
                <span
                  className="payboard__tag"
                  style={chip ? { background: chip.primary, color: chip.text } : undefined}
                >
                  {player.abbrev}
                </span>
              </span>
              <span className="paybar">
                <span className="paybar__fill" style={{ width: `${(player.salary / top) * 100}%` }} />
              </span>
            </span>
            <span className="payboard__salary">
              <Money value={player.salary} />
            </span>
          </div>
        )
      })}
    </section>
  )
}
