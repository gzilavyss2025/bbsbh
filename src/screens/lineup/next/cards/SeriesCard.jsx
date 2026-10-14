import { useEffect, useRef } from 'react'
import { fetchSeasonSeries } from '../../../../api/schedule.js'
import { centeredScrollLeft, seasonSeriesCells, seasonSeriesRecord } from '../../../../api/seasonSeries.js'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'
import { GameTime } from '../../../../components/teamstats/SeasonSeriesStrip.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { useAsync } from '../../../../hooks/useAsync.js'
import { monthDayYear } from '../../../../lib/dates.js'
import { useNav } from '../../../../lib/nav.js'
import { gamePath } from '../../../../lib/route.js'
import { teamClubName } from '../../../../lib/teams.js'

// "Brewers lead 4–2", "Tied 2–2", or nothing before either club has won.
function leadLabel(record, aId, bId) {
  const { aWins, bWins } = record
  if (aWins === 0 && bWins === 0) return null
  if (aWins === bWins) return `Tied ${aWins}–${bWins}`
  const name = teamClubName(aWins > bWins ? aId : bId)
  return name ? `${name} lead ${Math.max(aWins, bWins)}–${Math.min(aWins, bWins)}` : null
}

// This season's meetings of the two clubs, one cell per game. The spoiler footing is
// seasonSeriesCells': the game this page is for and every later game are drawn with no score
// and no winner, and a later postseason game is not drawn at all. Games before it show their
// result. A one-off meeting draws nothing.
export function SeriesCard({ data }) {
  const { meta, oppMeta, info, season } = data
  const navigate = useNav()
  const stripRef = useRef(null)
  const currentRef = useRef(null)
  const year = (info.officialDate ?? '').slice(0, 4)
  const { data: games } = useAsync(
    () => (meta.id && oppMeta.id && year ? fetchSeasonSeries(meta.id, oppMeta.id, Number(year), meta.sportId ?? 1, null) : Promise.resolve([])),
    [meta.id, oppMeta.id, year, meta.sportId],
  )
  const cells = seasonSeriesCells(games ?? [], meta.id, data.gamePk, info.officialDate)
  // Land on the current game, centred in the strip, without scrolling the page.
  useEffect(() => {
    const strip = stripRef.current
    const cell = currentRef.current
    if (!strip || !cell) return
    const s = strip.getBoundingClientRect()
    const c = cell.getBoundingClientRect()
    strip.scrollTo({
      left: centeredScrollLeft({ scrollLeft: strip.scrollLeft, stripLeft: s.left, stripWidth: s.width, cellLeft: c.left, cellWidth: c.width }),
      behavior: 'instant',
    })
  }, [cells.length])
  if (cells.length < 2 || !season) return null
  const lead = leadLabel(seasonSeriesRecord(cells, meta.id, oppMeta.id), meta.id, oppMeta.id)
  const go = (cell) => navigate(gamePath(cell.apiDate, cell.awayAbbr, cell.homeAbbr, cell.final ? 'boxscore' : 'lineup1', cell.gameNumber))
  return (
    <Card frame="stamped" body="flush" label="Season series" count={lead ?? undefined} className="lss">
      <div className="lss__strip" ref={stripRef} tabIndex={0} aria-label="Season series games">
        {cells.map((cell) => {
          const won = cell.final && cell.hasScore ? cell.winnerId === meta.id : null
          const cls = ['lss__cell', cell.isCurrent && 'is-current', won === true && 'is-win', won === false && 'is-loss'].filter(Boolean).join(' ')
          return (
            <button key={cell.gamePk} type="button" ref={cell.isCurrent ? currentRef : null} className={cls} onClick={() => go(cell)}>
              <small className="lss__date">{monthDayYear(cell.apiDate)}</small>
              {cell.round && <span className="lss__round">{cell.round}{cell.seriesGame ? ` · G${cell.seriesGame}` : ''}</span>}
              {cell.final && cell.hasScore ? (
                <b className="lss__score">
                  <TeamLogo teamId={cell.winnerId} size={24} />
                  {cell.winnerScore}–{cell.loserScore}
                </b>
              ) : cell.final ? (
                <b className="lss__score">Final</b>
              ) : (
                <b className="lss__score">
                  <GameTime gameDate={cell.gameDate} tzId={cell.tzId} tbd={cell.startTimeTBD} />
                </b>
              )}
              <span className="lss__where">@ {cell.homeAbbr}</span>
              {cell.isCurrent && <em className="lss__now">This game</em>}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
