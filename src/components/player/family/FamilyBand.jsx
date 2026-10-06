import '../../../styles/31d-prospect-card.css'
import { Card } from '../../ui/frame/Card.jsx'
import { Pill } from '../../ui/control/Pill.jsx'
import { Headshot } from '../Headshot.jsx'
import { PlayerLink } from '../PlayerLink.jsx'

// FAMILY IN BASEBALL -- relatives who also played or managed: father, brother,
// son, uncle. Open surface (ADR-0034): who a man's father is says nothing about
// a game, so nothing here is sealed. WHAT the rows say and their order live in
// api/person/family/family.js (`familyBand`); this only draws them.
//
// It wears the prospect-rank card's shell and its prose foot, so the Retrosheet
// credit prints the way that card's credits do. A relative with no MLBAM id is a
// name, not a link (PlayerLink does that). Renders NOTHING with no entries.
export function FamilyBand({ entries, credit = [] }) {
  if (!entries?.length) return null
  return (
    <Card frame="ledger" body="flush" className="levelprog prankhist">
      <header className="levelprog__head">
        <h3 className="levelprog__title">Family in baseball</h3>
      </header>
      <ul className="prankhist__list" aria-label="Relatives who also played or managed">
        {entries.map((e, i) => (
          <li key={`${i}-${e.relation}-${e.personId ?? e.name}`} className="famband__row">
            {e.personId ? <Headshot personId={e.personId} name={e.name} className="famband__shot" /> : <span className="famband__shot" />}
            <PlayerLink id={e.personId} name={e.name} className="famband__name">
              {e.name}
            </PlayerLink>
            <Pill>{e.relation}</Pill>
          </li>
        ))}
      </ul>
      {credit.length > 0 && (
        <div className="prankhist__foot">
          {credit.map((line) => (
            <p key={line} className="prankhist__credit">
              {line}
            </p>
          ))}
        </div>
      )}
    </Card>
  )
}
