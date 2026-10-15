import { AsyncStatus } from '../../../../components/ui/AsyncGate.jsx'
import { loadGames } from '../../data/loadGames.js'
import { GamesBody } from '../../GamesTab.jsx'
import { useBandData } from '../useBandData.js'

// Games: today's Games tab, as it is.
const count = (g) => g.seasonGames.length
export default function Games({ team, asOf, sportId, onReady, onCount }) {
  const games = useBandData(() => loadGames(team.id, asOf), [team.id, asOf], { onReady, onCount, count })
  return (
    <>
      <AsyncStatus loading={games.loading} error={games.error} hasData={games.data != null} errorMessage="Couldn’t load the games. Try again." />
      {games.data && <GamesBody team={team} asOf={asOf} sportId={sportId} games={games.data} />}
    </>
  )
}
