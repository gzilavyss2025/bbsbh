import { TeamLogo } from '../logo/TeamLogo.jsx'
import { teamAbbr } from '../../lib/teams.js'

// All, then one logo per club. A pressed club pressed again goes back to All.
export function ClubStrip({ clubs, value, onPick, className = '' }) {
  return (
    <div className={`seasonnote__clubs ${className}`.trim()} role="group" aria-label="Filter by club">
      <button type="button" className="seasonnote__clubpick seasonnote__clubpick--all" aria-pressed={value === null} onClick={() => onPick(null)}>
        All
      </button>
      {clubs.map((id) => (
        <button key={id} type="button" className="seasonnote__clubpick" aria-pressed={value === id} aria-label={teamAbbr({ id })} onClick={() => onPick(value === id ? null : id)}>
          <TeamLogo teamId={id} size={26} />
        </button>
      ))}
    </div>
  )
}
