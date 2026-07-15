import { TeamLogo } from './TeamLogo.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { leagueLogoUrl } from '../lib/teams.js'

// The All-Star Rosters page's one game-result card — the final score
// (left-aligned), the game's MVP over a "Box score" button (nested next to
// the score), and the host ballpark (right-aligned). This is a DELIBERATE,
// narrow exception to the "never print a score" spoiler invariant: see
// docs/adr/0019-all-star-rosters-shows-final-scores.md for why that's safe
// here specifically (roster membership already carries no individual game's
// stakes, and an All-Star Game is exhibition). Every other game surface in
// the app still renders through the ordinary SealBox/reveal-only path,
// including the box score this card links to.
//
// teamId 159/160 are the fixed AL/NL All-Star pseudo-clubs (not real MLB
// clubs) — TeamLogo already degrades to a plain monogram if no mark exists
// for them, same as any other team id. `venue.teamId` is only set when
// gen-all-star-rosters.mjs could match the ballpark to one of the 30
// CURRENT MLB teams' home parks — an older/relocated venue falls back to
// the generic league mark instead of guessing a team.
export function AllStarGameResult({ score, mvp, venue, dateLabel, onBoxScore }) {
  if (!score) return null
  const winner = score.al === score.nl ? null : score.al > score.nl ? 'al' : 'nl'
  return (
    <div className="allstargame">
      {dateLabel && <div className="allstargame__date">{dateLabel}</div>}
      <div className="allstargame__main">
        <div className="allstargame__score">
          <span
            className={`allstargame__side${winner === 'al' ? ' allstargame__side--winner' : ''}`}
          >
            <TeamLogo teamId={159} name="American League" size={32} />
            <span className="allstargame__label">AL</span>
            <span className="allstargame__value">{score.al}</span>
          </span>
          <span className="allstargame__sep" aria-hidden="true">
            –
          </span>
          <span
            className={`allstargame__side${winner === 'nl' ? ' allstargame__side--winner' : ''}`}
          >
            <span className="allstargame__value">{score.nl}</span>
            <span className="allstargame__label">NL</span>
            <TeamLogo teamId={160} name="National League" size={32} />
          </span>
        </div>

        {(mvp || onBoxScore) && (
          <div className="allstargame__mvpbox">
            {mvp && (
              <div className="allstargame__mvp">
                <span className="allstargame__mvplabel">MVP</span>
                <PlayerLink id={mvp.playerId} className="allstargame__mvpname">
                  {mvp.name}
                </PlayerLink>
              </div>
            )}
            {onBoxScore && (
              <button
                type="button"
                className="btn btn--next allstargame__boxbtn"
                onClick={onBoxScore}
              >
                Box score
              </button>
            )}
          </div>
        )}

        {venue && (
          <div className="allstargame__venue">
            {venue.teamId ? (
              <TeamLogo teamId={venue.teamId} name={venue.name} size={28} />
            ) : (
              <img
                src={leagueLogoUrl()}
                alt=""
                className="allstargame__venuelogo"
                width={28}
                height={28}
                aria-hidden="true"
              />
            )}
            <span className="allstargame__venuename">{venue.name}</span>
          </div>
        )}
      </div>
    </div>
  )
}
