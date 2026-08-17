import { TeamLink } from '../team/TeamLink.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// The leftmost cell of every report board: rank, mark, club, and an optional
// second line.
//
// It exists because that cell has THREE jobs the pages kept solving four
// different ways — and because it is the cell that decides whether the board
// is readable on a phone at all. A 430px-wide viewport showed the first draft
// of these tables with the club column filling the screen and every number
// scrolled off the right edge: the board was a list of thirty club names.
//
// Two fixes, both here:
//
//   1. THE SHORT NAME. "Padres", not "San Diego Padres". A broadcast's lower
//      third does the same, and the mark beside it carries the city.
//
//   2. STICKY. The cell pins to the left edge so the numbers scroll UNDER it
//      (styles/68-broadcast-reports.css), which is the pattern the Standings
//      board already uses — including its two hard-won caveats, both worth
//      knowing before touching this markup: Safari drops position:sticky on a
//      table cell whose own `display` is not `table-cell`, and the shared
//      `.standings td.team { display: flex }` rule would set exactly that. So
//      the TD stays a table cell and the flex layout moves INSIDE it, which is
//      what `.rpt__club` is for. Do not flatten this wrapper away.
export function ClubCell({ teamId, name, rank, tied, sub, tab }) {
  return (
    <td className="team">
      <span className="rpt__club">
        {rank != null || tied ? (
          <span className="rpt__rank">
            {tied ? 'T' : ''}
            {rank ?? '—'}
          </span>
        ) : null}
        <TeamLink id={teamId} tab={tab}>
          <TeamLogo teamId={teamId} name={name} size={18} />
          {name}
        </TeamLink>
      </span>
      {sub ? <span className="rpt__sub">{sub}</span> : null}
    </td>
  )
}
