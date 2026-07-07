import { TeamLogo } from './TeamLogo.jsx'
import { lookupSplit } from '../lib/teamSplits.js'

// A single game on the slate. Deliberately spoiler-free: shows matchup, level,
// and coarse status only — never the score, even for finals.
//
// Layout: two team columns (away, then home), each a large grayscale logo above
// a stacked name — location over mascot (MILWAUKEE / BREWERS), like a scorebook.
export function GameCard({ game, pinned, uniformsReady, onSelect, onBoxScore }) {
  const live = game.abstractState === 'Live'
  const dhLabel = doubleHeaderLabel(game)
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
          <ReadyStrip game={game} uniformsReady={uniformsReady} />
        )}
        <div className="gamecard__meta">
          {game.sportLabel && game.sportLabel !== 'MLB' && (
            <span className="gamecard__level">{game.sportLabel}</span>
          )}
          {dhLabel && <span className="gamecard__dh">{dhLabel}</span>}
          {pinned && <span className="gamecard__pin">★</span>}
          <StatusText game={game} />
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
// each team's batting order, the umpire crew, both starting pitchers, and
// whether each club's uniforms have been posted. Green (✓) = posted, red (✗) =
// not yet. Spoiler-free; none of these reveal a score. The lineup chips carry
// the team abbreviation so it's clear which side is set. (Uniforms land latest —
// around first pitch — so that chip stays red longest.)
function ReadyStrip({ game, uniformsReady }) {
  const r = game.readiness ?? {}
  const items = [
    { ok: !!r.awayLineup, label: `${game.away.abbreviation || 'Away'} Lineup` },
    { ok: !!r.homeLineup, label: `${game.home.abbreviation || 'Home'} Lineup` },
    { ok: !!r.umpires, label: 'Umps' },
    { ok: !!r.pitchers, label: 'SP' },
    { ok: !!uniformsReady, label: 'Unis' },
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

// A team's mark, framed in a uniform bordered square so the two logos read at a
// consistent size and the '@' lands dead-center between them. The mark is
// overscaled to bleed to the frame like a printed badge (the tile clips the
// overflow), the way Caught Looking tiles its club marks. Full color here on the
// slate — elsewhere (the in-game masthead, the logo sheet) the marks stay
// grayscale. Sits in the top grid row.
function TeamMark({ team, side }) {
  return (
    <div className={`gamecard__logobox gamecard__logobox--${side}`}>
      <TeamLogo teamId={team.id} name={team.name} size={56} />
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

// "Game 1" / "Game 2" for a card that's part of a doubleheader (regular or
// split), so the two same-matchup rows on the slate are told apart at a glance.
// A lone game (doubleHeader 'N') gets nothing.
function doubleHeaderLabel(game) {
  if (!game.doubleHeader || game.doubleHeader === 'N') return null
  return `Game ${game.gameNumber ?? 1}`
}

// Pre-game start time. Primary read is the VIEWER's local clock (where they're
// watching), with the park's local time — labeled with its zone ("10:10 PDT")
// — trailing in smaller parentheses so a west-coast game still shows when it
// starts on-site. The parenthetical is dropped when the feed carries no venue
// timezone (lean MiLB rows) or when the two clocks read the same (viewer is in
// the park's zone) — no redundant "(7:10 CDT)".
function StatusText({ game }) {
  const s = game.abstractState
  if (s === 'Final') return <span className="gamecard__status">Final</span>
  if (s === 'Live') return null // the LIVE pill carries it; no redundant text
  let local
  let park = null
  try {
    const t = new Date(game.gameDate)
    const { tz, tzId } = game.venue ?? {}
    local = t.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
    if (tzId) {
      const parkTime = t.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: tzId,
      })
      if (parkTime !== local) park = tz ? `${parkTime} ${tz}` : parkTime
    }
  } catch {
    return (
      <span className="gamecard__status">
        {game.detailedState ?? 'Scheduled'}
      </span>
    )
  }
  return (
    <span className="gamecard__status">
      {local}
      {park && <span className="gamecard__status-park"> ({park})</span>}
    </span>
  )
}
