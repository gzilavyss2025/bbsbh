import '../../styles/worldseries/home.css'
import { fetchPlateUmpires } from '../../api/postseason/plateUmpire.js'
import { fetchUpcomingSeriesGames } from '../../api/postseason/upcoming.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useWorldSeriesHome } from '../../hooks/postseason/useWorldSeriesHome.js'
import { ledgerModel } from '../../lib/postseason/worldseries/ledger.js'
import { worldSeriesMode } from '../../lib/postseason/worldseries/mode.js'
import { Grid } from '../ui/layout/Grid.jsx'
import { Stack } from '../ui/layout/Stack.jsx'
import { Bullpen } from './cards/Bullpen.jsx'
import { HomeRoad } from './cards/HomeRoad.jsx'
import { HotBats } from './cards/HotBats.jsx'
import { Played } from './cards/Played.jsx'
import { Probables } from './cards/Probables.jsx'
import { Tape } from './cards/Tape.jsx'
import { Trip } from './cards/Trip.jsx'
import { Hero } from './Hero.jsx'
import { Ledger } from './Ledger.jsx'
import { Reel } from './Reel.jsx'
import { ScoutingReport } from './ScoutingReport.jsx'

// THE WORLD SERIES HOME (#1906). Rendered by GameSelect on every slate date in
// the postseason window; it draws nothing unless the bracket says both clubs are
// known and the Series is not decided heading into the slate date (mode.js).
// It replaces the bracket fold and the series primer on those dates. Phone
// (below 740px): the hero carries the schedule strip. Wide: the ledger table
// carries it. Today's game shows no score at all until the slate date has
// passed (ADR-0116 removed the seal and the day pass that lifted it).
//
// Cards, top to bottom. Game day: hero, [ledger], reel, probables, tape + hot
// bats, bullpen; the scouting report follows probables. Off day: hero, [ledger], reel,
// scouting report, [played on a phone], the trip,
// home and road + bullpen (side by side wide).
export function WorldSeriesHome({ bracket, slateDate, wide = false }) {
  const mode = worldSeriesMode(bracket)
  const series = mode?.series ?? null
  const clubIds = series ? series.slots.map((s) => s.club.id) : null
  const { data } = useWorldSeriesHome({ clubIds, games: series?.games, slateDate })
  const focus = series?.upcoming.find((g) => g.gameNumber === mode.gameNumber) ?? null
  const focusPk = focus?.gamePk ?? null
  const playedPks = (series?.games ?? []).map((g) => g.gamePk)
  const parkKey = [focusPk, ...playedPks].join(',')
  const parks = useAsync(() => fetchUpcomingSeriesGames([focusPk, ...playedPks]), [parkKey])
  // Tonight's plate umpire, once posted (an assignment, not a result). Game day only.
  const dayType = mode?.dayType
  const umpires = useAsync(() => (dayType === 'game' ? fetchPlateUmpires(slateDate) : Promise.resolve({})), [dayType, slateDate])
  if (!mode) return null

  // "NLCS" / "ALCS": the league whose LCS the club played in, from the bracket.
  const lcsRound = (id) => {
    const lg = ['AL', 'NL'].find((l) => bracket.leagues?.[l]?.lcs?.slots.some((s) => s.club?.id === id))
    return lg ? `${lg}CS` : ''
  }
  const model = ledgerModel({
    clubIds,
    games: series.games,
    upcoming: series.upcoming,
    runsByGame: data?.runsByGame ?? {},
    slateDate,
  })
  const parkOf = parks.data ?? {}
  const game = focusPk ? parkOf[focusPk] ?? null : null
  const gameDay = mode.dayType === 'game'
  const abbr = Object.fromEntries(series.slots.map((s) => [s.club.id, s.club.abbreviation]))
  // Home and away come from the clubs' own schedule rows, so a failed park read
  // cannot leave the Box door with an empty matchup.
  const rowOf = Object.fromEntries(Object.values(data?.clubGames ?? {}).flat().map((r) => [r.gamePk, r]))
  const played = series.games.map((g) => ({
    gamePk: g.gamePk,
    gameNumber: g.gameNumber,
    date: g.date,
    park: parkOf[g.gamePk]?.venue?.name ?? '',
    awayAbbr: abbr[rowOf[g.gamePk]?.awayId] ?? '',
    homeAbbr: abbr[rowOf[g.gamePk]?.homeId] ?? '',
  }))
  const lastPlayed = series.games.at(-1)
  const scouting = (
    <ScoutingReport
      clubIds={clubIds}
      slateDate={slateDate}
      dayType={mode.dayType}
      gamePk={focusPk}
      plateUmpire={focusPk ? umpires.data?.[focusPk] ?? null : null}
    />
  )
  const bullpen = data && <Bullpen clubIds={clubIds} boxscoresByClub={data.boxscores} slateDate={slateDate} wide={wide} />

  return (
    <Stack gap="section" className="ww">
      <Hero
        mode={mode}
        model={model}
        game={game}
        records={data?.standings ?? {}}
        slateDate={slateDate}
        wide={wide}
        played={played}
        umpire={focusPk ? umpires.data?.[focusPk] ?? null : null}
      />
      {wide && <Ledger series={series} model={model} />}
      {data && <Reel series={series} slateDate={slateDate} clubGames={data.clubGames} lcsRound={lcsRound} />}
      {gameDay ? (
        <>
          <Probables game={game} season={Number(slateDate.slice(0, 4))} slateDate={slateDate} />
          {scouting}
          {data && (
            <Grid min={340} gap="loose">
              <Tape awayId={game?.awayId ?? clubIds[0]} homeId={game?.homeId ?? clubIds[1]} data={data} slateDate={slateDate} />
              <HotBats clubIds={clubIds} splitsByClub={data.hotBats} />
            </Grid>
          )}
          {bullpen}
        </>
      ) : (
        <>
          {scouting}
          {!wide && <Played rows={played} />}
          <Trip
            fromVenueId={lastPlayed ? parkOf[lastPlayed.gamePk]?.venue?.id : null}
            toVenueId={game?.venue?.id}
            firstPitch={game?.gameDate}
            wide={wide}
          />
          {data && (
            <Grid min={340} gap="loose">
              <HomeRoad clubIds={clubIds} clubGames={data.clubGames} slateDate={slateDate} />
              {bullpen}
            </Grid>
          )}
        </>
      )}
    </Stack>
  )
}
