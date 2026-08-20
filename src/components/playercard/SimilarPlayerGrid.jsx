import '../../styles/51-similar-players.css'
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
// third of it. At a third each, a real headshot fits — the face is what makes
// a comparison land on a second screen — and the name splits over two lines
// the way the player hero's does, so a long surname wraps instead of
// ellipsizing. The match figure moves under the face as the cell's footer,
// bottom-aligned across all three (`margin-top: auto`) so the numbers still
// read as one comparable row even when one name wraps and another doesn't.
//
// The cell is FOUR stacked elements at most — face, name, position + club on
// one caption line, and the match footer — because a phone-sized column that
// stacks six centered things reads as a pile rather than a card. The
// stylesheet scales all of it up past 740px and turns the stack on its side
// there (face left, name/position/club right, figure below): three thirds of a
// desktop-width page are wide enough that a centered phone-sized column inside
// them floats in dead space, which is the failure this card had on its first
// pass.
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
// `measure` is the legend's term list, and it is the point of the card as much
// as the three faces are: "closest Statcast profiles" as a quiet right-aligned
// section note left a reader guessing what "closest" was measured on. Naming
// the actual inputs turns the claim into something checkable. Callers derive
// those terms from the ranking model's own key list where they can, so the
// legend can't drift from what the math actually compares — and it lists what
// is SCORED, so a term belongs here only if the distance function reads it.
export function SimilarPlayerGrid({ rows, measure, note }) {
  if (!rows?.length) return null

  return (
    <div className="simlike">
      {/* One legend block, not three loose fragments. What the comparison runs
          on and what it stops short of claiming are the same thought, and they
          used to sit at opposite ends of the card with the three faces between
          them — the caveat in particular read as a stray line of copy that had
          drifted under the grid. Stated together, before the evidence.

          The terms print as their own chips rather than a middot-joined
          string: "Pitch mix · Average velo" reads as one run-on phrase at a
          glance, and a reader skimming past three faces and a match score
          has no reason to stop and parse it. A chip is a term you can count
          without reading — the eyebrow above still says what they're for. */}
      <div className="simlike__legend">
        <div className="simlike__measure">
          <span className="simlike__measurelabel">Measured on</span>
          <ul className="simlike__terms">
            {measure.map((term) => (
              <li key={term} className="simlike__term">{term}</li>
            ))}
          </ul>
        </div>
        <p className="simlike__note">{note}</p>
      </div>
      <ul className="simlike__list">
        {rows.map((p) => {
          const { first, last } = splitDisplayName(p.name)
          const club = teamClubNameShort(p.teamId)
          return (
            <li className="simlike__item" key={p.personId}>
              <PlayerLink id={p.personId} name={p.name} className="simlike__link">
                <Headshot
                  personId={p.personId}
                  name={p.name}
                  teamId={p.teamId}
                  className="simlike__shot"
                />
                {/* Everything that isn't the face or the figure, wrapped so it
                    can move as one block: it sits under the headshot on a
                    phone and beside it on a desktop column wide enough to put
                    them side by side. */}
                <span className="simlike__body">
                  <span className="simlike__ident">
                    {first && <span className="simlike__first">{first}</span>}
                    <span className="simlike__last">{last}</span>
                  </span>
                  {/* Position and club share one line as the cell's caption.
                      The position is absent for a player we couldn't resolve
                      one for — the same degrade-to-nothing every other
                      optional field on a MiLB-capable surface gets, never a
                      guessed "P" — and the line disappears entirely when
                      neither resolves. */}
                  {(p.pos || club) && (
                    <span className="simlike__meta">
                      {p.pos && <span className="simlike__pos">{p.pos}</span>}
                      {club && <span className="simlike__club">{club}</span>}
                    </span>
                  )}
                </span>
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
    </div>
  )
}
