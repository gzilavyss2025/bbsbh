import { JerseyCombos, MilbUniformStrip } from '../../../../components/logo/JerseyCombos.jsx'
import { MilbAlumni } from '../../../../components/teamstats/MilbAlumni.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { useViewOnce } from '../../../../hooks/motion/useViewOnce.js'
import { useRouteLink } from '../../../../lib/nav.js'
import { postseasonDoor } from '../../data/shared.js'
import { BallparkCard } from '../../modules/ballpark/BallparkCard.jsx'
import { FranchiseHistory } from '../../modules/ballpark/FranchiseHistory.jsx'
import { useBandData } from '../useBandData.js'
import { aboutCount, loadAbout } from './loadAbout.js'
import '../../../../styles/team-next/about.css'

// About: what this club is. The ballpark (with the manager in its fact strip), the franchise
// history (MLB), the jerseys and (MiLB) Made The Show, each a stamped card with a name tab.
// Everything here is open (ADR-0034) and moves with nothing but the jerseys, which follow `?d=`.
// Motion plays once per page visit (docs/motion.md, "The one-shot gate").
const stamp = (still, i) => (still ? {} : { stampIn: true, style: { '--stamp-delay': `${i * 90}ms` } })

export default function About({ team, asOf, sportId, onReady, onCount }) {
  const linkProps = useRouteLink()
  const door = postseasonDoor(team.id, asOf, sportId ?? team.sport?.id ?? 1)
  const about = useBandData(() => loadAbout(team, asOf), [team.id, asOf], {
    onReady,
    onCount,
    count: (d) => aboutCount(d, team),
  })
  const still = useViewOnce(team.id, 'team-about', !!about.data)
  const d = about.data
  if (!d) return null
  const card = (label, i, count) => ({ frame: 'stamped', label, count, ...stamp(still, i) })
  const { jerseyCombos, homeRecord, awayRecord } = d.jerseys
  let i = 0
  return (
    <Stack gap="section" className="tnext__about">
      <BallparkCard team={team} attendance={d.attendance} manager={d.manager} cardProps={card('Ballpark', i++)} />
      {d.franchise && <FranchiseHistory {...d.franchise} cardProps={card('Franchise history', i++)} />}
      {door && <Door className="tnext__about-door" {...linkProps(door)}>Postseason history</Door>}
      {jerseyCombos.length > 0 && (
        <JerseyCombos combos={jerseyCombos} teamId={team.id} teamName={team.name} cardProps={card('Logos & jerseys', i++, 'record by jersey')} />
      )}
      {homeRecord && (
        <MilbUniformStrip
          teamId={team.id}
          teamName={team.name}
          homeRecord={homeRecord}
          awayRecord={awayRecord}
          cardProps={card('Logos & jerseys', i++, 'home and away')}
        />
      )}
      <MilbAlumni players={d.milbAlumni?.players} minGames={d.milbAlumni?.minGames} cardProps={card('Made The Show', i++, d.milbAlumni?.minGames ? `${d.milbAlumni.minGames}+ games here` : undefined)} />
    </Stack>
  )
}
