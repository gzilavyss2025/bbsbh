import { useState } from 'react'
import { TeamTreatmentMark } from '../logo/TeamTreatmentMark.jsx'
import { BreakableLocation } from '../ui/BreakableLocation.jsx'
import { splitName } from '../../lib/teamSplits.js'
import { leagueLogoUrl, favoriteAccentColor, defaultTreatmentFor } from '../../lib/teams.js'
import { selectGameStatus } from '../../api/select.js'
import { humanDate } from '../../lib/dates.js'
import { doubleHeaderLabel } from '../../lib/resultCards.js'
import { useAsync } from '../../hooks/useAsync.js'
import { fetchJerseysData, jerseyTreatmentFor } from '../../api/jerseys.js'
import { liveTreatmentFor } from '../../api/uniforms.js'
import { broadcastLogoFor } from '../../lib/broadcastLogos.js'
import { parkBackdrop } from '../../lib/ballpark/parkBackdrop.js'
import { useCopy } from '../../copy/copyContext.js'

// Whether this device has a pointer that can hover — the SAME condition
// 06a-gamecard-parkart.css gates the ballpark backdrop on, asked again in JS so
// the two cannot disagree. Without it a tap on a phone fires pointerenter and
// fetches a 1000px photograph the media query will never show: the app is
// phone-first, and a desktop nicety must cost a phone nothing. Asked per event
// rather than once at module load, so plugging in a mouse starts working.
const canHover = () => window.matchMedia?.('(hover: hover)').matches ?? false

// A single game on the slate. Deliberately spoiler-free: shows matchup, level,
// and coarse status only — never the score, even for finals.
//
// Layout: two team columns (away, then home), each a large grayscale logo above
// a stacked name — location over mascot (MILWAUKEE / BREWERS), like a scorebook.
export function GameCard({
  game,
  pinnedTeamId,
  prospectCount = 0,
  // Pre-formatted { awayRuns, homeRuns, inning, label } for the "Scores
  // Unlocked" day pass, or null
  // (the default) — see api/schedule.js fetchSlateScores + lib/slateScoreLine.js.
  // Null keeps this card byte-identical to today; the caller (GameSelect) passes
  // a value only while the pass is on AND for today's slate. Every other caller
  // (Top Games, All-Star Rosters) leaves it null.
  liveLine = null,
  dateLabel = null,
  // `{ [gamePk]: { [teamId]: { code, text } } }` from a same-day batched
  // fetchGameJerseys call (see GameSelect.jsx) — today's slate only, so a
  // same-day alternate/City Connect posting shows up before the next nightly
  // cron writes it into jerseysData below. null for every other caller
  // (All-Star Rosters, a past day already covered by that cron).
  liveJerseys = null,
  // National TV network name ("FOX", "FS1", "ESPN", …) for this gamePk. It
  // rides the slate's own schedule request now (normalizeGame's
  // `nationalBroadcast`, see api/broadcast.js) rather than a second batched
  // call — undefined/'' for the vast majority of games, which carry no
  // national assignment.
  national = '',
  // True for the slate's first cards, whose marks are the page's largest
  // above-the-fold images — threaded to TeamLogo to skip lazy loading there.
  eager = false,
  // The game 2 this card is standing in for, on a back-to-back twin bill that
  // hasn't started yet (resultCards.js's stackDoubleHeaders) — null on every
  // other card, and on this one again the moment game 1 goes live. It turns the
  // corner pill
  // into DOUBLEHEADER and floats a second sheet under the card; the card still
  // opens game 1, which is the game you'd score first either way.
  stackedGame = null,
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
  // One flag for everything the Scores Unlocked line displaces while it's
  // showing: the corner Final text (relocated into its center slot) and the
  // readiness pips (a pre-game checklist — once runs and an inning are on the
  // card, "is the scorebook ready" is answered). Pre-game cards keep both:
  // no line renders before first pitch.
  const hasScoreLine = !!liveLine && !postponed
  const stacked = !!stackedGame
  const dhLabel = doubleHeaderLabel(game, stacked)
  const pinned = !!pinnedTeamId
  // Static same-origin file (nightly-generated), same "fetch once, session
  // cache" shape as every other public/data/*.json reader — this is not one
  // network request per card, just a cache hit after the first card mounts.
  const { data: jerseysData } = useAsync(fetchJerseysData, [])
  // The park this game is at, as a photo to wash in behind the '@' on hover —
  // null for every venue we hold no art for, which is every MiLB park and every
  // one-off neutral site (see lib/ballpark/parkBackdrop.js). Reading the copy
  // store here is a context read, not a fetch.
  const { t } = useCopy()
  const park = parkBackdrop(game.venue?.name, t)
  // The photo is fetched on FIRST HOVER, not on mount — a slate is fifteen cards
  // and these are 1000px-wide photographs, so loading them up front would cost
  // megabytes to decorate an interaction most visits never make. Naming the
  // image only in a `:hover` rule would get the same laziness for free, but then
  // it un-names on leave and the fade-OUT has nothing left to fade; arming it
  // once in state keeps the image mounted so both directions animate. One
  // flip per card, ever.
  const [parkArmed, setParkArmed] = useState(false)
  const armPark = park && !parkArmed ? () => canHover() && setParkArmed(true) : undefined
  // --pin-accent drives the pinned border/gradient + star (see index.css) and is
  // left unset when not pinned or the team has no known color, so the CSS
  // var(--pin-accent, var(--field)) fallback takes over. Same idea for the two
  // park properties: absent means the backdrop rule paints nothing.
  const style = {
    ...(pinned ? { '--pin-accent': favoriteAccentColor(pinnedTeamId) } : null),
    ...(park ? { '--park-focus': park.focus } : null),
    ...(park && parkArmed ? { '--park-art': park.cssUrl } : null),
  }
  const card = (
    // `title` is the backdrop's CC BY / CC BY-SA attribution, carried on the
    // CARD rather than on the layer itself: the photograph is the whole card
    // now, and the layer sits under everything hoverable, so a title down there
    // would never be read. Child titles (the delay pill, the readiness pips)
    // still win where they exist, which is right — they are about the game,
    // this is about the picture behind it.
    <div
      className={`gamecard ${pinned ? 'gamecard--pinned' : ''} ${postponed ? 'gamecard--postponed' : ''}`}
      style={Object.keys(style).length ? style : undefined}
      onPointerEnter={armPark}
      onFocus={armPark}
      title={park?.title}
    >
      {/* The ballpark, washed grayscale and faded in behind the WHOLE card on
          hover. First child, painting under everything else: the card is a
          scorebook entry and the park is the paper it is written on. */}
      {park && <span className="gamecard__parkart" aria-hidden="true" />}
      {/* Full-width date strip for a cross-date list where each card needs
          its own day, unlike the slate (one date heads the whole page).
          Absent on every ordinary slate card. */}
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
          <TeamMark
            team={game.away}
            side="away"
            gamePk={game.gamePk}
            officialDate={game.officialDate}
            jerseysData={jerseysData}
            liveJerseys={liveJerseys}
            eager={eager}
          />
          <TeamMark
            team={game.home}
            side="home"
            gamePk={game.gamePk}
            officialDate={game.officialDate}
            jerseysData={jerseysData}
            liveJerseys={liveJerseys}
            eager={eager}
          />
          <TeamName team={game.away} side="away" />
          <TeamName team={game.home} side="home" />
        </div>
        {/* Additive score line, present ONLY under an active Scores Unlocked
            pass (liveLine non-null). It renders BELOW the matchup — the team
            colors, cap/jersey marks, and names above are untouched — so a card
            keeps its identity and just gains today's number. Each run total
            sits under its own team column (the marks and names above already
            say whose it is — no repeated abbreviations), penciled as a ledger
            numeral over a scorebook totals rule; the game state (live half,
            FINAL, F/10) always rides centered between them. On a final the
            winner is inked bold and the loser fades to graphite; while live
            both sides stay equal so the card's hierarchy doesn't repaint on
            every lead change. Screen readers get the full sentence
            (liveLine.label) instead of two bare digits. All tokens are
            uppercase-safe (digits, TOP/BOT/…, FINAL, F/n), no exemption.
            Suppressed for a game called off after it started (postponed) —
            run totals stacked over a POSTPONED stamp would be noise. */}
        {hasScoreLine && <ScoreLine liveLine={liveLine} />}
        {postponed && <PostponedBanner game={game} status={status} />}
        <div className="gamecard__meta">
          {/* Only shown in a cross-level list (All-Star Rosters — the caller
              that also passes dateLabel, since a single date-per-page
              assumption doesn't hold there either). The ordinary slate
              never passes dateLabel: the level toggle already scopes the
              whole page to one level, so repeating it on every card would
              just be noise. */}
          {dateLabel && game.sportLabel && game.sportLabel !== 'MLB' && (
            <span className="gamecard__level">{game.sportLabel}</span>
          )}
          {dhLabel && (
            <span
              className="gamecard__dh"
              title={stacked ? 'Two games. Game 2 starts after game 1 ends.' : undefined}
            >
              {dhLabel}
              {/* The pill alone reads as a fact about the day; a card that
                  opens ONE of the two games has to say which. Visual readers
                  get that from the start time already on the card (game 1's). */}
              {stacked && <span className="sr-only"> — this card opens game 1</span>}
            </span>
          )}
          {prospectCount > 0 && (
            <span className="gamecard__prospects">
              <img src={leagueLogoUrl()} alt="" className="gamecard__prospects-logo" />
              {prospectCount} Prospect{prospectCount === 1 ? '' : 's'}
            </span>
          )}
          <span className="gamecard__metaright">
            {!postponed && game.abstractState !== 'Final' && !hasScoreLine && (
              <ReadyPill game={game} />
            )}
            {!postponed && national && <NationalTvIcon network={national} />}
            <StatusText game={game} hasScoreLine={hasScoreLine} />
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
  if (!stacked) return card
  // Game 2's own sheet, offset behind game 1's card, so a twin bill LOOKS like
  // two games before you read the pill. The sheet is a SIBLING placed before
  // the card rather than a child of it: both are positioned elements at
  // z-index auto, so they paint in DOM order and game 1's card — border, fill
  // and all — lands whole on top. As a child it would paint OVER the card's
  // own background instead, and pushing it under with a negative z-index would
  // put it behind the page as well.
  return (
    <div className="gamecardstack">
      <span className="gamecardstack__sheet" aria-hidden="true" />
      {card}
    </div>
  )
}

// The Scores Unlocked run totals, one per team column (away left, home right,
// matching the marks above), with the game-state token optically centered
// between them (absolutely positioned, so its width never nudges the numerals
// off the column centers). Winner/loser inking applies only once the game is
// FINAL — the settled scorebook convention — never mid-game. The visual spans
// are aria-hidden and the full screen-reader sentence rides in one .sr-only
// span, because "4 … BOT 7 … 2" read aloud in DOM order carries no team
// context. (.sr-only's absolute positioning is also what keeps that span from
// becoming the grid's first item and shoving both numerals a track over.)
function ScoreLine({ liveLine }) {
  const { awayRuns, homeRuns, state, final, awayResult, homeResult, label } = liveLine
  // 'winner'/'loser' only once a Final settles it; null (no modifier) while
  // live and on a tie — the formatter owns that rule (slateScoreLine.js).
  const mod = (result) => (result ? ` gamecard__runs--${result}` : '')
  return (
    <div className={`gamecard__scoreline${final ? '' : ' gamecard__scoreline--live'}`}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className={`gamecard__runs t-num gamecard__runs--away${mod(awayResult)}`}>
        {awayRuns}
      </span>
      <span aria-hidden="true" className="gamecard__scorestate t-label">
        {state}
      </span>
      <span aria-hidden="true" className={`gamecard__runs t-num gamecard__runs--home${mod(homeResult)}`}>
        {homeRuns}
      </span>
    </div>
  )
}

// The postponed treatment: a kraft-tape strip under the matchup carrying a
// rubber-stamped "POSTPONED", the cause ("Inclement Weather"), and — once MLB
// has set one — the make-up date the game moved to (rescheduleGameDate, a
// spoiler-free calendar date, never a score). Replaces both the corner delay
// pill and the readiness strip: neither applies to a game that isn't happening.
export function PostponedBanner({ game, status }) {
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

// A small TV-screen glyph + the network name (FOX/ESPN/TBS/Apple TV+/…) —
// the fact a local viewer needs to know their own regional feed of this game
// is blacked out. Rides the same .gamecard__metaright line as the ready pill
// and start time/FINAL, between the two (after the pips, before the time —
// the pips only show pre-game, so this is the first thing on the line for a
// Final). The name prints as-is (ESPN's own casing) with CSS text-transform
// doing the visual uppercase, per the ALL-CAPS invariant (no per-component
// .toUpperCase() — scripts/check-name-casing.mjs). The logo alone is the
// label, with no exceptions: ESPN's streaming-only "Unlmtd" tier used to earn
// a red tag beside the bare ESPN mark, but it is an out-of-market
// subscription package rather than a national TV broadcast and api/broadcast.js
// now filters it out the same way it filters MLB.TV, so it never reaches here.
function NationalTvIcon({ network }) {
  const logo = broadcastLogoFor(network)
  if (logo) {
    return (
      <span className="gamecard__nationaltv" title={`National broadcast: ${network}`}>
        <img className="gamecard__nationaltv-logo" src={logo} alt="" />
      </span>
    )
  }
  return (
    <span className="gamecard__nationaltv" title={`National broadcast: ${network}`}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <rect x="1.5" y="3" width="13" height="9" rx="1.5" />
        <path d="M5 14.5h6" />
        <path d="M8 12v2.5" />
      </svg>
      {network}
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
// but it's not what's live now — Team Identity Lab separately solved the same
// dense-mark problem (a per-team edge-bleed scale-down, MAIN_OVERRIDES in
// teams.js) for its own Main-tile prototype, and that's the version wired in
// below: every tile (Main, Alternate, City Connect alike) gets its curated
// background + scale + optional recolored mark from teams.js, so a team's
// mark always reads legibly against its own fill.
function TeamMark({ team, side, gamePk, officialDate, jerseysData, liveJerseys = null, eager = false }) {
  // Swaps to a team's curated Alternate/City Connect mark when that's what
  // it's actually wearing this game. Preferred order: (1) `liveJerseys`, a
  // same-day batched live fetch (GameSelect.jsx), classified via the exact
  // same classifyUniformAsset the nightly cron uses — closes the gap where a
  // same-day posting didn't show on the slate until tomorrow's cron run (see
  // useGameData.js's liveJerseyTreatment, the same fix for the in-game
  // masthead); (2) jerseyTreatmentFor's nightly precompute
  // (scripts/gen-jerseys.mjs); (3) defaultTreatmentFor's guess for a game
  // outside both sources' coverage: away grey/road by default, City Connect
  // for a Friday home game if the club has one. Coverage is partial by
  // design — TeamLogo's own fallback chain quietly drops back to the base
  // logo for any team without curated art. The tile itself is the shared
  // TeamTreatmentMark, the same square the in-game masthead shows.
  const treatment =
    liveTreatmentFor(liveJerseys, gamePk, team.id, team.teamName) ??
    jerseyTreatmentFor(jerseysData, gamePk, team.id) ??
    defaultTreatmentFor(team.id, side, officialDate)
  return (
    <TeamTreatmentMark
      teamId={team.id}
      name={team.name}
      treatment={treatment}
      side={side}
      size={56}
      block="gamecard__logobox"
      className={`gamecard__logobox--${side}`}
      eager={eager}
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
function StatusText({ game, hasScoreLine = false }) {
  const status = selectGameStatus(game)
  if (status.label) return null // the delay pill carries it; no redundant text
  const s = game.abstractState
  if (s === 'Final') {
    // While the Scores Unlocked line renders, its centered state slot already
    // says FINAL (or F/n) right between the run totals — the corner text here
    // would be the same word orphaned a row below, so it moves, not repeats.
    if (hasScoreLine) return null
    return <span className="gamecard__status">Final</span>
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
