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
// Three fixes, all here:
//
//   1. THE SHORT NAME. "Padres", not "San Diego Padres". A broadcast's lower
//      third does the same, and the mark beside it carries the city.
//
//   2. IT IS A ROW HEADER, not a data cell. `<th scope="row">` is what tells a
//      screen reader that this cell NAMES its row, so "2:49" further along
//      announces as "Yankees, average, 2:49" instead of as a bare number the
//      listener has to hold a position in their head to interpret. Every board
//      here is thirty rows of numbers whose only meaning is the club they
//      belong to, which makes this the one table cell in the app that most
//      needs it. The rest of the app's ledgers still use `td` — that is a gap
//      worth closing everywhere, not a reason to leave it open here too.
//
//   3. STICKY. The cell pins to the left edge so the numbers scroll UNDER it
//      (styles/68-broadcast-reports.css), which is the pattern the Standings
//      board already uses — including its two hard-won caveats, both worth
//      knowing before touching this markup: Safari drops position:sticky on a
//      table cell whose own `display` is not `table-cell`, and the shared
//      `.standings td.team { display: flex }` rule would set exactly that. So
//      the TD stays a table cell and the flex layout moves INSIDE it, which is
//      what `.rpt__club` is for. Do not flatten this wrapper away.
export function ClubCell({ teamId, name, rank, tied, sub, tab }) {
  return (
    <th scope="row" className="team">
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
    </th>
  )
}
