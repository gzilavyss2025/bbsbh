import { useState } from 'react'
import { TeamLogo } from './TeamLogo.jsx'
import { Headshot } from './Headshot.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { BallparkModal } from './BallparkModal.jsx'
import { leagueLogoUrl } from '../lib/teams.js'
import { ballparkFor } from '../lib/ballparkData.js'

// The All-Star Rosters page's one game-result card. Layout: the date sits
// left-aligned on its own line, the score (AL/NL marks + runs) on the line
// below it, then a smaller "Box score" button underneath that; the MVP —
// headshot, name, the position he played that game, and his game stat line
// — sits in a middle column; the host ballpark (a link into the same
// BallparkModal the live lineup page's game facts use, when the park's on
// file — same plain/dotted-on-hover convention as PlayerLink/TeamLink's
// `.plink`, not a solid underline) sits right-aligned. This is a
// DELIBERATE, narrow exception to the "never print a score" spoiler
// invariant: see
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
// the generic league mark instead of guessing a team. `mvp.pos`/`mvp.stat`
// come from the generator reading the MVP's own boxscore entry (absent for
// very old games or a season with no MVP award — see allStarRosters.js).
export function AllStarGameResult({ score, mvp, venue, dateLabel, onBoxScore }) {
  const [ballparkOpen, setBallparkOpen] = useState(false)
  if (!score) return null
  const winner = score.al === score.nl ? null : score.al > score.nl ? 'al' : 'nl'
  const hasBallpark = venue && ballparkFor(venue.name)

  return (
    <div className="allstargame">
      <div className="allstargame__main">
        <div className="allstargame__scorecol">
          {dateLabel && <span className="allstargame__date">{dateLabel}</span>}
          <div className="allstargame__scorerow">
            <span
              className={`allstargame__side${winner === 'al' ? ' allstargame__side--winner' : ''}`}
            >
              <TeamLogo teamId={159} name="American League" size={28} />
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
              <TeamLogo teamId={160} name="National League" size={28} />
            </span>
          </div>
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

        {mvp && (
          <div className="allstargame__mvpcol">
            <Headshot
              personId={mvp.playerId}
              name={mvp.name}
              teamId={mvp.teamId}
              className="allstargame__mvpshot"
            />
            <div className="allstargame__mvptext">
              <span className="allstargame__mvplabel">MVP</span>
              <span className="allstargame__mvpline">
                <PlayerLink id={mvp.playerId} className="allstargame__mvpname">
                  {mvp.name}
                </PlayerLink>
                {mvp.pos && <span className="allstargame__mvppos">{mvp.pos}</span>}
              </span>
              {mvp.stat && <span className="allstargame__mvpstat">{mvp.stat}</span>}
            </div>
          </div>
        )}

        {venue && (
          <div className="allstargame__venue">
            {venue.teamId ? (
              <TeamLogo teamId={venue.teamId} name={venue.name} size={26} />
            ) : (
              <img
                src={leagueLogoUrl()}
                alt=""
                className="allstargame__venuelogo"
                width={26}
                height={26}
                aria-hidden="true"
              />
            )}
            {hasBallpark ? (
              <button
                type="button"
                className="plink allstargame__venuelink"
                onClick={() => setBallparkOpen(true)}
              >
                {venue.name}
              </button>
            ) : (
              <span className="allstargame__venuename">{venue.name}</span>
            )}
          </div>
        )}
      </div>
      {ballparkOpen && (
        <BallparkModal venue={venue.name} onClose={() => setBallparkOpen(false)} />
      )}
    </div>
  )
}
