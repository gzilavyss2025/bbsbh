import { useEffect, useRef, useState } from 'react'
import { leagueLogoUrl, favoriteAccentColor } from '../../lib/teams.js'
import { selectGameStatus } from '../../api/select.js'
import { doubleHeaderLabel } from '../../lib/resultCards.js'
import { useAsync } from '../../hooks/useAsync.js'
import { fetchJerseysData } from '../../api/jerseys.js'
import { parkBackdrop } from '../../lib/ballpark/parkBackdrop.js'
import { parkWashColorOverride, parkWashIntensity } from '../../lib/ballpark/parkWash.js'
import { useCopy } from '../../copy/copyContext.js'
import {
  resolveTreatment,
  tileColorFor,
  ScoreLine,
  PostponedBanner,
  ReadyPill,
  NationalTvIcon,
  TeamMark,
  TeamName,
  StatusText,
} from './GameCardParts.jsx'

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
  // One flag for what the Scores Unlocked line displaces while it's showing:
  // the corner Final text, relocated into its center slot. Pre-game cards
  // keep the corner text: no line renders before first pitch. (The readiness
  // pips are a separate, Preview-only gate below — a game that has gone Live,
  // suspended or not, already answered "is the scorebook ready".)
  const hasScoreLine = !!liveLine && !postponed
  const stacked = !!stackedGame
  const dhLabel = doubleHeaderLabel(game, stacked)
  // A suspended game's card may carry today's independently-scheduled game
  // riding behind it (stackSuspendedContinuation, GameSelect) rather than a
  // true doubleheader's game 2 — MLB's feed marks neither row as part of a
  // doubleheader (both carry doubleHeader 'N'), so dhLabel above is null for
  // this pairing. This pill fills that gap; mutually exclusive with dhLabel
  // since a game can't be both.
  const suspendedPairLabel = !dhLabel && stacked && status.isSuspended ? 'Two Games Today' : null
  const pinned = !!pinnedTeamId
  // Static same-origin file (nightly-generated), same "fetch once, session
  // cache" shape as every other public/data/*.json reader — this is not one
  // network request per card, just a cache hit after the first card mounts.
  const { data: jerseysData } = useAsync(fetchJerseysData, [])
  // The park this game is at, as a photo to wash in behind the '@' once the
  // card is on screen — null for every venue we hold no art for, which is
  // every MiLB park and every one-off neutral site (see
  // lib/ballpark/parkBackdrop.js). Reading the copy store here is a context
  // read, not a fetch.
  const { t } = useCopy()
  const park = parkBackdrop(game.venue?.name, t)
  // The photo is fetched the moment the card first appears on screen (see the
  // effect below), not on mount — a slate is fifteen cards and even the small
  // companion image isn't free, so loading them all up front would cost bytes
  // decorating cards a visit never scrolls to. Naming the image only in an
  // in-view CSS rule would get the same laziness for free, but then it
  // un-names on leaving view and the fade-OUT has nothing left to fade; arming
  // it once in state keeps the image mounted so both directions animate. One
  // flip per card, ever — parkInView (below) keeps toggling after that to
  // drive the fade, but parkArmed never un-arms.
  const [parkArmed, setParkArmed] = useState(false)
  // Fades .gamecard__parkart in and out on this class as the card crosses the
  // screen (06a-gamecard-parkart.css), kept in sync with the IntersectionObserver
  // below — the SAME trigger and the SAME small photo (park.cssUrl) on every
  // device now. A hover pointer used to be a second, separate trigger that
  // fetched the full 1000px photo instead; that bought nothing (the wash
  // renders grayscale at 0.24 opacity either way) and meant a mouse user saw
  // no backdrop at all until they happened to hover a card, so it was dropped
  // in favor of one mechanism that shows the same recognizable photo to
  // everyone, phone or desktop, as soon as their card is in view. Hover is
  // still a desktop-only extra, just a cheaper one now: no second fetch, only
  // the `--park-tint` colour recolouring an already-loaded photo — see
  // 06a-gamecard-parkart.css's `@media (hover: hover)` block.
  const [parkInView, setParkInView] = useState(false)
  const cardRef = useRef(null)
  // Skipped outright under Data Saver, a real signal the visitor already gave
  // the browser about exactly this kind of decorative weight. `game.venue?.name`,
  // not `park` — a fresh object every render — is the dependency, because
  // that's what park's identity actually depends on, and it stays stable for
  // one game card's whole lifetime.
  useEffect(() => {
    if (!park || navigator.connection?.saveData) return
    const el = cardRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      setParkInView(entry.isIntersecting)
      if (entry.isIntersecting) setParkArmed(true)
    })
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.venue?.name])
  // The home club's own tile colour, so a hover on desktop recolours the
  // grayscale wash toward the club actually playing there instead of a
  // neutral wash — the AWAY club's colour would tint a park in someone else's
  // livery, which reads wrong for a stadium. Uses the SAME treatment jerseysData/
  // liveJerseys already resolve for the home TeamMark below (resolveTreatment),
  // so a same-day City Connect posting tints the same colour its tile wears.
  // null for a team with no curated colour on file — the CSS var() fallback
  // then shows the same untinted wash a hover always has. `parkWashColorOverride`
  // is this club's own escape hatch (the identity drawer's Ballpark wash group,
  // src/lib/ballpark/parkWash.js) — checked first, same precedence every other identity
  // field gives its override over the app's own computed default.
  const homeTreatment = park
    ? resolveTreatment(game.home, 'home', game.gamePk, game.officialDate, jerseysData, liveJerseys)
    : null
  const parkTint = park
    ? (parkWashColorOverride(game.home.id) ?? tileColorFor(game.home.id, homeTreatment, 'home'))
    : null
  // This club's own wash opacity, or the app's default (06a-gamecard-parkart.css's
  // hard-coded 0.55, restated as PARK_WASH_DEFAULT_INTENSITY so the two can't
  // drift) — set unconditionally on every park-carrying card so an override
  // takes effect even where --park-tint is the untinted CSS fallback.
  const parkWashOpacity = park ? parkWashIntensity(game.home.id) : null
  // --pin-accent drives the pinned border/gradient + star (see index.css) and is
  // left unset when not pinned or the team has no known color, so the CSS
  // var(--pin-accent, var(--field)) fallback takes over. Same idea for the park
  // properties: absent means the backdrop rule paints nothing (or, for
  // --park-tint, paints the plain untinted wash).
  const style = {
    ...(pinned ? { '--pin-accent': favoriteAccentColor(pinnedTeamId) } : null),
    ...(park ? { '--park-focus': park.focus } : null),
    ...(park && parkArmed ? { '--park-art': park.cssUrl } : null),
    ...(parkTint ? { '--park-tint': parkTint } : null),
    ...(parkWashOpacity != null ? { '--park-wash-intensity': parkWashOpacity } : null),
  }
  const card = (
    // No native `title` tooltip on this card — the backdrop's park name prints
    // instead, on the card itself, next to the start time (.gamecard__parkname
    // below): a reveal you can actually see coming, not a browser tooltip.
    <div
      ref={cardRef}
      className={`gamecard ${pinned ? 'gamecard--pinned' : ''} ${postponed ? 'gamecard--postponed' : ''} ${parkInView ? 'gamecard--parkinview' : ''}`}
      style={Object.keys(style).length ? style : undefined}
    >
      {/* The ballpark, washed grayscale and faded in behind the WHOLE card as
          it crosses the screen (see the IntersectionObserver above). First
          child, painting under
          everything else: the card is a scorebook entry and the park is the
          paper it is written on. */}
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
          {suspendedPairLabel && (
            <span className="gamecard__dh">
              {suspendedPairLabel}
              <span className="sr-only">
                {' '}
                — this card opens the suspended game; a separate game follows
                once it&rsquo;s done
              </span>
            </span>
          )}
          {prospectCount > 0 && (
            <span className="gamecard__prospects">
              <img src={leagueLogoUrl()} alt="" className="gamecard__prospects-logo" />
              {prospectCount} Prospect{prospectCount === 1 ? '' : 's'}
            </span>
          )}
          {/* The ballpark's name, printed — not a title tooltip — left in this
              row against the ready pips/start time riding right in
              .gamecard__metaright below. Same font treatment as
              .gamecard__status (the start time) so it reads as a peer fact on
              the line, not a caption. Faded in only while the backdrop itself
              is showing (see 06a-gamecard-parkart.css's hover rule for
              .gamecard__parkart) — the name names the photo behind it, so the
              two appear together. */}
          {park && <span className="gamecard__parkname">{park.name}</span>}
          <span className="gamecard__metaright">
            {!postponed && game.abstractState === 'Preview' && (
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
