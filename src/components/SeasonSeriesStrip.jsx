import { useRef } from 'react'
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
  const season = (officialDate ?? '').slice(0, 4)

  const { data: games } = useAsync(
    () =>
      viewingTeamId && opponentId && season
        ? fetchSeasonSeries(viewingTeamId, opponentId, Number(season), sportId ?? 1)
        : Promise.resolve([]),
    [viewingTeamId, opponentId, season, sportId],
  )

  const cells = seasonSeriesCells(games ?? [], viewingTeamId, currentGamePk)
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
        <button
          type="button"
          className="seasonseries__nav seasonseries__nav--left"
          onClick={() => scroll(-1)}
          aria-label="Scroll to earlier games"
        >
          &#8249;
        </button>
        <div className="seasonseries__strip" ref={stripRef}>
          {cells.map((cell) => (
            <SeasonSeriesCell key={cell.gamePk} cell={cell} onSelect={() => openGame(cell)} />
          ))}
        </div>
        <button
          type="button"
          className="seasonseries__nav seasonseries__nav--right"
          onClick={() => scroll(1)}
          aria-label="Scroll to later games"
        >
          &#8250;
        </button>
      </div>
    </section>
  )
}

function SeasonSeriesCell({ cell, onSelect }) {
  const dateLabel = monthDayYear(cell.apiDate)
  const oppLabel = `${cell.isHome ? 'vs' : '@'} ${cell.opponentAbbr}`

  return (
    <button
      type="button"
      className={`seasonseries__cell${cell.isCurrent ? ' seasonseries__cell--current' : ''}`}
      onClick={onSelect}
    >
      {cell.final ? (
        <>
          <TeamLogo teamId={cell.winnerId} size={30} className="seasonseries__logo" />
          <span className="seasonseries__score">
            {cell.winnerScore}
            <span className="seasonseries__sep">–</span>
            {cell.loserScore}
            {cell.loserAbbr && <span className="seasonseries__loser">{cell.loserAbbr}</span>}
          </span>
        </>
      ) : (
        <GameTime gameDate={cell.gameDate} />
      )}
      <span className="seasonseries__date">
        {dateLabel}
        <span className="seasonseries__opp">{oppLabel}</span>
      </span>
    </button>
  )
}

// Local wall-clock time off the schedule feed's `gameDate` — every
// not-yet-Final game in the strip is inherently a scheduled estimate, not a
// posted first pitch, so it's always labeled as such (see GameCard's
// StatusText for the same toLocaleTimeString approach on the slate card).
function GameTime({ gameDate }) {
  if (!gameDate) return <span className="seasonseries__time">TBD</span>
  let local
  try {
    local = new Date(gameDate).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch {
    return <span className="seasonseries__time">TBD</span>
  }
  return (
    <span className="seasonseries__time">
      {local}
      <span className="seasonseries__estimated">Estimated</span>
    </span>
  )
}
