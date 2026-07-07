import { TeamLogo } from './TeamLogo.jsx'

// A career map, shown above the "Path to the Majors" card: one stop per club
// the player logged real time with (see careerTimelineView's threshold),
// earliest first. Each stop is the club's logo floated on a soft wash of its
// OWN colors — so no border or drop shadow is needed to set the mark off the
// page (see fetchTeamLogoTint) — with the year(s) he spent there beneath it and
// that club's level (MLB / AAA / … / ROK) below that. Stops wrap onto multiple
// rows for a long career rather than scrolling.
export function CareerTimeline({ entries }) {
  if (!entries?.length) return null
  return (
    <section className="careertl">
      <h3 className="section__title"><span>Team history</span></h3>
      <ol className="careertl__track">
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
