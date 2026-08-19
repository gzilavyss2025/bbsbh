import { TeamLink } from '../team/TeamLink.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { teamChipColors } from '../../lib/teams.js'
import { moneyLabel } from './Money.jsx'

// All thirty, never a top ten. The point of the graphic is the shape of the
// whole league — the gap between the top four and the bottom four is the story,
// and a truncated board hides exactly the half that makes it legible.
//
// The rail's pick RINGS a club's row rather than filtering the board down to it:
// one bar on its own says nothing a number could not, and filtering a ranking to
// a single entry destroys the only thing a ranking is for.
export function ClubPayrolls({ clubs, pickedTeamId, max }) {
  return (
    <section className="payclubs" aria-labelledby="payclubs-title">
      <div className="metricbar">
        <span className="metricbar__title" id="payclubs-title">
          Club payrolls
        </span>
      </div>
      <div className="payclubs__grid">
        {clubs.map((club) => {
          const chip = teamChipColors(club.teamId)
          return (
            <div
              key={club.teamId}
              className={`payclubs__row${club.teamId === pickedTeamId ? ' is-picked' : ''}`}
              style={{ '--club': chip?.primary, '--club-2': chip?.secondary }}
            >
              <span className="payclubs__rank">{club.rank}</span>
              <span className="payclubs__mark">
                {/* Straight to that club's own ledger, not its Overview: this
                    row IS its payroll, and landing a reader on a preview of the
                    table they just left is what TeamLink's `tab` exists for. */}
                <TeamLink id={club.teamId} tab="contracts" ariaLabel={club.name}>
                  <TeamLogo teamId={club.teamId} name={club.name} size={22} />
                </TeamLink>
              </span>
              <span className="payclubs__track">
                <span className="paybar__fill" style={{ width: `${(club.payroll / max) * 100}%` }} />
              </span>
              <span className="payclubs__value">{moneyLabel(club.payroll)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
