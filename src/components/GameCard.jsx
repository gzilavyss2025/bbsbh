import { TeamLogo } from './TeamLogo.jsx'
import { lookupSplit } from '../lib/teamSplits.js'

// A single game on the slate. Deliberately spoiler-free: shows matchup, level,
// and coarse status only — never the score, even for finals.
//
// Layout: two team columns (away, then home), each a large grayscale logo above
// a stacked name — location over mascot (MILWAUKEE / BREWERS), like a scorebook.
export function GameCard({ game, pinned, onSelect, onBoxScore }) {
  const live = game.abstractState === 'Live'
  const statusText = describeStatus(game)
  return (
    <div className={`gamecard ${pinned ? 'gamecard--pinned' : ''}`}>
      {live && <span className="gamecard__live">Live</span>}
      <button
        type="button"
        className="gamecard__open"
        onClick={() => onSelect(game)}
      >
        <div className="gamecard__teams">
          <TeamColumn team={game.away} />
          <span className="gamecard__at" aria-hidden="true">@</span>
          <TeamColumn team={game.home} />
        </div>
        <div className="gamecard__meta">
          {game.sportLabel && game.sportLabel !== 'MLB' && (
            <span className="gamecard__level">{game.sportLabel}</span>
          )}
          {pinned && <span className="gamecard__pin">★</span>}
          {statusText && <span className="gamecard__status">{statusText}</span>}
        </div>
      </button>
      {onBoxScore && (
        <button
          type="button"
          className="gamecard__box"
          onClick={onBoxScore}
        >
          Box score ›
        </button>
      )}
    </div>
  )
}

// One team column: a large grayscale logo above the name (location on the first
// line, mascot on the second). Falls back to the full name when we can't
// cleanly split off a location (some MiLB clubs).
function TeamColumn({ team }) {
  const { location, mascot } = splitName(team.name, team.teamName)
  return (
    <div className="gamecard__team">
      <TeamLogo
        teamId={team.id}
        name={team.name}
        size={56}
        className="teamlogo--bw"
      />
      <span className="gamecard__name">
        {location && <span className="gamecard__loc">{location}</span>}
        <span className="gamecard__mascot">{mascot}</span>
      </span>
    </div>
  )
}

// "Milwaukee Brewers" + "Brewers" -> { location: 'Milwaukee', mascot: 'Brewers' }.
// The hand-maintained table in teamSplits.js wins; otherwise fall back to the
// API's teamName (mascot) and strip it off the end of the full name.
function splitName(name = '', mascot = '') {
  const full = name.trim()
  const manual = lookupSplit(full)
  if (manual) return manual
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
  if (s === 'Live') return '' // the LIVE pill carries it; no redundant text
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
