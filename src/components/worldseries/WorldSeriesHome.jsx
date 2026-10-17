import '../../styles/worldseries/home.css'
import { fetchUpcomingSeriesGames } from '../../api/postseason/upcoming.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useWorldSeriesHome } from '../../hooks/postseason/useWorldSeriesHome.js'
import { ledgerModel } from '../../lib/postseason/worldseries/ledger.js'
import { worldSeriesMode } from '../../lib/postseason/worldseries/mode.js'
import { Hero } from './Hero.jsx'
import { Stack } from '../ui/layout/Stack.jsx'
import { Ledger } from './Ledger.jsx'

// THE WORLD SERIES HOME (#1906). Rendered by GameSelect on every slate date in
// the postseason window; it draws nothing unless the bracket says both clubs are
// known and the Series is not decided heading into the slate date (mode.js).
// It replaces the bracket fold and the series primer on those dates. Phone
// (below 740px): the hero carries the schedule strip. Wide: the ledger table
// carries it. `live` is Scores Unlocked for the slate date.
export function WorldSeriesHome({ bracket, slateDate, live = false, wide = false, onRevealScores }) {
  const mode = worldSeriesMode(bracket)
  const series = mode?.series ?? null
  const clubIds = series ? series.slots.map((s) => s.club.id) : null
  const { data } = useWorldSeriesHome({ clubIds, games: series?.games, slateDate, live })
  const focus = series?.upcoming.find((g) => g.gameNumber === mode.gameNumber) ?? null
  const focusPk = focus?.gamePk ?? null
  const park = useAsync(() => (focusPk ? fetchUpcomingSeriesGames([focusPk]) : Promise.resolve({})), [focusPk])
  if (!mode) return null

  const model = ledgerModel({
    clubIds,
    games: series.games,
    upcoming: series.upcoming,
    runsByGame: data?.runsByGame ?? {},
    slateDate,
    live,
  })
  const game = focusPk ? park.data?.[focusPk] ?? null : null
  return (
    <Stack gap="section" className="ww">
      <Hero
        mode={mode}
        model={model}
        game={game}
        records={data?.standings ?? {}}
        slateDate={slateDate}
        live={live}
        wide={wide}
        onRevealScores={onRevealScores}
      />
      {wide && <Ledger series={series} model={model} onRevealScores={onRevealScores} />}
    </Stack>
  )
}
