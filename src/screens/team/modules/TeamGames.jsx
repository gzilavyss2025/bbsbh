import { useState, useRef, useMemo, useLayoutEffect, useEffect } from 'react'
import { gamePath } from '../../../lib/route.js'
import { useNav } from '../../../lib/nav.js'
import { TeamLogo } from '../../../components/identity/TeamLogo.jsx'
import { DOW_LABELS, MONTH_LABELS } from './TeamStatsCard.jsx'

// Two surfaces over the same ticket-stub card, both fed lists the caller has
// already `won != null`-filtered (see loadGames.js / loadOverview.js — never
// re-derived from Final status here, which would bypass the fetchTeamSchedule
// cutoff and leak the very game a mid-scoring visitor opened this page from):
//
//   LastTenGames — the Overview's preview door: a horizontal strip of the true
//                  last ten, oldest -> newest, opening at the newest card.
//   AllGames     — the Games tab's list of decided games: the same cards laid
//                  out in a wrapping grid, newest first, capped until the user
//                  asks for more.
//
// The card markup/CSS (`.last10__*`) is shared by both — the class prefix
// predates the grid and is left as-is rather than churned through ~40 CSS
// rules; see the block comment over `.last10` in index.css.

// A setup jump, not a user-visible scroll gesture — bypasses the track's own
// `scroll-behavior: smooth` (index.css) so the strip's opening position lands
// instantly instead of visibly gliding across from the oldest card.
function jumpScrollLeft(el, value) {
  const prev = el.style.scrollBehavior
  el.style.scrollBehavior = 'auto'
  el.scrollLeft = value
  el.style.scrollBehavior = prev
}

// Ticket-stub day/month/date parts for a game card. Same UTC-parse convention
// as dayOfWeekRecord/todayDowLabel in TeamStatsCard, so the weekday can't
// drift across a DST edge.
function gameDateParts(apiDate) {
  const d = new Date(`${apiDate}T00:00:00Z`)
  return { dow: DOW_LABELS[d.getUTCDay()], month: MONTH_LABELS[d.getUTCMonth()], day: d.getUTCDate() }
}

// One decided game as a torn ticket stub: a date leaf over a win/loss ink
// stamp carrying the opponent's mark, the score printed last. Routes to that
// game's box score — the one destination that already shows the score this
// card just displayed.
function GameStubCard({ game: g }) {
  const navigate = useNav()
  const { dow, month, day } = gameDateParts(g.apiDate)
  const hasScore = g.runs != null && g.oppRuns != null
  const winRuns = g.won ? g.runs : g.oppRuns
  const lossRuns = g.won ? g.oppRuns : g.runs
  const extraInnings = g.innings && g.innings > 9 ? `${g.innings} inn` : null
  const gmTag = g.doubleHeader !== 'N' ? `Gm ${g.gameNumber}` : null
  const meta = extraInnings || gmTag
  const scoreWords = hasScore
    ? `${g.won ? 'won' : 'lost'} ${g.runs} to ${g.oppRuns}`
    : g.won
      ? 'won'
      : 'lost'
  const label = `${dow}, ${month} ${day}, ${g.isHome ? 'versus' : 'at'} ${g.opponent.name}, ${scoreWords}${extraInnings ? ` in ${g.innings} innings` : ''}`

  return (
    <button
      type="button"
      className={`last10__card${g.won ? ' last10__card--win' : ' last10__card--loss'}${g.isHome ? ' last10__card--home' : ''}`}
      onClick={() =>
        navigate(gamePath(g.apiDate, g.away.abbreviation, g.home.abbreviation, 'boxscore', g.gameNumber))
      }
      aria-label={label}
    >
      <div className="last10__stub">
        <div className="last10__cap">
          {dow} &middot; {month}
        </div>
        <div className="last10__daynum">{day}</div>
      </div>
      <div className="last10__band">
        <span className="last10__wl">{g.won ? 'W' : 'L'}</span>
        <TeamLogo
          teamId={g.opponent.id}
          name={g.opponent.name}
          size={30}
          variant="mono"
          className="last10__logo"
        />
        <span className="last10__oppcap">
          {g.isHome ? '' : '@ '}
          {g.opponent.abbreviation}
        </span>
      </div>
      <div className="last10__foot">
        {hasScore ? (
          <div className="last10__score">
            {winRuns}
            <span className="last10__sep">&ndash;</span>
            {lossRuns}
          </div>
        ) : (
          <div className="last10__score last10__score--final">Final</div>
        )}
        {meta && <div className="last10__meta">{meta}</div>}
      </div>
    </button>
  )
}

// The Overview's Last 10 strip — one card per decided game, oldest -> newest
// (the same reading direction as the Schedule strip, so the two never scan in
// mirror directions), opening pre-scrolled to the newest (rightmost) card. It
// holds the true last ten and nothing older; the rest of the season is the
// Games tab's grid, which is where scrolling back used to lead.
function LastTenGamesStrip({ games }) {
  const trackRef = useRef(null)
  const didInitialScroll = useRef(false)
  const [canScroll, setCanScroll] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    const check = () => setCanScroll(el.scrollWidth > el.clientWidth + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    window.addEventListener('resize', check)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [games.length])

  // Opens pre-scrolled to the newest (rightmost) card — on mount only.
  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el || didInitialScroll.current) return
    jumpScrollLeft(el, el.scrollWidth)
    didInitialScroll.current = true
  }, [canScroll])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const update = () => {
      setAtStart(el.scrollLeft <= 1)
      setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1)
    }
    update()
    el.addEventListener('scroll', update)
    return () => el.removeEventListener('scroll', update)
  }, [games.length, canScroll])

  const scroll = (dir) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <div className="last10">
      {canScroll && (
        <button
          type="button"
          className="last10__nav"
          onClick={() => scroll(-1)}
          disabled={atStart}
          aria-label="Scroll to older games"
        >
          &lsaquo;
        </button>
      )}
      <div className="last10__track" ref={trackRef}>
        {games.map((g) => (
          <GameStubCard key={g.gamePk} game={g} />
        ))}
      </div>
      {canScroll && (
        <button
          type="button"
          className="last10__nav"
          onClick={() => scroll(1)}
          disabled={atEnd}
          aria-label="Scroll to more recent games"
        >
          &rsaquo;
        </button>
      )}
    </div>
  )
}

// The Overview's Last 10 door. It shows all ten: the card is titled "Last 10
// Games" and its header carries a ten-game W-L, so a strip holding fewer than
// that would make the card contradict its own masthead (and, on a viewport
// wide enough to fit them, would show no scroll arrows to suggest anything was
// missing).
export function LastTenGames({ teamId, asOf, recentGames }) {
  const recentWins = recentGames.filter((g) => g.won).length
  return (
    <div className="thub-card">
      <div className="thub-card__head">
        <span>Last 10 Games</span>
        <em>
          {recentWins}-{recentGames.length - recentWins}
        </em>
      </div>
      <div className="thub-card__body">
        <LastTenGamesStrip key={`${teamId}-${asOf ?? ''}`} games={recentGames} />
      </div>
    </div>
  )
}

// How many cards the Games tab shows before asking, and how many each "Show
// more" adds. 24 divides evenly by every column count the grid can settle on
// (2, 3, 4, 6), so a page always ends on a complete row rather than a ragged
// one that reads as "that's all there is".
const GRID_PAGE = 24

// Every decided game this season, in a wrapping grid of the same ticket-stub
// cards — the Games tab's own list, where the Overview shows only the last
// ten. Newest first, so the games a scorer just charted sit at the top and
// paging runs backward through the season a screenful at a time; `games`
// already holds the whole season (fetchTeamSchedule's single per-page fetch),
// so showing more is a pure client-side slice, never a fresh request.
// Deliberately heading-less — the cards ARE the section, and the Schedule
// strip above it already names the season.
export function AllGames({ games }) {
  const [visibleCount, setVisibleCount] = useState(GRID_PAGE)
  const newestFirst = useMemo(() => [...games].reverse(), [games])
  const visible = newestFirst.slice(0, visibleCount)
  const remaining = newestFirst.length - visible.length

  return (
    <section className="gamesgrid" aria-label="Games played">
      <div className="gamesgrid__grid">
        {visible.map((g) => (
          <GameStubCard key={g.gamePk} game={g} />
        ))}
      </div>
      {remaining > 0 && (
        <button
          type="button"
          className="gamesgrid__more"
          onClick={() => setVisibleCount((c) => c + GRID_PAGE)}
        >
          Show {Math.min(GRID_PAGE, remaining)} more &middot; {remaining} left
        </button>
      )}
    </section>
  )
}
