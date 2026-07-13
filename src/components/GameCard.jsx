import { TeamLogo } from './TeamLogo.jsx'
import { splitName } from '../lib/teamSplits.js'
import { leagueLogoUrl, favoriteAccentColor } from '../lib/teams.js'
import { selectGameStatus } from '../api/select.js'
import { humanDate } from '../lib/dates.js'

// A single game on the slate. Deliberately spoiler-free: shows matchup, level,
// and coarse status only — never the score, even for finals. The one
// exception is `gameScore` — the blended, capped-factor Game Score rating
// (see ADR-0015) — which the caller passes in already gated by the
// useGameScoreVisible preference and null when not yet computed.
//
// Layout: two team columns (away, then home), each a large grayscale logo above
// a stacked name — location over mascot (MILWAUKEE / BREWERS), like a scorebook.
export function GameCard({
  game,
  pinnedTeamId,
  uniformsReady,
  prospectCount = 0,
  gameScore = null,
  dateLabel = null,
  onSelect,
  onBoxScore,
}) {
  const live = game.abstractState === 'Live'
  const status = selectGameStatus(game)
  // A postponed game gets its own stamped treatment (see PostponedBanner) rather
  // than the corner pill — and, critically, is never wrapped in the past-day
  // flip card (see GameSelect), whose rotated back face made an absolutely-
  // positioned corner pill leak through mirrored on iOS. There's also no result
  // to reveal: the game didn't happen.
  const postponed = status.isPostponed
  const dhLabel = doubleHeaderLabel(game)
  const pinned = !!pinnedTeamId
  // Sets --pin-accent for the pinned border/gradient + star (see index.css);
  // left unset (undefined) when not pinned or the team has no known color, so
  // the CSS var(--pin-accent, var(--field)) fallback takes over.
  const style = pinned ? { '--pin-accent': favoriteAccentColor(pinnedTeamId) } : undefined
  return (
    <div
      className={`gamecard ${pinned ? 'gamecard--pinned' : ''} ${postponed ? 'gamecard--postponed' : ''}`}
      style={style}
    >
      {/* Full-width date strip for a cross-date list (Top Games) where each
          card needs its own day, unlike the slate (one date heads the whole
          page). Absent on every ordinary slate card. */}
      {dateLabel && <div className="gamecard__datebanner">{dateLabel}</div>}
      {postponed ? null : status.label ? (
        <span className="gamecard__delay" title={status.reason || undefined}>
          {status.label}
        </span>
      ) : (
        live && <span className="gamecard__live">Live</span>
      )}
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
        {postponed && <PostponedBanner game={game} status={status} />}
        {!postponed && game.abstractState !== 'Final' && (
          <ReadyStrip game={game} uniformsReady={uniformsReady} />
        )}
        <div className="gamecard__meta">
          {game.sportLabel && game.sportLabel !== 'MLB' && (
            <span className="gamecard__level">{game.sportLabel}</span>
          )}
          {dhLabel && <span className="gamecard__dh">{dhLabel}</span>}
          {prospectCount > 0 && (
            <span className="gamecard__prospects">
              <img src={leagueLogoUrl()} alt="" className="gamecard__prospects-logo" />
              {prospectCount} Prospect{prospectCount === 1 ? '' : 's'}
            </span>
          )}
          {pinned && <span className="gamecard__pin">★</span>}
          <StatusText game={game} gameScore={gameScore} />
        </div>
      </button>
      {onBoxScore && !postponed && (
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

// The postponed treatment: a kraft-tape strip under the matchup carrying a
// rubber-stamped "POSTPONED", the cause ("Inclement Weather"), and — once MLB
// has set one — the make-up date the game moved to (rescheduleGameDate, a
// spoiler-free calendar date, never a score). Replaces both the corner delay
// pill and the readiness strip: neither applies to a game that isn't happening.
function PostponedBanner({ game, status }) {
  const makeup = rescheduleLabel(game)
  return (
    <div className="postponed" role="status">
      <span className="postponed__stamp">Postponed</span>
      {(status.reason || makeup) && (
        <span className="postponed__lines">
          {status.reason && (
            <span className="postponed__reason">{status.reason}</span>
          )}
          {makeup && (
            <span className="postponed__makeup">Makeup&nbsp;·&nbsp;{makeup}</span>
          )}
        </span>
      )}
    </div>
  )
}

// "Sat, Jul 11" for a rescheduled game, or '' when no make-up date is set yet
// (a fresh postponement carries no rescheduleGameDate — the banner then just
// reads POSTPONED). Parsed as a plain calendar date (humanDate), never shifted
// by the viewer's zone.
function rescheduleLabel(game) {
  const d = game.rescheduleGameDate
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? humanDate(d) : ''
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
// `gameScore`: the pre-formatted ("7.5") Game Score badge, already gated by
// the useGameScoreVisible preference and null when this gamePk hasn't been
// scored yet (see api/gameScore.js) — this component just renders whatever
// it's handed, dot-joined after "Final". A deliberate, narrow exception to
// "never spoiler-revealing" (see ADR-0015): the number is a blended,
// capped-factor rating, never the score itself.
function StatusText({ game, gameScore }) {
  const status = selectGameStatus(game)
  if (status.label) return null // the delay pill carries it; no redundant text
  const s = game.abstractState
  if (s === 'Final') {
    return (
      <span className="gamecard__status">
        Final
        {gameScore && (
          <span className="gamecard__gamescore"> · {gameScore}</span>
        )}
      </span>
    )
  }
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
