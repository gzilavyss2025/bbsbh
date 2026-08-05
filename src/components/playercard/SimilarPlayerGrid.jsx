import { Headshot } from '../player/Headshot.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { splitDisplayName } from '../../api/person.js'
import { teamClubNameShort } from '../../lib/teams.js'

// The shared presentation for both neighbour cards — "Pitches like"
// (SimilarPitchers) and "Hits like" (SimilarHitters). The two are the same
// object: a ranked three of faces, each a door into that player's own page,
// each carrying how close the match is. Only the SOURCES differ (one reads
// pitch-arsenal.json and already has names; the other resolves its own from a
// batched people lookup), so those stay in their own files and hand this one
// finished rows.
//
// This file replaced two near-identical row lists that shared a CSS block but
// not their JSX. It is presentation only and does no fetching, so it holds the
// same spoiler footing its callers do: season aggregates over completed games,
// no SealBox (see CLAUDE.md's spoiler rule).
//
// THREE ACROSS, NOT A LIST OF ROWS. The card used to be three full-width rows
// with a 33px thumbnail, which spent the whole width on a name that needed a
// third of it. At a third each, a real 63px headshot fits — the face is what
// makes a comparison land on a second screen — and the name splits over two
// lines the way the player hero's does, so a long surname wraps instead of
// ellipsizing. The match figure moves under the face as the cell's footer,
// bottom-aligned across all three (`margin-top: auto`) so the numbers still
// read as one comparable row even when one name wraps and another doesn't.
//
// THE MATCH NUMBER IS SHOWN ON PURPOSE. A bare "hits like X, Y, Z" is a
// confident-sounding claim the data doesn't always support: a pitcher with a
// genuinely unusual arsenal (Kenley Jansen throws 94% cutters) has no close
// comparison in the league, and a best match of 67 rather than 90 is the
// honest answer. Printing it lets a reader calibrate instead of taking three
// names on faith. It is a match SCORE on a 0-100 scale, never a probability —
// the "match" unit under it and the note beneath the grid both say so, and
// neither may be dropped now that the figure carries a percent sign.
//
// `measure` is the accented band above the grid, and it is the point of the
// card as much as the three faces are: "closest Statcast profiles" as a quiet
// right-aligned section note left a reader guessing what "closest" was
// measured on. Naming the actual inputs — and, for pitchers, the handedness
// filter — turns the claim into something checkable. Callers derive those
// terms from the ranking model's own key list where they can, so the band
// can't drift from what the math actually compares.
export function SimilarPlayerGrid({ rows, measure, note }) {
  if (!rows?.length) return null

  return (
    <div className="simlike">
      <p className="simlike__measure">
        <span className="simlike__measurelabel">Measured on</span>
        <span className="simlike__measureterms">{measure.join(' · ')}</span>
      </p>
      <ul className="simlike__list">
        {rows.map((p) => {
          const { first, last } = splitDisplayName(p.name)
          const club = teamClubNameShort(p.teamId)
          return (
            <li className="simlike__item" key={p.personId}>
              <PlayerLink id={p.personId} className="simlike__link">
                <Headshot
                  personId={p.personId}
                  name={p.name}
                  teamId={p.teamId}
                  className="simlike__shot"
                />
                {/* Absent for a player whose position we couldn't resolve —
                    the same degrade-to-nothing every other optional field on
                    a MiLB-capable surface gets, never a guessed "P". */}
                {p.pos && <span className="simlike__pos">{p.pos}</span>}
                <span className="simlike__ident">
                  {first && <span className="simlike__first">{first}</span>}
                  <span className="simlike__last">{last}</span>
                </span>
                {club && <span className="simlike__club">{club}</span>}
                <span className="simlike__match">
                  <span className="simlike__matchval">
                    {p.match}
                    <span className="simlike__matchpct">%</span>
                  </span>
                  <span className="simlike__matchunit">match</span>
                </span>
              </PlayerLink>
            </li>
          )
        })}
      </ul>
      {/* One line, because the page's copy renders in scorebook caps and four
          lines of it shouts. The band above says what is compared; this says
          what the comparison does NOT claim. */}
      <p className="hint hint--prose simlike__note">{note}</p>
    </div>
  )
}
