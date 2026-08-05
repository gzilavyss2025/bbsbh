import { Headshot } from '../player/Headshot.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { teamClubNameShort } from '../../lib/teams.js'

// PITCHES LIKE — the three arms whose season pitch mix and velocities most
// resemble this pitcher's. The ranking is src/lib/pitcherSimilarity.js (pure,
// unit-tested); the level-aware pool comes from api/pitchArsenal.js's
// similarPitchersFor. This file is presentation only.
//
// Each name is a PlayerLink, so the card doubles as a way to wander the staff
// — which is most of its value on a second screen. Spoiler-free like the rest
// of the arsenal data (a completed-game season aggregate), so no SealBox.
//
// THE MATCH NUMBER IS SHOWN ON PURPOSE. A bare "pitches like X, Y, Z" is a
// confident-sounding claim the data doesn't always support: a pitcher with a
// genuinely unusual arsenal (Kenley Jansen throws 94% cutters) has no close
// comparison in the league, and his best match scoring 67 rather than 90 is
// the honest answer. Printing it lets a reader calibrate instead of taking
// three names on faith. It is a match score, never a probability — the copy
// beneath says so.
export function SimilarPitchers({ similar }) {
  if (!similar?.length) return null

  return (
    <div className="pitcheslike">
      <ul className="pitcheslike__list">
        {similar.map((p) => {
          const club = teamClubNameShort(p.teamId)
          return (
            <li className="pitcheslike__item" key={p.personId}>
              <PlayerLink id={p.personId} className="pitcheslike__link">
                <Headshot
                  personId={p.personId}
                  name={p.name}
                  teamId={p.teamId}
                  className="pitcheslike__shot"
                />
                <span className="pitcheslike__ident">
                  <span className="pitcheslike__name">{p.name}</span>
                  {club && <span className="pitcheslike__club">{club}</span>}
                </span>
                <span className="pitcheslike__match">
                  {p.match}
                  <span className="pitcheslike__matchunit">match</span>
                </span>
              </PlayerLink>
            </li>
          )
        })}
      </ul>
      {/* One line, because the page's copy renders in scorebook caps and four
          lines of it shouts. It still has to carry all three things a reader
          needs: what "similar" is measured on, why a whole handedness is
          missing from the list, and that this compares what he THROWS, not how
          he fares with it. */}
      <p className="hint hint--prose pitcheslike__note">
        Closest season pitch mix and speeds, same throwing hand — what he throws, not how he fares.
      </p>
    </div>
  )
}
