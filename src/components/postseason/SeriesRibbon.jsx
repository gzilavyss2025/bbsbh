import '../../styles/postseason/primer-main.css'
import { monthDayShort } from '../../lib/dates.js'
import { pillSolidStyle } from '../../lib/design/pillClass.js'
import { seriesStatus } from '../../lib/postseason/primer/seriesStatus.js'
import { wpSpark } from '../../lib/postseason/primer/wpSpark.js'
import { teamAbbr } from '../../lib/teams.js'
import { GameTime } from '../teamstats/SeasonSeriesStrip.jsx'
import { Pill } from '../ui/control/Pill.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Card } from '../ui/frame/Card.jsx'

// THE SERIES RIBBON (home page, a postseason day with a primer, ADR-0087's
// 2026-10-08 addendum): one box per game of the series, 1 to best-of. The head
// is the series status heading into the cutoff ("Series tied 1–1", "Best of
// 7"), and the chip names the club facing elimination.
//
// SPOILER FOOTING. The cutoff is a date, not a seal. A PLAYED box shows both
// clubs' runs, the winner inked, because the game went Final before the cutoff
// (ribbonNodes.js decides that; a game on or after the cutoff is a `today`,
// `ahead` or `ifNecessary` box and never reads a score). No SealBox, no --seal
// token, no Scores Unlocked. Draws no travel or off-day words.
//
//   series  a bracket series (primerSeriesFor), for the head
//   nodes   ribbonNodes(series, { scoresByPk })
//   games   { [gamePk]: game } in slice 1's finished-game shape (ribbonNodes.js):
//           venueName, wp and the home club. A today or ahead game may carry
//           only { venueName, gameDate, tzId } (the start time reads in the
//           park's own time zone, as SeasonSeriesStrip does)
//   clubs   [{ id }, { id }] in the series' club order (the score rows' order)
export function SeriesRibbon({ series, nodes, games = {}, clubs }) {
  const { head, chip } = seriesStatus(series)
  return (
    <section className="seriesribbon" aria-label="The series so far">
      <SectionHead look="label">
        {head}
        {chip && (
          <Pill fill="solid" className="seriesribbon__chip" style={pillSolidStyle({ ground: 'var(--marker)', text: 'var(--text-heading)' })}>
            {chip}
          </Pill>
        )}
      </SectionHead>
      <Card as="div" className="seriesribbon__card">
        <ol className="seriesribbon__games">
          {nodes.map((node) => (
            <li key={node.n} className={`seriesribbon__game seriesribbon__game--${node.kind}`}>
              <Game node={node} game={games[node.gamePk]} clubs={clubs} />
            </li>
          ))}
        </ol>
      </Card>
    </section>
  )
}

function Game({ node, game, clubs }) {
  const park = game?.venueName
  return (
    <>
      <div className="seriesribbon__top">
        <span className="seriesribbon__no">G{node.n}</span>
        {node.kind === 'today' && <span>Today</span>}
        {node.date && <span>{monthDayShort(node.date)}</span>}
      </div>
      {node.kind === 'ifNecessary' && <p className="seriesribbon__note">If necessary</p>}
      {node.kind === 'today' && <GameTime gameDate={game?.gameDate} tzId={game?.tzId} tbd={!game?.gameDate} />}
      {park && node.kind !== 'ifNecessary' && <p className="seriesribbon__note">@ {park}</p>}
      {node.kind === 'played' && <Played node={node} game={game} clubs={clubs} />}
    </>
  )
}

function Played({ node, game, clubs }) {
  const spark = wpSpark(game?.wp, { flip: game?.homeId !== clubs[0].id })
  return (
    <>
      <div className="seriesribbon__scores">
        {clubs.map((club, i) => {
          const won = club.id === node.winnerId
          return (
            <div key={club.id} className={`seriesribbon__score${won ? ' is-won' : ''}`}>
              <span>{teamAbbr({ id: club.id })}</span>
              <span className="seriesribbon__runs">{node.runs?.[i] ?? '—'}</span>
              {won && <span className="sr-only"> (won)</span>}
            </div>
          )
        })}
      </div>
      {spark && (
        <svg className="seriesribbon__wp" viewBox="0 0 100 26" preserveAspectRatio="none" role="img" aria-label={`Win chance for ${teamAbbr({ id: clubs[0].id })}, game ${node.n}`}>
          <polygon className="seriesribbon__wpup" points={spark.up} />
          <polygon className="seriesribbon__wpdown" points={spark.down} />
          <polyline className="seriesribbon__wpline" points={spark.line} />
        </svg>
      )}
      <p className="seriesribbon__note">{node.record}</p>
    </>
  )
}
