import { TeamLogo } from './TeamLogo.jsx'

// A career map, shown above the "Path to the Majors" card: one stop per club
// the player logged real time with (see careerTimelineView's threshold),
// earliest first. Each stop is the club's logo floated on a soft wash of its
// OWN colors — so no border or drop shadow is needed to set the mark off the
// page (see fetchTeamLogoTint) — with the year(s) he spent there beneath it and
// that club's level (MLB / AAA / … / ROK) below that. Stops wrap onto multiple
// rows for a long career rather than scrolling.
// Reused by the MiLB team page as an "Affiliation history" strip (each stop an
// MLB parent org rather than a player's club) — hence the `title` prop; the
// visual treatment is identical by request.

// The track is a CSS grid, not flex-wrap, so the column count can be chosen
// to balance rows — flex-wrap always fills each row to the max before
// spilling over, so an 7-stop career reads as a full row of 5 then a lonely
// trailing 2. MAX_STOPS_PER_ROW is the most that comfortably fits the page's
// fixed ~400px column (.screen's max-width) without crowding; a count over
// that spreads across just enough rows to divide as evenly as possible
// (7 stops -> 4+3, never 5+2).
const MAX_STOPS_PER_ROW = 5
function balancedColumns(count, maxPerRow) {
  if (count <= maxPerRow) return count
  const rows = Math.ceil(count / maxPerRow)
  return Math.ceil(count / rows)
}

export function CareerTimeline({ entries, title = 'Team history' }) {
  if (!entries?.length) return null
  const cols = balancedColumns(entries.length, MAX_STOPS_PER_ROW)
  return (
    <section className="careertl">
      <h3 className="section__title"><span>{title}</span></h3>
      <ol className="careertl__track" style={{ '--careertl-cols': cols }}>
        {entries.map((e) => (
          <li className="careertl__stop" key={`${e.teamId}-${e.minSeason}`} title={e.title}>
            <span
              className="careertl__badge"
              style={e.tint ? { background: e.tint } : undefined}
            >
              <TeamLogo teamId={e.teamId} name={e.teamName} size={42} />
            </span>
            <span className="careertl__years">{e.yearText}</span>
            {e.level && <span className="careertl__years careertl__level">{e.level}</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
