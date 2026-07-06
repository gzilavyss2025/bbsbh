import { TeamLogo } from './TeamLogo.jsx'

// A single game on the slate. Deliberately spoiler-free: shows matchup, level,
// and coarse status only — never the score, even for finals.
//
// Layout: a grayscale logo row (away @ home) over a name row where each club is
// stacked location-over-mascot (MILWAUKEE / BREWERS), mirroring a scorebook.
export function GameCard({ game, pinned, onSelect }) {
  const statusText = describeStatus(game)
  return (
    <button
      type="button"
      className={`gamecard ${pinned ? 'gamecard--pinned' : ''}`}
      onClick={() => onSelect(game)}
    >
      <div className="gamecard__logos">
        <TeamLogo
          teamId={game.away.id}
          name={game.away.name}
          size={34}
          className="teamlogo--bw"
        />
        <span className="gamecard__at">@</span>
        <TeamLogo
          teamId={game.home.id}
          name={game.home.name}
          size={34}
          className="teamlogo--bw"
        />
      </div>
      <div className="gamecard__names">
        <TeamName team={game.away} />
        <TeamName team={game.home} />
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

// Location on the first line, mascot on the second. Falls back to the full
// name when we can't cleanly split off a location (some MiLB clubs).
function TeamName({ team }) {
  const { location, mascot } = splitName(team.name, team.teamName)
  return (
    <span className="gamecard__team">
      {location && <span className="gamecard__loc">{location}</span>}
      <span className="gamecard__mascot">{mascot}</span>
    </span>
  )
}

// "Milwaukee Brewers" + "Brewers" -> { location: 'Milwaukee', mascot: 'Brewers' }.
function splitName(name = '', mascot = '') {
  const full = name.trim()
  const club = (mascot || full).trim()
  if (club && full.toLowerCase().endsWith(club.toLowerCase())) {
    const location = full.slice(0, full.length - club.length).trim()
    return { location, mascot: club }
  }
  return { location: '', mascot: full }
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
