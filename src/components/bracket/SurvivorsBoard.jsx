// THE SURVIVORS' BOARD — what stands below the games on the MLB slate in the
// postseason window, in place of the Off Day grid (Gary's pick, 2026-10-01:
// "Rail + board"). An old hand-turned outfield scoreboard: all twelve clubs in
// fixed slots for the whole month, league by league. A club that goes out keeps
// its slot, in gray, with a pencil X, and the count at the head drops the
// morning after: 12, 8, 4, 2, 1.
//
// The Off Day grid it replaces showed only the alive clubs with no game today,
// which in October answered a question nobody asks. This board answers the one
// they do: who is left, and what does each club do next.
//
// Spoilers: every slot reads the bracket HEADING INTO its cutoff (ADR-0087),
// so a game in progress never moves the board, and no seal or kraft tape is
// used anywhere on it. The logic is src/lib/postseason/survivors.js, pure and
// pinned by test/postseason/survivors.test.js.
import '../../styles/postseason/home.css'
import { useMemo } from 'react'
import { useRouteLink } from '../../lib/nav.js'
import { teamPath } from '../../lib/route.js'
import { survivorLine, survivorsBoard } from '../../lib/postseason/survivors.js'
import { ClubMark } from './bracketParts.jsx'
import { leagueMarkUrl } from '../passport/leagueMarks.js'

const LEAGUE_MARK = { AL: 'al', NL: 'nl' }
const LEAGUE_NAME = { AL: 'American League', NL: 'National League' }

export function SurvivorsBoard({ bracket, slateDate, favoriteTeamId = null }) {
  const board = useMemo(() => survivorsBoard(bracket), [bracket])
  const linkProps = useRouteLink()
  if (!board || board.total === 0) return null

  return (
    <section className="psboard" aria-labelledby="psboard-title">
      <div className="psboard__head">
        <h2 id="psboard-title" className="psboard__title">
          {board.champion ? 'Champions' : 'Still standing'}
        </h2>
        {!board.champion && (
          <span className="psboard__count">
            <span className="psboard__alive">{board.alive}</span> of {board.total}
          </span>
        )}
      </div>
      {board.leagues.map((league) => (
        <div key={league.key} className="psboard__league">
          <span className="psboard__lg" aria-hidden="true">
            {LEAGUE_MARK[league.key]
              ? <img src={leagueMarkUrl(LEAGUE_MARK[league.key])} alt="" className="psboard__lgmark" />
              : league.key}
          </span>
          <ul className="psboard__slots" aria-label={LEAGUE_NAME[league.key]}>
            {league.slots.map((slot) => {
              const line = survivorLine(slot, slateDate)
              const fav = slot.club.id === favoriteTeamId
              return (
                <li key={slot.club.id}>
                  <a
                    className={`psboard__slot psboard__slot--${slot.state}${fav ? ' psboard__slot--fav' : ''}`}
                    aria-label={`${slot.club.name}: ${line}`}
                    {...linkProps(teamPath(slot.club.id, { name: slot.club.name }))}
                  >
                    <ClubMark club={slot.club} eliminated={slot.state === 'out'} size={40} />
                    <span className="psboard__abbr">
                      {slot.club.abbreviation}
                      {fav && <span className="psboard__star" aria-hidden="true">★</span>}
                    </span>
                    <span className="psboard__line">{line}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
