import '../../styles/worldseries/home.css'
import { fetchScheduleGame } from '../../api/schedule.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useWorldSeriesView } from '../../hooks/postseason/useWorldSeriesView.js'
import { withFormatDates } from '../../lib/postseason/worldseries/hero.js'
import { ledgerModel } from '../../lib/postseason/worldseries/ledger.js'
import { lcsRoundOf, worldSeriesMode } from '../../lib/postseason/worldseries/mode.js'
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
// It replaces the bracket fold and the series primer on those dates. The hero
// carries the calendar at every width; wide, the ledger table follows it with
// the runs. Today's game shows no score at all until the slate date has
// passed (ADR-0116 removed the seal and the day pass that lifted it).
//
// Cards, top to bottom. Game day: hero, [ledger], reel, probables, tape + hot
// bats, bullpen; the scouting report follows probables. Off day: hero, [ledger], reel,
// scouting report, [played on a phone], the trip,
// home and road + bullpen (side by side wide).
//
// The hero ends on the slate's own card for the next game (`renderCard` builds it, `seriesGame` is
// today's, already on the slate). On an off day the slate holds no game, so the card is fetched
// from the game's own date: the next game's card, though it is not today's. Without `renderCard`
// (no slate to borrow it from) the hero keeps its door.
export function WorldSeriesHome({ bracket, slateDate, wide = false, seriesGame = null, renderCard = null }) {
  const mode = worldSeriesMode(bracket)
  const { series, clubIds, data, focusPk, game, umpire, parkOf, played } = useWorldSeriesView(mode, slateDate)
  // The next game's pk and date come from the bracket, so the card's read starts with the page
  // and does not wait on the park read behind `game`.
  const offDayGame = renderCard && mode?.dayType !== 'game' ? mode?.series.upcoming.find((g) => g.gameNumber === mode.gameNumber) : null
  const offDay = useAsync(
    () => (offDayGame?.gamePk && offDayGame.date ? fetchScheduleGame(offDayGame.date, offDayGame.gamePk) : Promise.resolve(null)),
    [offDayGame?.gamePk, offDayGame?.date],
  )
  if (!mode) return null
  const cardGame = mode.dayType === 'game' ? seriesGame : offDay.data
  const gameCard =
    renderCard && cardGame ? (
      <ul className="gamelist" aria-label={`Game ${mode.gameNumber ?? ''}`.trim()}>
        {renderCard(cardGame, 0, cardGame.officialDate)}
      </ul>
    ) : null

  const model = ledgerModel({
    clubIds,
    games: series.games,
    // If-needed games dated from the Series format, as in the hero, so the two schedules agree.
    upcoming: withFormatDates(series.games, series.upcoming, slateDate),
    runsByGame: data?.runsByGame ?? {},
    slateDate,
  })
  const gameDay = mode.dayType === 'game'
  const lastPlayed = series.games.at(-1)
  const scouting = (
    <ScoutingReport
      clubIds={clubIds}
      sides={[game?.awayId ?? clubIds[0], game?.homeId ?? clubIds[1]]}
      slateDate={slateDate}
      dayType={mode.dayType}
      gamePk={focusPk}
      gameNumber={mode.gameNumber}
      game={game}
      plateUmpire={umpire}
      series={series}
    />
  )
  const bullpen = data && <Bullpen clubIds={clubIds} boxscoresByClub={data.boxscores} slateDate={slateDate} />

  return (
    <Stack gap="section" className="ww">
      <Hero
        mode={mode}
        game={game}
        slateDate={slateDate}
        wide={wide}
        played={played}
        umpire={umpire}
        splitsByClub={data?.hotBats ?? null}
        clubGames={data?.clubGames ?? null}
        gameCard={gameCard}
        gameCardPending={Boolean(offDayGame?.gamePk) && offDay.loading}
      />
      {wide && <Ledger series={series} model={model} />}
      {data && <Reel series={series} slateDate={slateDate} clubGames={data.clubGames} lcsRound={(id) => lcsRoundOf(bracket, id)} />}
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
