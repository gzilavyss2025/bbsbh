import { selectRecordIsClosed } from '../../../api/gamerecord/played.js'
import { scorebookDate } from '../../../lib/dates.js'
import { FactGrid } from '../../../components/ui/frame/FactGrid.jsx'
import { UmpiresCard } from '../../../components/umpire/UmpiresCard.jsx'
import { UniformFigureButton } from '../../../components/logo/UniformFigure.jsx'
import { batterFigureUrls } from '../../../api/uniforms.js'
import { AttendanceFact, BallparkFact, Fact, managerFact } from '../../TeamInfo.jsx'

// The fact strip and the crew, one grid under the hero: date, park, first pitch is in the
// hero's stamp, then weather, attendance, manager, tonight's uniform, the broadcast (away
// page only) and the umpires. Box weather shows only when the outdoor weather is missing.
export function LineupFacts({ feed, side, info, officials, season, manager, uniform, uniformFigure, broadcast, weather, weatherLoading }) {
  const figureUrls = batterFigureUrls(uniformFigure)
  return (
    <FactGrid look="strip" className="lnext__facts">
      <Fact label="Date" value={scorebookDate(info.officialDate)} />
      <BallparkFact venue={info.venue} venueId={info.venueId} gameDate={info.officialDate} />
      <Fact label="Weather" value={weatherLoading ? '…' : weather?.text} />
      {!weatherLoading && !weather?.text && <Fact label="Box weather" value={info.weather} />}
      <AttendanceFact venue={info.venue} attendance={info.attendance} />
      <Fact label="Manager" value={managerFact(manager)} />
      <Fact
        label="Uniform"
        value={uniform}
        aside={figureUrls && uniform && <UniformFigureButton urls={figureUrls} label={uniform} />}
      />
      {side === 'away' && <Fact label="Broadcast" value={broadcast} />}
      {officials.length === 0 && !selectRecordIsClosed(feed) && <Fact label="Umpires" value="Not posted yet" />}
      <UmpiresCard officials={officials} seasonYear={season} closed={selectRecordIsClosed(feed)} />
    </FactGrid>
  )
}
