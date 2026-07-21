import { useEffect, useRef, useState } from 'react'
import { fetchSeasonSeries } from '../api/schedule.js'
import { seasonSeriesCells } from '../api/seasonSeries.js'
import { useAsync } from '../hooks/useAsync.js'
import { useNav } from '../lib/nav.js'
import { gamePath } from '../lib/route.js'
import { monthDayYear } from '../lib/dates.js'
import { SectionMasthead } from './SectionMasthead.jsx'
import { TeamLogo } from './TeamLogo.jsx'

// This season's other meetings between the two clubs, as a scrollable strip
// of cards — every OTHER game's result is fair to show up front (they already
// happened, or haven't), the one exception being the game this page is FOR,
// which seasonSeriesCells blanks the score of regardless of what the feed
// says (see its own header comment / the root spoiler-rule invariant).
// Renders nothing for a one-off interleague game (no real "series" to show)
// or before the schedule loads.
export function SeasonSeriesStrip({ viewingTeamId, opponentId, officialDate, sportId, currentGamePk }) {
  const navigate = useNav()
  const stripRef = useRef(null)
  const currentCellRef = useRef(null)
  const season = (officialDate ?? '').slice(0, 4)

  const { data: games } = useAsync(
    () =>
      viewingTeamId && opponentId && season
        ? fetchSeasonSeries(viewingTeamId, opponentId, Number(season), sportId ?? 1)
        : Promise.resolve([]),
    [viewingTeamId, opponentId, season, sportId],
  )

  const cells = seasonSeriesCells(games ?? [], viewingTeamId, currentGamePk)
  const [canScroll, setCanScroll] = useState(false)
  // Which park the CURRENT game is at — every other cell whose game was
  // hosted somewhere else gets a light tint, so a multi-leg series reads at a
  // glance as "these happened at the other team's park" (see
  // .seasonseries__cell--otherpark).
  const currentHomeId = cells.find((c) => c.isCurrent)?.homeId

  // Land on the current game centered in the strip rather than wherever it
  // falls chronologically — with a full multi-leg series (see the August leg
  // in the real-game case study) it can be several cards deep.
  useEffect(() => {
    currentCellRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [cells.length])

  // Nav arrows (and the room they take up) only make sense once the strip
  // actually overflows its card — a short series that already fits shouldn't
  // show dead controls flanking a lopsided gap of white space. Re-checked on
  // resize since the wide desktop spread can fit every game the narrow phone
  // layout would need to scroll through.
  useEffect(() => {
    const el = stripRef.current
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
  }, [cells.length])

  if (cells.length < 2) return null

  const scroll = (dir) => {
    const el = stripRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  const openGame = (cell) => {
    const awayAbbr = cell.awayAbbr
    const homeAbbr = cell.homeAbbr
    navigate(gamePath(cell.apiDate, awayAbbr, homeAbbr, cell.final ? 'boxscore' : 'lineup1', cell.gameNumber))
  }

  return (
    <section className="metriccard seasonseries">
      <SectionMasthead title="Season series" as="h3" />
      <div className="metriccard__body seasonseries__body">
        {canScroll && (
          <button
            type="button"
            className="seasonseries__nav seasonseries__nav--left"
            onClick={() => scroll(-1)}
            aria-label="Scroll to earlier games"
          >
            &#8249;
          </button>
        )}
        <div
          className={`seasonseries__strip${canScroll ? '' : ' seasonseries__strip--fit'}`}
          ref={stripRef}
        >
          {cells.map((cell) => (
            <SeasonSeriesCell
              key={cell.gamePk}
              cell={cell}
              onSelect={() => openGame(cell)}
              cellRef={cell.isCurrent ? currentCellRef : null}
              otherPark={currentHomeId != null && cell.homeId !== currentHomeId}
            />
          ))}
        </div>
        {canScroll && (
          <button
            type="button"
            className="seasonseries__nav seasonseries__nav--right"
            onClick={() => scroll(1)}
            aria-label="Scroll to later games"
          >
            &#8250;
          </button>
        )}
      </div>
    </section>
  )
}

function SeasonSeriesCell({ cell, onSelect, cellRef, otherPark }) {
  const dateLabel = monthDayYear(cell.apiDate)
  // Always the host club, regardless of whose page this is — "@ NYM" says
  // where the game was played, rather than flipping to "vs" on whichever
  // side happens to be looking, which reads oddly once the shared desktop
  // spread's single strip crosses into the other park's leg of the series.
  const oppLabel = `@ ${cell.homeAbbr}`
  const classNames = [
    'seasonseries__cell',
    cell.isCurrent && 'seasonseries__cell--current',
    otherPark && 'seasonseries__cell--otherpark',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button ref={cellRef} type="button" className={classNames} onClick={onSelect}>
      {cell.final ? (
        <>
          <TeamLogo teamId={cell.winnerId} size={30} className="seasonseries__logo" />
          <span className="seasonseries__score">
            {cell.winnerScore}
            <span className="seasonseries__sep">–</span>
            {cell.loserScore}
            {cell.extraInnings && (
              <span className="seasonseries__innings">({cell.extraInnings})</span>
            )}
          </span>
        </>
      ) : (
        <GameTime gameDate={cell.gameDate} tzId={cell.tzId} />
      )}
      <span className="seasonseries__date">
        {dateLabel}
        <span className="seasonseries__opp">{oppLabel}</span>
      </span>
    </button>
  )
}

// The ballpark's OWN local time — a strip spanning both legs of a series can
// mix two time zones, so this deliberately never falls back to the viewer's
// device time zone the way GameCard's slate-card clock does; missing tzId
// just reads TBD rather than silently showing the wrong city's clock.
function GameTime({ gameDate, tzId }) {
  if (!gameDate || !tzId) return <span className="seasonseries__time">TBD</span>
  let local
  try {
    local = new Date(gameDate).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tzId,
    })
  } catch {
    return <span className="seasonseries__time">TBD</span>
  }
  return <span className="seasonseries__time">{local}</span>
}
