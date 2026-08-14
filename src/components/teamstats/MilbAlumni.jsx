import { Headshot } from '../player/Headshot.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { SectionTitle } from '../ui/SectionTitle.jsx'
import { isMlbTeamId } from '../../lib/teams.js'

// "Made The Show" — the big-league players who came through THIS farm club,
// ranked by career WAR. The last card on a MiLB team's Overview, and MiLB only:
// a big-league club's own alumni are just its roster history, which the Roster
// and Games tabs already hold. A farm club has no such record anywhere else in
// the app — the whole point of Altoona is who passed through it.
//
// Not spoiler-adjacent. Career WAR and a jersey number are stat lines, not a
// score, and the rule's scope explicitly opens season and career numbers
// (ADR-0034). Nothing here is fetched from a game feed.
//
// Laid out as a baseball card: the portrait framed on the left, the type stack
// left-aligned beside it. The portrait is bigger than the Team Leaders card's
// above it (the `lg` rung, 88x117, against that card's `md`) because this
// card's subject IS the face — you are meant to recognize Judge, not read his
// line. That also makes the headshot the link target here, unlike TeamLeaders
// where it's decoration beside a linked name; an art-only PlayerLink needs the
// explicit `ariaLabel` it demands, or it announces as a nameless button.
export function MilbAlumni({ players, minGames }) {
  if (!players?.length) return null
  return (
    <section className="alum">
      <SectionTitle title="Made The Show" note={minGames ? `${minGames}+ games here` : undefined} />
      <ul className="alum__grid">
        {players.map((p) => (
          <li key={p.id} className="alum__card">
            <PlayerLink id={p.id} className="alum__portrait" ariaLabel={p.name}>
              <Headshot
                personId={p.id}
                name={p.name}
                teamId={p.teamId}
                isMlb={isMlbTeamId(p.teamId)}
                className="alum__shot"
              />
            </PlayerLink>
            {/* The card's right half: everything that is type rather than
                picture, left-aligned in one stack against the portrait's
                edge. */}
            <div className="alum__who">
              <PlayerLink id={p.id} className="alum__name">
                {p.name}
              </PlayerLink>
              {/* Number and position on one line; a player between clubs can be
                  missing either, and the separator goes with whichever is
                  absent rather than leaving a floating dot. */}
              {(p.num || p.pos) && (
                <div className="alum__ident">
                  {p.num && <span className="alum__num">{p.num}</span>}
                  {p.num && p.pos && <span className="alum__dot">·</span>}
                  {p.pos && <span className="alum__pos">{p.pos}</span>}
                </div>
              )}
              {p.teamId && (
                <div className="alum__club">
                  <TeamLogo teamId={p.teamId} name={p.teamName} size={18} className="alum__clublogo" />
                  <span className="alum__clubname">{p.teamName}</span>
                </div>
              )}
              {/* The credential — what he actually did HERE, which is the one
                  fact this card exists to carry and the only line on it that
                  isn't equally true on his player page. A single season shows
                  the year alone rather than "2016-2016". */}
              {p.g != null && (
                <div className="alum__stint">
                  <span className="alum__stintg">{p.g} G</span>
                  <span className="alum__dot">·</span>
                  <span className="alum__stintyrs">
                    {p.first === p.last ? p.first : `${p.first}–${p.last}`}
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
