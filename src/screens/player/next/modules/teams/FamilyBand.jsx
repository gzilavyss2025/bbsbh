import { Pill } from '../../../../../components/ui/control/Pill.jsx'
import { Headshot } from '../../../../../components/player/Headshot.jsx'
import { PlayerLink } from '../../../../../components/player/PlayerLink.jsx'

// Family in baseball, at the foot of Team history: who, his relation, and his own line
// ("LF · Mariners · 1993–94 · 78 G"). The Retrosheet credit prints in the page's foot (PlayerNextPage.jsx).
export function FamilyBand({ entries }) {
  return (
    <section className="teamhist__fam" aria-label="Family in baseball">
      <h3 className="teamhist__faml">Family in baseball</h3>
      <ul className="teamhist__famlist">
        {entries.map((e) => (
          <li key={`${e.relation}-${e.personId ?? e.name}`} className="teamhist__famrow">
            {e.personId ? <Headshot personId={e.personId} name={e.name} className="teamhist__shot" /> : <span className="teamhist__shot" />}
            <span className="teamhist__nm">
              <PlayerLink id={e.personId} name={e.name} className="teamhist__famnm">
                {e.name}
              </PlayerLink>
              {e.line && <span className="mono">{e.line}</span>}
            </span>
            <Pill>{e.relation}</Pill>
          </li>
        ))}
      </ul>
    </section>
  )
}
