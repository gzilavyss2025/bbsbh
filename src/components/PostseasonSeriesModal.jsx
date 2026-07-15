import { useEffect, useRef } from 'react'
import { PlayerLink } from './PlayerLink.jsx'
import { TeamLink } from './TeamLink.jsx'
import { TeamLogo } from './TeamLogo.jsx'
import { Headshot } from './Headshot.jsx'
import { teamClubNameShort } from '../lib/teams.js'
import { fetchGameCardsByPk } from '../api/schedule.js'
import { gamePath } from '../lib/route.js'
import { useNav } from '../lib/nav.js'
import { useAsync } from '../hooks/useAsync.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthDayYear(iso) {
  const [y, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}` : ''
}

// The animated card a tap on a bracket series slides over the page: the
// game-by-game scores plus the round MVP (LCS/World Series only — Wild Card
// and Division Series carry no official MVP award, so `mvp` is null there).
// Reuses the app's standard centered-scrim/slideup-card motion (see
// .logomodal in index.css, the same treatment the team-page logo sketch
// uses) rather than inventing a new transition — this data is historical,
// so there's no SealBox spoiler mechanic involved, just the "tap a summary,
// see the detail card animate in" pattern. Each game row is itself a
// button through to that exact game's box score — resolved from its
// gamePk via fetchGameCardsByPk, the same live-resolve AllStarRostersPage
// uses for its own historical games, so this file never has to store (and
// risk going stale on) a team abbreviation. Landing on an old game's own
// box score still goes through the ordinary SealBox reveal, same as
// reaching it from the slate — nothing here bypasses that.
export function PostseasonSeriesModal({ series, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const closeRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  const { teamA, teamB, games, mvp, label, winnerTeamId } = series
  const winner = winnerTeamId === teamA.teamId ? teamA : teamB
  const loser = winnerTeamId === teamA.teamId ? teamB : teamA

  // Each row's own gamePk is the only thing stored (see the generator's
  // header comment) — resolved here to a full card (team abbreviations +
  // officialDate) the same way AllStarRostersPage resolves its historical
  // games, so a tap lands on that exact game's box score rather than this
  // file having to store — and risk going stale on — an abbreviation.
  const navigate = useNav()
  const gamePks = games.map((g) => g.gamePk)
  const { data: cardsByPk } = useAsync(() => fetchGameCardsByPk(gamePks), [gamePks.join(',')])

  return (
    <div
      className="scrim scrim--center"
      onClick={(e) => e.target.classList.contains('scrim') && onClose()}
    >
      <div
        className="psmodal"
        role="dialog"
        aria-modal="true"
        aria-label={`${label} results`}
      >
        <button
          ref={closeRef}
          type="button"
          className="psmodal__close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <p className="psmodal__label">{label}</p>
        <div className="psmodal__result">
          <TeamLink id={winner.teamId} className="psmodal__winner">
            <TeamLogo teamId={winner.teamId} name={teamClubNameShort(winner.teamId)} size={34} />
            <span>{teamClubNameShort(winner.teamId)}</span>
          </TeamLink>
          <span className="psmodal__score">
            {winner.wins}–{loser.wins}
          </span>
          <TeamLink id={loser.teamId} className="psmodal__loser">
            <TeamLogo teamId={loser.teamId} name={teamClubNameShort(loser.teamId)} size={34} />
            <span>{teamClubNameShort(loser.teamId)}</span>
          </TeamLink>
        </div>

        <ul className="psmodal__games">
          {games.map((g) => {
            const awayWon = g.awayScore > g.homeScore
            const card = cardsByPk?.[g.gamePk]
            return (
              <li key={g.gameNumber}>
                <button
                  type="button"
                  className="psmodal__game"
                  disabled={!card}
                  onClick={() =>
                    card &&
                    navigate(
                      gamePath(
                        card.officialDate,
                        card.away.abbreviation,
                        card.home.abbreviation,
                        'boxscore',
                        card.gameNumber,
                      ),
                    )
                  }
                >
                  <span className="psmodal__gamenum">Game {g.gameNumber}</span>
                  <span className="psmodal__gamedate">{monthDayYear(g.date)}</span>
                  <span className={`psmodal__gameline${awayWon ? ' psmodal__gameline--awaywon' : ''}`}>
                    <TeamLogo teamId={g.awayTeamId} name="" size={16} />
                    <span className="psmodal__gamescore">{g.awayScore}</span>
                    <span className="psmodal__at">@</span>
                    <TeamLogo teamId={g.homeTeamId} name="" size={16} />
                    <span className="psmodal__gamescore">{g.homeScore}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {mvp && (
          <div className="psmodal__mvp">
            <Headshot personId={mvp.playerId} name={mvp.name} teamId={mvp.teamId} className="psmodal__mvpshot" />
            <div className="psmodal__mvpinfo">
              <span className="psmodal__mvptag">Series MVP</span>
              <PlayerLink id={mvp.playerId} className="psmodal__mvpname">
                {mvp.name}
              </PlayerLink>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
