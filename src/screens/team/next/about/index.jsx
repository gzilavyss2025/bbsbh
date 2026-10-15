import { MilbAlumni } from '../../../../components/teamstats/MilbAlumni.jsx'
import { BallparkCard } from '../../modules/ballpark/BallparkCard.jsx'
import { FranchiseHistory } from '../../modules/ballpark/FranchiseHistory.jsx'
import { useBandData } from '../useBandData.js'
import { loadAbout } from './loadAbout.js'

// About: the Ballpark, the franchise history and (MiLB) Made The Show, as the Overview draws
// them. The jerseys stay in Standings until row 6f moves them.
const NOOP = () => {}
export default function About({ team, asOf, onReady }) {
  const about = useBandData(() => loadAbout(team, asOf), [team.id, asOf], { onReady, onCount: NOOP })
  // The Ballpark needs no payload of its own: it renders off `team` at once.
  const d = about.data
  return (
    <>
      <BallparkCard team={team} attendance={d?.attendance ?? null} />
      {d?.franchise && <FranchiseHistory {...d.franchise} />}
      <MilbAlumni players={d?.milbAlumni?.players} minGames={d?.milbAlumni?.minGames} />
    </>
  )
}
