import { TeamTreatmentMark } from './TeamTreatmentMark.jsx'
import { BreakableLocation } from './BreakableLocation.jsx'
import { splitName } from '../lib/teamSplits.js'
import { leagueLogoUrl, favoriteAccentColor } from '../lib/teams.js'
import { selectGameStatus } from '../api/select.js'
import { humanDate } from '../lib/dates.js'
import { doubleHeaderLabel } from '../lib/resultCards.js'
import { useAsync } from '../hooks/useAsync.js'
import { fetchJerseysData, jerseyTreatmentFor } from '../api/jerseys.js'

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
  prospectCount = 0,
  gameScore = null,
  // Pre-formatted { score, inning } for the "Scores Unlocked" day pass, or null
  // (the default) — see api/schedule.js fetchSlateScores + lib/slateScoreLine.js.
  // Null keeps this card byte-identical to today; the caller (GameSelect) passes
  // a value only while the pass is on AND for today's slate. Every other caller
  // (Top Games, All-Star Rosters) leaves it null.
  liveLine = null,
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
  // Static same-origin file (nightly-generated), same "fetch once, session
  // cache" shape as every other public/data/*.json reader — this is not one
  // network request per card, just a cache hit after the first card mounts.
  const { data: jerseysData } = useAsync(fetchJerseysData, [])
  return (
    <div
      className={`gamecard ${pinned ? 'gamecard--pinned' : ''} ${postponed ? 'gamecard--postponed' : ''}`}
      style={style}
    >
      {/* Full-width date strip for a cross-date list (Top Games) where each
          card needs its own day, unlike the slate (one date heads the whole
          page). Absent on every ordinary slate card. */}
      {dateLabel && <div className="gamecard__datebanner">{dateLabel}</div>}
      {pinned && (
        <span className="gamecard__pinbadge" aria-label="Pinned team">
          <span className="gamecard__pinbadge-star">★</span>
        </span>
      )}
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
          {/* A screen-print-style watermark behind both marks rather than a
              small glyph between them — two offset '@' layers (see
              .gamecard__atmark in index.css), decorative like the mark it
              replaces. */}
          <span className="gamecard__atmark" aria-hidden="true">
            <span className="gamecard__atmark-ghost">@</span>
            <span className="gamecard__atmark-ink">@</span>
          </span>
          <TeamMark team={game.away} side="away" gamePk={game.gamePk} jerseysData={jerseysData} />
          <TeamMark team={game.home} side="home" gamePk={game.gamePk} jerseysData={jerseysData} />
          <TeamName team={game.away} side="away" />
          <TeamName team={game.home} side="home" />
        </div>
        {/* Additive score line, present ONLY under an active Scores Unlocked
            pass (liveLine non-null). It renders BELOW the matchup — the team
            colors, cap/jersey marks, and names above are untouched — so a card
            keeps its identity and just gains today's number. All tokens are
            uppercase-safe (abbrevs, digits, en-dash, TOP/BOT/…), no exemption. */}
        {liveLine && (
          <div className="gamecard__unlockline">
            <span className="gamecard__unlockscore">{liveLine.score}</span>
            {liveLine.inning && (
              <span className="gamecard__unlockinning">{liveLine.inning}</span>
            )}
          </div>
        )}
        {postponed && <PostponedBanner game={game} status={status} />}
        <div className="gamecard__meta">
          {/* Only shown in a cross-level list (Top Games, All-Star Rosters —
              the callers that also pass dateLabel, since a single date-per-
              page assumption doesn't hold there either). The ordinary slate
              never passes dateLabel: the level toggle already scopes the
              whole page to one level, so repeating it on every card would
              just be noise. */}
          {dateLabel && game.sportLabel && game.sportLabel !== 'MLB' && (
            <span className="gamecard__level">{game.sportLabel}</span>
          )}
          {dhLabel && <span className="gamecard__dh">{dhLabel}</span>}
          {prospectCount > 0 && (
            <span className="gamecard__prospects">
              <img src={leagueLogoUrl()} alt="" className="gamecard__prospects-logo" />
              {prospectCount} Prospect{prospectCount === 1 ? '' : 's'}
            </span>
          )}
          <span className="gamecard__metaright">
            {!postponed && game.abstractState !== 'Final' && (
              <ReadyPill game={game} />
            )}
            <StatusText game={game} gameScore={gameScore} />
          </span>
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

// Scorebook-readiness pill: four small checkbox pips, in a fixed order (each
// team's batting order, the umpire crew, both starting pitchers), telling you
// at a glance whether the basics you'd pencil in pre-game are posted yet. The
// green pill chrome (background/border) and the "Ready" word both only show
// up once all four have posted — `--complete` below — since a tinted "good
// status" background around a still-incomplete checklist would claim a state
// that isn't true yet, the same problem as the old red-while-idle chips.
// While incomplete it's just the bare pips: each one already draws its own
// checkbox border, so the row still reads as a deliberate checklist with no
// outer chrome needed. Deliberately unlabeled beyond "Ready" — the pip
// position is the label, learned once, since it never changes card to card —
// so a not-yet-posted item is just a hollow box, not a red ✗. Rides the same
// line as the game's start time (`.gamecard__metaright` in GameCard) rather
// than its own row, at that line's regular weight — a status, not a
// headline. Spoiler-free; none of these reveal a score. Uniforms used to
// ride along as a fifth pip, but that data never posts until first pitch, so
// it carried no pre-game signal — dropped rather than shown red for the
// entire wait.
function ReadyPill({ game }) {
  const r = game.readiness ?? {}
  const items = [
    { ok: !!r.awayLineup, label: `${game.away.abbreviation || 'Away'} lineup` },
    { ok: !!r.homeLineup, label: `${game.home.abbreviation || 'Home'} lineup` },
    { ok: !!r.umpires, label: 'Umpires' },
    { ok: !!r.pitchers, label: 'Starting pitchers' },
  ]
  const readyCount = items.filter((it) => it.ok).length
  const allReady = readyCount === items.length
  return (
    <span
      className={`gamecard__readypill ${allReady ? 'gamecard__readypill--complete' : ''}`}
      aria-label={`Scorebook readiness, ${readyCount} of ${items.length} posted`}
    >
      {allReady && 'Ready'}
      <span className="gamecard__readypill-pips">
        {items.map((it) => (
          <span
            key={it.label}
            className={`pip ${it.ok ? 'pip--on' : 'pip--off'}`}
            title={`${it.label}: ${it.ok ? 'posted' : 'not posted yet'}`}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <rect x="1.5" y="1.5" width="13" height="13" rx="3" />
              <path className="pip__tick" d="M4 8.5l2.5 2.5L12 5.5" />
            </svg>
          </span>
        ))}
      </span>
    </span>
  )
}

// A team's mark, framed in a uniform bordered square so the two logos read at a
// consistent size. The mark is overscaled to bleed to the frame like a printed
// badge (the tile clips the overflow), the way Caught Looking tiles its club
// marks. Full color here on the slate — elsewhere (the in-game masthead, the
// logo sheet) the marks stay grayscale. Sits in the top grid row.
//
// A per-team tinted tile fill for the DEFAULT/Main logo was tried here once
// (first a teamTintColor soft wash, then a hand-picked solid color) and
// reverted: a dense/large club mark (the Yankees' interlocking NY, at
// minimum) read as if it colored the whole tile even against a light fill.
// That first attempt's hand-picked color list is preserved in
// .scratch/gamecard-team-colors/issues/01-solid-tile-colors.md for reference,
// but it's not what's live now — Team Color Lab separately solved the same
// dense-mark problem (a per-team edge-bleed scale-down, MAIN_OVERRIDES in
// teams.js) for its own Main-tile prototype, and that's the version wired in
// below: every tile (Main, Alternate, City Connect alike) gets its curated
// background + scale + optional recolored mark from teams.js, so a team's
// mark always reads legibly against its own fill.
function TeamMark({ team, side, gamePk, jerseysData }) {
  // Swaps to a team's curated Alternate/City Connect mark when that's what
  // it's actually wearing this game (scripts/gen-jerseys.mjs, nightly).
  // Coverage is partial by design — TeamLogo's own fallback chain quietly
  // drops back to the base logo for any team without curated art, or before
  // the uniforms assignment has posted (jerseyTreatmentFor -> null either
  // way). The tile itself is the shared TeamTreatmentMark, the same square
  // the in-game masthead shows.
  return (
    <TeamTreatmentMark
      teamId={team.id}
      name={team.name}
      treatment={jerseyTreatmentFor(jerseysData, gamePk, team.id)}
      size={56}
      block="gamecard__logobox"
      className={`gamecard__logobox--${side}`}
    />
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
      {location && <BreakableLocation text={location} className="gamecard__loc" />}
      <span className="gamecard__mascot">{mascot}</span>
    </span>
  )
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
