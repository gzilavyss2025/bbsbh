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
          <TeamMark team={game.away} side="away" />
          <span className="gamecard__at" aria-hidden="true">@</span>
          <TeamMark team={game.home} side="home" />
          <TeamName team={game.away} side="away" />
          <TeamName team={game.home} side="home" />
        </div>
        {game.abstractState !== 'Final' && (
          <ReadyStrip game={game} />
        )}
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

// Scorebook-readiness strip: four tiny red/green chips under the matchup telling
// you at a glance whether the basics you'd pencil in pre-game are posted yet —
// each team's batting order, the umpire crew, and both starting pitchers. Green
// (✓) = posted, red (✗) = not yet. Spoiler-free; none of these reveal a score.
// The lineup chips carry the team abbreviation so it's clear which side is set.
function ReadyStrip({ game }) {
  const r = game.readiness ?? {}
  const items = [
    { ok: !!r.awayLineup, label: `${game.away.abbreviation || 'Away'} Lineup` },
    { ok: !!r.homeLineup, label: `${game.home.abbreviation || 'Home'} Lineup` },
    { ok: !!r.umpires, label: 'Umps' },
    { ok: !!r.pitchers, label: 'SP' },
  ]
  return (
    <div className="gamecard__ready" aria-label="Scorebook readiness">
      {items.map((it) => (
        <span
          key={it.label}
          className={`ready ${it.ok ? 'ready--ok' : 'ready--no'}`}
          title={`${it.label}: ${it.ok ? 'posted' : 'not posted yet'}`}
        >
          <span className="ready__mark" aria-hidden="true">
            {it.ok ? '✓' : '✗'}
          </span>
          {it.label}
        </span>
      ))}
    </div>
  )
}

// A team's grayscale mark, framed in a uniform bordered square so the two logos
// read at a consistent size and the '@' lands dead-center between them (the mark
// is slightly overscaled so it just kisses the frame — cropped ever so slightly,
// the way Caught Looking tiles its club marks). Sits in the top grid row.
function TeamMark({ team, side }) {
  return (
    <div className={`gamecard__logobox gamecard__logobox--${side}`}>
      <TeamLogo
        teamId={team.id}
        name={team.name}
        size={56}
        className="teamlogo--bw"
      />
    </div>
  )
}

// The team's name under its mark (location on the first line, mascot on the
// second). Falls back to the full name when we can't cleanly split off a
// location (some MiLB clubs). Sits in the bottom grid row so names align
// independently of the marks above them.
function TeamName({ team, side }) {
  const { location, mascot } = splitName(team.name, team.teamName)
  return (
    <span className={`gamecard__name gamecard__name--${side}`}>
      {location && <span className="gamecard__loc">{location}</span>}
      <span className="gamecard__mascot">{mascot}</span>
    </span>
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
