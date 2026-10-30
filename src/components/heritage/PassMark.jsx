import { useId, useState } from 'react'
import { hasMonoLogo, teamLogoUrl } from '../../lib/teams.js'
import { seasonMark } from '../../lib/identity/seasonMarks.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// The existing knockout art supplies the ink shapes, exactly as in GameStamp.
// Missing art falls back to TeamLogo; historical marks retain its era logic.
export function PassMark({ team, date }) {
  const id = useId()
  const [failed, setFailed] = useState(null)
  const source = teamLogoUrl(team.id, 'mono')
  if (!hasMonoLogo(team.id) || seasonMark(team.id, date) || failed === source) {
    return <TeamLogo teamId={team.id} name={team.name || team.abbreviation} size={120} season={date} bw />
  }
  return (
    <>
    {/* A failed SVG <image> inside a mask silently paints nothing in some
        browsers. The HTML image shares the same cached resource and gives us
        a reliable error event, so the fallback cannot disappear with it. */}
    <img hidden src={source} alt="" onError={() => setFailed(source)} />
    <svg className="heritagepass__mark" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
          <image href={source} x="0" y="0" width="120" height="120" preserveAspectRatio="xMidYMid meet" />
        </mask>
      </defs>
      <rect width="120" height="120" fill="currentColor" mask={`url(#${id})`} />
    </svg>
    </>
  )
}
