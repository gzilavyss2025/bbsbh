import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { gamePath } from '../../../lib/route.js'
import { useNav } from '../../../lib/nav.js'
import { TeamLogo } from '../../../components/TeamLogo.jsx'
import { DOW_LABELS, MONTH_LABELS } from './TeamStatsCard.jsx'

// A setup jump, not a user-visible scroll gesture — bypasses the track's own
// `scroll-behavior: smooth` (index.css) so it lands instantly. Without this,
// the animated glide from position 0 briefly leaves the leading-edge sentinel
// on screen mid-flight, which the IntersectionObserver below reads as "scrolled
// back" and grows the window before the user has touched anything.
function jumpScrollLeft(el, value) {
  const prev = el.style.scrollBehavior
  el.style.scrollBehavior = 'auto'
  el.scrollLeft = value
  el.style.scrollBehavior = prev
}

// Ticket-stub day/month/date parts for a Last 10 Games card. Same UTC-parse
// convention as dayOfWeekRecord/todayDowLabel above, so the weekday can't
// drift across a DST edge.
function last10DateParts(apiDate) {
  const d = new Date(`${apiDate}T00:00:00Z`)
  return { dow: DOW_LABELS[d.getUTCDay()], month: MONTH_LABELS[d.getUTCMonth()], day: d.getUTCDate() }
}

// How many additional (older) games to reveal each time the user scrolls
// back to the growing window's leading edge — same page size as the initial
// "Last 10" default, just repeated all the way back to Opening Day.
const LAST10_GROW_STEP = 10

// Last 10 Games — a horizontally-scrolling strip of ticket-stub cards, one
// per DECIDED game this season (`games` is already `won != null`-filtered by
// the caller — see the recentGames/seasonGames comments above — never
// re-derived from Final status here, which would bypass the
// fetchTeamSchedule cutoff and leak the very game a mid-scoring visitor
// opened this page from). Ordered oldest -> newest, same reading direction
// as the Schedule strip below it; opens pre-scrolled to the newest
// (rightmost) card, showing only the last `initialCount` (the true last 10).
// Scrolling back toward the start reveals `LAST10_GROW_STEP` more games at a
// time, all the way back to Opening Day — `games` already holds the whole
// season (fetchTeamSchedule's single per-page fetch), so growing the window
// is a pure client-side slice, never a fresh request. Each card routes to
// that game's box score, the one destination that already shows the score
// this card just displayed.
function LastTenGamesStrip({ games, initialCount = 10 }) {
  const navigate = useNav()
  const trackRef = useRef(null)
  const sentinelRef = useRef(null)
  const didInitialScroll = useRef(false)
  // Captured scrollLeft/scrollWidth just before growing the window, so the
  // layout effect below can compensate for the older cards landing BEFORE
  // the ones already on screen — without it, prepending content shoves the
  // user's current view further right instead of leaving it visually still.
  const pendingGrowRef = useRef(null)
  const [visibleCount, setVisibleCount] = useState(() => Math.min(initialCount, games.length))
  const [canScroll, setCanScroll] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  const visibleGames = games.slice(-visibleCount)
  const hasMore = visibleCount < games.length

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
  }, [visibleGames.length])

  // Opens pre-scrolled to the newest (rightmost) card — once, on mount only;
  // growing the window later must NOT re-trigger this or every scroll-back
  // would snap straight back to the end.
  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el || didInitialScroll.current) return
    jumpScrollLeft(el, el.scrollWidth)
    didInitialScroll.current = true
  }, [canScroll])

  // Restores the pre-growth scroll position after older games are
  // prepended (see pendingGrowRef above).
  useLayoutEffect(() => {
    const el = trackRef.current
    const pending = pendingGrowRef.current
    if (!el || !pending) return
    jumpScrollLeft(el, pending.scrollLeft + (el.scrollWidth - pending.scrollWidth))
    pendingGrowRef.current = null
  }, [visibleGames.length])

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
  }, [visibleGames.length, canScroll])

  // Scrolling (or paging via the < button) into the sentinel at the front of
  // the track grows the window toward Opening Day.
  useEffect(() => {
    const el = trackRef.current
    const sentinel = sentinelRef.current
    if (!el || !sentinel || !hasMore) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        pendingGrowRef.current = { scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth }
        setVisibleCount((c) => Math.min(c + LAST10_GROW_STEP, games.length))
      },
      { root: el, threshold: 0 },
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [hasMore, games.length])

  const scroll = (dir) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  const openGame = (g) => {
    navigate(gamePath(g.apiDate, g.away.abbreviation, g.home.abbreviation, 'boxscore', g.gameNumber))
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
        {hasMore && <div ref={sentinelRef} className="last10__sentinel" aria-hidden="true" />}
        {visibleGames.map((g) => {
          const { dow, month, day } = last10DateParts(g.apiDate)
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
              key={g.gamePk}
              type="button"
              className={`last10__card${g.won ? ' last10__card--win' : ' last10__card--loss'}${g.isHome ? ' last10__card--home' : ''}`}
              onClick={() => openGame(g)}
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
        })}
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

export function LastTenGames({ teamId, asOf, recentGames, seasonGames }) {
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
        <LastTenGamesStrip
          key={`${teamId}-${asOf ?? ''}`}
          games={seasonGames}
          initialCount={recentGames.length}
        />
      </div>
    </div>
  )
}
