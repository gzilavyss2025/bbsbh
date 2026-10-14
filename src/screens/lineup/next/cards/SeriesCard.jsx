import { useEffect, useRef } from 'react'
import { centeredScrollLeft, seasonSeriesCells, seasonSeriesRecord } from '../../../../api/seasonSeries.js'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'
import { GameTime } from '../../../../components/teamstats/SeasonSeriesStrip.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { monthDay } from '../../../../lib/dates.js'
import { useNav } from '../../../../lib/nav.js'
import { gamePath } from '../../../../lib/route.js'
import { teamClubName } from '../../../../lib/teams.js'

// "Brewers lead 4–2", "Tied 2–2", or nothing before either club has won.
// "8/15": the cell's date.
const shortMd = (apiDate) => monthDay(apiDate)

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
  const cells = seasonSeriesCells(data.seriesGames, meta.id, data.gamePk, info.officialDate)
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
  const scroll = (dir) => stripRef.current?.scrollBy({ left: dir * stripRef.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <Card frame="stamped" body="flush" className="lss">
      <header className="lss__head">
        <h3 className="lss__title">Season series</h3>
        {lead && <span className="lss__lead">{lead}</span>}
        <span className="lss__arrows">
          <button type="button" aria-label="Earlier games" onClick={() => scroll(-1)}>‹</button>
          <button type="button" aria-label="Later games" onClick={() => scroll(1)}>›</button>
        </span>
      </header>
      <div className="lss__strip" ref={stripRef} tabIndex={0} aria-label="Season series games">
        {cells.map((cell) => {
          const played = cell.final && cell.hasScore
          const won = played ? cell.winnerId === meta.id : null
          const mine = played ? (won ? cell.winnerScore : cell.loserScore) : null
          const theirs = played ? (won ? cell.loserScore : cell.winnerScore) : null
          const cls = ['lss__cell', cell.isCurrent && 'is-current', won === true && 'is-win', won === false && 'is-loss', cell.round && 'is-post'].filter(Boolean).join(' ')
          return (
            <button key={cell.gamePk} type="button" ref={cell.isCurrent ? currentRef : null} className={cls} onClick={() => go(cell)}>
              <small className="lss__date">{shortMd(cell.apiDate)}</small>
              <b className="lss__score">
                {played ? `${won ? 'W' : 'L'} ${mine}–${theirs}` : cell.final ? 'Final' : <GameTime gameDate={cell.gameDate} tzId={cell.tzId} tbd={cell.startTimeTBD} />}
              </b>
              <span className="lss__vs">
                <i>{cell.homeId === meta.id ? 'vs' : '@'}</i>
                <TeamLogo teamId={oppMeta.id} name={oppMeta.name} size={20} />
              </span>
              {(cell.round || cell.isCurrent) && (
                <em className="lss__tag">{[cell.round && (cell.seriesGame ? `${cell.round} · G${cell.seriesGame}` : cell.round), cell.isCurrent && (cell.final ? 'This game' : 'Today')].filter(Boolean).join(' · ')}</em>
              )}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
