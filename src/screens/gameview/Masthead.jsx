import { TeamTreatmentMark } from '../../components/logo/TeamTreatmentMark.jsx'
import { humanDateWithYear } from '../../lib/dates.js'

// The game's masthead: two grayscale marks — away on the left, home on the
// right, an @ between — sized like the logos on the lineup pages, left-aligned
// in the page header, with the game's date and a Watch link side by side,
// right-aligned opposite them. Tapping a mark opens it enlarged for pencil
// sketching. The date and the Watch link are both structural, not
// score-revealing, so they render unconditionally (no seal).
export function Masthead({ away, home, date, gamePk, onSketch, isLive, keepAwake, onSetKeepAwake, treatment }) {
  return (
    <div className="masthead">
      <div className="masthead__teams">
        <MastheadLogo team={away} treatment={treatment?.away} side="away" season={date} onSketch={() => onSketch('away')} />
        {/* The same screen-print '@' the slate card uses (Big Shoulders
            Display, kraft-amber + navy a couple px out of register — see
            .gamecard__atmark), here an inline mark between the two logos
            rather than a faint background watermark. */}
        <span className="masthead__at" aria-hidden="true">
          <span className="masthead__at-ghost">@</span>
          <span className="masthead__at-ink">@</span>
        </span>
        <MastheadLogo team={home} treatment={treatment?.home} side="home" season={date} onSketch={() => onSketch('home')} />
      </div>
      <MastheadSide date={date} gamePk={gamePk} isLive={isLive} keepAwake={keepAwake} onSetKeepAwake={onSetKeepAwake} />
    </div>
  )
}

// The innings page's masthead: the two clubs split 50/50, each half the club's own tile colour
// with the scorebug's ripple rings behind its mark, edged and shadowed like a stamped card.
// A tap on a half opens the sketch modal, as on the plain masthead. Identity only, never a score.
export function MatchBand({ away, home, date, onSketch, treatment }) {
  return (
    <div className="masthead masthead--split">
      <MastheadLogo team={away} treatment={treatment?.away} side="away" season={date} onSketch={() => onSketch('away')} half />
      <MastheadLogo team={home} treatment={treatment?.home} side="home" season={date} onSketch={() => onSketch('home')} half />
      <span className="masthead__slash" aria-hidden="true" />
    </div>
  )
}

// The date, the keep-awake switch and Watch: the masthead's right side, and on the innings page
// the aside of the section jump bar.
export function MastheadSide({ date, gamePk, isLive, keepAwake, onSetKeepAwake }) {
  return (
    <div className="masthead__side">
      {date && <span className="masthead__date">{humanDateWithYear(date)}</span>}
      {/* Only worth showing (and worth the tap) while the game can actually
          hold the lock — pregame/Final it would just sit there inert. */}
      {isLive && <KeepAwakeToggle on={keepAwake} onToggle={() => onSetKeepAwake(!keepAwake)} />}
      {gamePk && <WatchButton gamePk={gamePk} />}
    </div>
  )
}

// Screen-wake-lock toggle, same switch convention as the Settings modal's
// Game Score pref (FavoriteTeamModal.jsx's favteamsheet__prefToggle) but
// compact enough to ride in the masthead next to Watch — this is a per-game,
// in-the-moment choice, not something worth burying in a separate modal.
function KeepAwakeToggle({ on, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? 'Keep screen awake: on' : 'Keep screen awake: off'}
      title="Keep the screen from sleeping during this live game"
      className={`awaketoggle${on ? ' is-on' : ''}`}
      onClick={onToggle}
    >
      <span className="awaketoggle__icon" aria-hidden="true">
        {on ? '☀' : '☾'}
      </span>
    </button>
  )
}

// Hands off to MLB.TV's own video player for this game — mlb.com's
// /tv/g{gamePk} route (confirmed live against mlb.com/tv: the page identifies
// itself as "MLB.TV Web"). Deliberately NOT /gameday/{gamePk} (an earlier
// version of this button used that): mlb.com's own
// /.well-known/apple-app-site-association lists "/tv/g*" as a path the MLB
// app registers for universal links but does NOT list "/gameday/*" at all —
// so a gameday link never actually opened the app, only Safari — and
// gameday is MLB's play-by-play/box-score tracker, i.e. exactly the kind of
// score-revealing page this app exists to seal, the opposite of what a
// "watch" button should hand off to. /tv/g* is registered, opens the app
// directly into the video player, and never routes through that tracker.
// Never spoiler-revealing on OUR side — it's a game identifier, not a score;
// once the user is watching, seeing the live broadcast (and its score) is
// the point of tapping Watch, not a leak from this app's own UI.
// The wordmark is MLB's own "MLBTV-19-ondark" asset (linked from
// mlb.com/live-stream-games), saved locally at public/icons/mlbtv-logo.svg
// rather than hotlinked — it already carries its own light badge shape,
// meant to sit on a dark surface like this pill's navy fill.
function WatchButton({ gamePk }) {
  return (
    <a
      className="btn btn--control btn--ink masthead__watch"
      href={`https://www.mlb.com/tv/g${gamePk}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Watch this game on MLB.TV"
    >
      <img className="masthead__watchlogo" src="/icons/mlbtv-logo.svg" alt="Watch on MLB.TV" />
      <span className="btn__icon" aria-hidden="true">↗</span>
    </a>
  )
}
// The mark inside the masthead tile, sized so the EDGE_BLEED overscale
// TeamTreatmentMark applies (1.32) lands it at ~53px — 20% larger than the
// bare 44px logo this tile replaced. The tile itself is a little larger
// still, so the mark reads as printed on a uniform patch rather than filling
// a frame edge to edge.
const MASTHEAD_MARK = 40

// `half` is the split masthead's panel: the tile fills half the band, and its mark is larger.
const HALF_MARK = 56

function MastheadLogo({ team, treatment, side, season, onSketch, half = false }) {
  return (
    <button
      type="button"
      className={`masthead__logo${half ? ' masthead__logo--half' : ''}`}
      onClick={onSketch}
      aria-label={`Enlarge ${team.name || 'team'} logo for sketching`}
    >
      <TeamTreatmentMark
        teamId={team.id}
        name={team.name}
        treatment={treatment}
        side={side}
        size={half ? HALF_MARK : MASTHEAD_MARK}
        season={season}
        block={half ? 'masthead__half' : 'masthead__logobox'}
        className={half ? `masthead__half--${side}` : ''}
      />
    </button>
  )
}
