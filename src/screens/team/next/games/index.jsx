import { useEffect, useState } from 'react'
import { AsyncStatus } from '../../../../components/ui/AsyncGate.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { isoToday } from '../../../../lib/dates.js'
import { hasSeen, markSeen, viewKey } from '../../../../lib/motion/inViewOnce.js'
import { isMlbTeamId } from '../../../../lib/teams.js'
import { loadGames } from '../../data/loadGames.js'
import { AllGames } from '../../modules/TeamGames.jsx'
import { SeasonSchedule } from '../../modules/SeasonSchedule.jsx'
import { TeamHighlightsRail } from '../../modules/media/TeamHighlightsRail.jsx'
import { TeamPhotosRail } from '../../modules/media/TeamPhotosRail.jsx'
import { SHARED } from '../once.js'
import { useBandData } from '../useBandData.js'
import { gamesTag } from './gamesData.js'
import '../../../../styles/team-next/games.css'

// Games (#1107, row 6b): the same cards as today's Games tab, on the stamped look. The schedule,
// Highlights and Photos keep their modules (CSS skins them, games.css); the grid, which had no
// head, now sits on a stamped card with a name tab and a count tag (audit G2). Last 10 is cut (G6,
// the grid's first row is the last three) and Transactions is the Roster band's (RO6), so this
// band does not draw either; loadGames still fetches the transactions page, which costs nothing
// new. The jump-bar count is the games shown. Open surface (ADR-0034): every row is already a
// decided game (`won != null`, cut at `?d=` by the loader), nothing here is sealed.
const GRID_DELAY = '60ms'
const count = (g) => g.seasonGames.length

export default function Games({ team, asOf, sportId, onReady, onCount }) {
  const games = useBandData(() => loadGames(team.id, asOf, SHARED), [team.id, asOf], { onReady, onCount, count })
  // Motion plays once per page visit (docs/motion.md, "The one-shot gate"); a return shows it at rest.
  const seenKey = viewKey(team.id, 'team-games')
  const [still] = useState(() => hasSeen(seenKey))
  useEffect(() => {
    if (games.data) markSeen(seenKey)
  }, [games.data, seenKey])

  const g = games.data
  const mlb = isMlbTeamId(team.id)
  return (
    <Stack gap="section" className={`tnext__games${still ? ' tnext__games--still' : ''}`}>
      <AsyncStatus loading={games.loading} error={games.error} hasData={g != null} errorMessage="Couldn’t load the games. Try again." />
      {g && (g.schedule.length > 0 || g.seasonGames.length > 0) && <h2 className="tnext__bandhead">Games</h2>}
      {g?.schedule.length > 0 && (
        <SeasonSchedule
          teamId={team.id}
          asOf={asOf}
          sportId={sportId}
          schedule={g.schedule}
          allStarGame={g.allStarGame}
          refDate={asOf || isoToday()}
        />
      )}
      {g?.seasonGames.length > 0 && (
        <Card frame="stamped" label="Games" count={gamesTag(g.seasonGames)} stampIn className="tnext__gamescard" style={{ '--stamp-delay': GRID_DELAY }}>
          {/* Keyed so a new club or date starts the list back at its first page. */}
          <AllGames key={`games-${team.id}-${asOf ?? ''}`} games={g.seasonGames} />
        </Card>
      )}
      {g?.seasonGames.length > 0 && mlb && <TeamHighlightsRail key={`highlights-${team.id}`} teamId={team.id} games={g.seasonGames} />}
      {g?.photoGames.length > 0 && mlb && <TeamPhotosRail key={`photos-${team.id}-${asOf ?? ''}`} teamId={team.id} games={g.photoGames} />}
    </Stack>
  )
}
