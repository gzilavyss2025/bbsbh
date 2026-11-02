import { LevelOffseason } from './LevelOffseason.jsx'
import { OffseasonLead } from './OffseasonLead.jsx'
import { WinterCountdown } from './WinterCalendar.jsx'
import { SPORT_IDS } from '../../lib/teams.js'

// WHICH WINTER IS THIS? — the one branch the slate's empty games area takes
// once useOffseason.js has said the tab is looking at an offseason.
//
// It lives here rather than in GameSelect because the two leads have nothing in
// common but the slot. MLB's is the roster wire promoted out of the rail
// (OffseasonLead.jsx): from November to February the wire is the most-read
// thing in baseball, and it is already fetched. A minor level's is not, because
// at High-A in December the wire is close to silent and the rail's own 48-hour
// rule drops it — so those four tabs lead with the thing that IS true of a
// level the week its season ends, which is who left it going up
// (LevelOffseason.jsx, issue #1077).
//
// The countdown is the one piece both share. The winter page has no right
// column, so it always sits inside the lead (MLB's puts it in the hero).
export function OffseasonSlot({ dateStr, sportId, winter }) {
  const countdown = <WinterCountdown winter={winter} />

  if (sportId === SPORT_IDS.MLB) {
    return (
      <OffseasonLead endDate={dateStr} sportId={sportId} winter={winter}>
        {countdown}
      </OffseasonLead>
    )
  }
  return (
    <LevelOffseason sportId={sportId} winter={winter} dateStr={dateStr}>
      {countdown}
    </LevelOffseason>
  )
}
