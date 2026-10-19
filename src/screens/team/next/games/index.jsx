import { AsyncStatus } from '../../../../components/ui/AsyncGate.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { isoToday } from '../../../../lib/dates.js'
import { useViewOnce } from '../../../../hooks/motion/useViewOnce.js'
import { isMlbTeamId } from '../../../../lib/teams.js'
import { loadGames } from '../../data/loadGames.js'
import { TeamHighlightsRail } from '../../modules/media/TeamHighlightsRail.jsx'
import { TeamPhotosRail } from '../../modules/media/TeamPhotosRail.jsx'
import { SHARED } from '../once.js'
import { useBandData } from '../useBandData.js'
import { gamesTag } from './gamesData.js'
import { SeasonGrid } from './SeasonGrid.jsx'
import '../../../../styles/team-next/games/games.css'
import '../../../../styles/team-next/games/season-grid.css'

// Games (#1107, row 6b): the season grid, then Highlights and Photos. The grid (SeasonGrid.jsx) is
// one stamped card with a name tab and a count tag. It replaced the Schedule strip and the ticket
// grid of every decided game, and it carries the Stamp In door the Schedule card held. Last 10 is
// cut (G6) and Transactions is the Roster band's (RO6), so this band does not draw either;
// loadGames still fetches the transactions page, which costs nothing new. The jump-bar count is
// the games decided. Open surface (ADR-0034): the grid's results are cut at `?d=` by the loader,
// and nothing here is sealed.
const GRID_DELAY = '60ms'
const count = (g) => g.seasonGames.length

export default function Games({ team, asOf, sportId, onReady, onCount }) {
  const games = useBandData(() => loadGames(team.id, asOf, SHARED), [team.id, asOf], { onReady, onCount, count })
  // Motion plays once per page visit (docs/motion.md, "The one-shot gate"); a return shows it at rest.
  const still = useViewOnce(team.id, 'team-games', !!games.data)

  const g = games.data
  const mlb = isMlbTeamId(team.id)
  return (
    <Stack gap="section" className={`tnext__games${still ? ' tnext__games--still' : ''}`}>
      <AsyncStatus loading={games.loading} error={games.error} hasData={g != null} errorMessage="Couldn’t load the games. Try again." />
      {g && (g.schedule.length > 0 || g.seasonGames.length > 0) && <h2 className="tnext__bandhead">Games</h2>}
      {g?.schedule.length > 0 && (
        <SeasonGrid
          teamId={team.id}
          asOf={asOf}
          sportId={sportId}
          schedule={g.schedule}
          allStarGame={g.allStarGame}
          refDate={asOf || isoToday()}
          count={gamesTag(g.seasonGames)}
          style={{ '--stamp-delay': GRID_DELAY }}
        />
      )}
      {g?.seasonGames.length > 0 && mlb && <TeamHighlightsRail key={`highlights-${team.id}`} teamId={team.id} games={g.seasonGames} />}
      {g?.photoGames.length > 0 && mlb && <TeamPhotosRail key={`photos-${team.id}-${asOf ?? ''}`} teamId={team.id} games={g.photoGames} />}
    </Stack>
  )
}
