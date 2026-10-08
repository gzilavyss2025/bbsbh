import '../../styles/35-postseason-series.css'
import '../../styles/postseason/series-parts.css'
import '../../styles/postseason/series-live.css'
import { fetchPlateUmpires } from '../../api/postseason/plateUmpire.js'
import { fetchUpcomingSeriesGames } from '../../api/postseason/upcoming.js'
import { roundTitle } from '../../api/postseason/text.js'
import { useAsync } from '../../hooks/useAsync.js'
import { ribbonNodes } from '../../lib/postseason/primer/ribbonNodes.js'
import { seriesMark } from '../../lib/postseason/seriesMarks.js'
import { BracketNow } from '../bracket/BracketNow.jsx'
import { BracketRail } from '../bracket/BracketRail.jsx'
import { SurvivorsBoard } from '../bracket/SurvivorsBoard.jsx'
import { SeasonSeriesStrip } from '../teamstats/SeasonSeriesStrip.jsx'
import { Pill } from '../ui/control/Pill.jsx'
import { SeriesEdges } from './edges/SeriesEdges.jsx'
import { SeriesMark } from './SeriesMark.jsx'
import { SeriesLeadersLedger } from './SeriesLeadersLedger.jsx'
import { SeriesRibbon } from './SeriesRibbon.jsx'
import { SeriesStarters } from './SeriesStarters.jsx'
import { SeriesTotals } from './SeriesTotals.jsx'

// October's two slate slots, in one place (ADR-0087, 2026-10-08 addendum): the
// slot under the game list (`part="main"`) and the slot in the right column
// (`part="rail"`). With a `primer` (usePrimer) they draw the series primer; with
// none they draw what they always did, the survivors' board and the bracket rail.
//
// SPOILER FOOTING. The cutoff is a date. Every part reads games that went Final
// before it, or files that exist before first pitch; none reads today's game. No
// SealBox, no Scores Unlocked.
export function SeriesPrimer({ part, primer }) {
  const { series, bracket, cutoff, slateDate, favoriteTeamId } = primer
  if (part === 'main') {
    return series ? <Main primer={primer} /> : <SurvivorsBoard bracket={bracket} slateDate={slateDate} favoriteTeamId={favoriteTeamId} />
  }
  return series ? <Rail primer={primer} /> : <BracketRail bracket={bracket} cutoff={cutoff} slateDate={slateDate} />
}

// Starters, Today's edges, the ribbon, the regular-season strip.
function Main({ primer: { list, series, game, setPick, data, bracket, cutoff, slateDate, isToday } }) {
  const todayPk = series.cutoffGame.gamePk
  const pks = [todayPk, ...series.upcoming.map((g) => g.gamePk)].filter(Boolean)
  const { data: details } = useAsync(() => fetchUpcomingSeriesGames(pks), [pks.join(',')])
  const { data: plate } = useAsync(() => fetchPlateUmpires(slateDate), [slateDate])
  const clubs = series.slots.map((slot) => slot.club)
  const byPk = Object.fromEntries(data.games.map((g) => [g.gamePk, g]))
  const parks = Object.fromEntries(
    pks.map((pk) => [pk, { venueName: details?.[pk]?.venue.name, ...(pk === todayPk && { gameDate: game.gameDate, tzId: game.venue.tzId }) }]),
  )
  const today = details?.[todayPk]
  return (
    <>
      {list.length > 1 && (
        <div role="group" aria-label="Series" className="seriesprimer__tabs">
          {list.map((s) => {
            const mark = seriesMark({ ...s, season: bracket.season })
            return (
              <Pill key={s.id} role="control" pressed={s === series} onClick={() => setPick(s.id)}>
                {/* The round's art on its navy plate; a season with no art keeps the words. */}
                {mark ? <SeriesMark mark={mark} height={18} plate /> : roundTitle(s)}
              </Pill>
            )
          })}
        </div>
      )}
      {/* The schedule names the starter who really pitched once the day is past, so the starters wait for today. */}
      {isToday && (
        <SeriesStarters
          head="Starting pitchers"
          note={[`Game ${series.cutoffGame.gameNumber}`, today?.venue.name].filter(Boolean).join(' · ')}
          game={today}
          season={bracket.season}
          cutoff={cutoff}
        />
      )}
      <SeriesEdges
        gamePk={todayPk}
        date={cutoff}
        season={bracket.season}
        awayId={game.away.id}
        homeId={game.home.id}
        plateUmpire={plate?.[todayPk] ?? null}
      />
      {data.loading ? (
        <p className="hint">Loading the series so far…</p>
      ) : (
        <SeriesRibbon series={series} nodes={ribbonNodes(series, { scoresByPk: byPk })} games={{ ...parks, ...byPk }} clubs={clubs} />
      )}
      <SeasonSeriesStrip
        viewingTeamId={clubs[1].id}
        opponentId={clubs[0].id}
        officialDate={cutoff}
        sportId={1}
        gameTypes="R"
        settled
        look="label"
        title="Regular season"
      />
    </>
  )
}

// The small bracket, the series totals, the leaders ledger. It wears the bracket
// rail's own box (width, gutter, top edge), so the column does not move.
function Rail({ primer: { series, data, bracket, cutoff } }) {
  const { stats } = data
  return (
    <aside className="bracketrail" aria-label="The series so far">
      <BracketNow bracket={bracket} cutoff={cutoff} />
      {stats?.totals && <SeriesTotals totals={stats.totals} clubs={series.slots.map((slot) => slot.club)} />}
      {stats && <SeriesLeadersLedger batting={stats.batting} pitching={stats.pitching} games={data.games.length} />}
    </aside>
  )
}
