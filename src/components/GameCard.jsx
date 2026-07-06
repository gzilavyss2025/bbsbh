import { TeamLogo } from './TeamLogo.jsx'

// A single game on the slate. Deliberately spoiler-free: shows matchup, level,
// and coarse status only — never the score, even for finals.
export function GameCard({ game, pinned, onSelect }) {
  const statusText = describeStatus(game)
  return (
    <button
      type="button"
      className={`gamecard ${pinned ? 'gamecard--pinned' : ''}`}
      onClick={() => onSelect(game)}
    >
      <div className="gamecard__teams">
        <TeamLogo teamId={game.away.id} name={game.away.name} size={22} />
        <span className="gamecard__team">{game.away.name}</span>
        <span className="gamecard__at">@</span>
        <TeamLogo teamId={game.home.id} name={game.home.name} size={22} />
        <span className="gamecard__team">{game.home.name}</span>
      </div>
      <div className="gamecard__meta">
        {game.sportLabel && game.sportLabel !== 'MLB' && (
          <span className="gamecard__level">{game.sportLabel}</span>
        )}
        {pinned && <span className="gamecard__pin">★</span>}
        <span className="gamecard__status">{statusText}</span>
      </div>
    </button>
  )
}

function describeStatus(game) {
  const s = game.abstractState
  if (s === 'Final') return 'Final' // no score, just the state
  if (s === 'Live') return 'In progress'
  // Pre-game: show the local start time.
  try {
    const t = new Date(game.gameDate)
    return t.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return game.detailedState ?? 'Scheduled'
  }
}
