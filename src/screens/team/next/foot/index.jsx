import { useAsync } from '../../../../hooks/useAsync.js'
import { useNearView } from '../../../../hooks/scroll/useNearView.js'
import { fetchTeams } from '../../../../api/schedule.js'
import { TeamFilterStrip } from '../../../../components/team/TeamFilterStrip.jsx'
import { TeamLink } from '../../../../components/team/TeamLink.jsx'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { Cluster } from '../../../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { useNav, useRouteLink } from '../../../../lib/nav.js'
import { gameNotesPath, teamPath } from '../../../../lib/route.js'
import { SPORT_LABEL } from '../../../../lib/teams.js'
import { useViewOnce } from '../../../../hooks/motion/useViewOnce.js'
import { footParts } from './footData.js'
import '../../../../styles/team-next/foot.css'

// The page foot (#1107, row 5c), after the last band. Not a band: no jump-bar button, no count.
// The club strip (the level's other clubs, as the old header had it) with the Affiliate chip, and
// the Game Notes card. The clubs come from the same teams.json the page already holds, so the foot
// adds no request. Every link keeps ?d= and ?s=; the notes archive reads neither (it takes ?team=).
// A part with nothing to show is absent. Motion plays once per page visit.
export function TeamNextFoot({ team, asOf, sportId }) {
  const navigate = useNav()
  const linkProps = useRouteLink()
  const [ref, near] = useNearView('300px 0px')
  const navSportId = team.sport?.id ?? sportId ?? null
  const clubs = useAsync(() => (near ? (navSportId ? fetchTeams(navSportId) : Promise.resolve([])) : Promise.resolve(null)), [near, navSportId])
  // Nothing draws until the clubs are in (or failed), so the notes card does not sit alone and
  // then jump down when the strip arrives above it.
  const parts = clubs.data || clubs.error ? footParts(team, clubs.data) : null
  const still = useViewOnce(team.id, 'team-foot', !!parts)
  const stamp = (i) => (still ? {} : { stampIn: true, style: { '--stamp-delay': `${i * 90}ms` } })
  const level = SPORT_LABEL[navSportId] ?? ''
  return (
    <Stack gap="section" ref={ref} className="tnext__foot">
      {parts?.clubs && (
        <Card as="div" frame="stamped" label="Other clubs" count={level} className="tnext__clubstrip" {...stamp(0)}>
          {parts.affiliateId && (
            <TeamLink id={parts.affiliateId} className="tnext__parent" ariaLabel={`Affiliate of ${team.parentOrgName ?? 'its MLB club'}`}>
              <span className="tnext__parent-label">Affiliate of</span>
              <TeamLogo teamId={parts.affiliateId} name={team.parentOrgName} size={34} />
            </TeamLink>
          )}
          <TeamFilterStrip
            teams={parts.clubs}
            selectedTeamId={null}
            onSelect={(id, t) => navigate(teamPath(id, { name: t?.name, d: asOf, s: sportId }))}
            showMlbPin={false}
            showArrows
            centerTeamId={team.id}
            ariaLabel={`Browse ${level} teams`}
            className="teamfilterstrip--nav"
          />
        </Card>
      )}
      {parts?.notes && (
        <Card as="div" frame="stamped" label="Game notes" count="club press notes" {...stamp(1)}>
          <Cluster gap="base">
            <Stack gap="tight">
              <Door {...linkProps(gameNotesPath(team.id))}>Game notes</Door>
              <p className="tnext__doorcap">This club’s notes, newest first</p>
            </Stack>
            <Stack gap="tight">
              <Door {...linkProps(gameNotesPath('all'))}>Notes archive</Door>
              <p className="tnext__doorcap">Every club, every date</p>
            </Stack>
          </Cluster>
        </Card>
      )}
    </Stack>
  )
}
