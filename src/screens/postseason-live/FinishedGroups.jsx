import { Reel } from '../../components/worldseries/Reel.jsx'
import { ScoutingReport } from '../../components/worldseries/ScoutingReport.jsx'
import { Flow } from '../../components/worldseries/Flow.jsx'
import { GroupJump, Group } from '../../components/worldseries/GroupJump.jsx'
import { Bullpen } from '../../components/worldseries/cards/Bullpen.jsx'
import { HomeRoad } from '../../components/worldseries/cards/HomeRoad.jsx'
import { HotBats } from '../../components/worldseries/cards/HotBats.jsx'
import { Tape } from '../../components/worldseries/cards/Tape.jsx'
import { FilmRoom } from '../../components/worldseries/cards/scouting/FilmRoom.jsx'

// No LCS names: a finished Series has games, so the Reel's "Road here" chips never draw.
const NO_LCS = () => ''

// The finished World Series page's jump-bar groups (layout C, as on LiveSeriesPage): Series, Scout,
// Compare, Rosters. No Now group and no Hero: a finished Series has no next game. `view` is
// useWorldSeriesView's result for the history mode; `cutoff` is the day after the last game, so
// every read ends on the Series' last day. `parts` are the page's own elements (false = no data).
export function FinishedGroups({ groups, parts, view, mode, cutoff, meetings, noteClub, scoutShown, onScout }) {
  const has = (key) => groups.some((g) => g.key === key)
  const { data, series, clubIds } = view
  const [clubA, clubB] = clubIds
  return (
    <>
      <GroupJump groups={groups} />
      {has('series') && (
        <Group id="series" label="Series">
          {parts.flow}
          {parts.games}
          {data && <Reel series={series} slateDate={cutoff} clubGames={data.clubGames} lcsRound={NO_LCS} />}
          {parts.totals}
          {parts.leaders}
        </Group>
      )}
      {/* Always mounted: the report tells us (onShown) whether it has any card to draw. */}
      <div hidden={!scoutShown}>
        <Group id="scout" label="Scout" bare>
          <ScoutingReport
            clubIds={clubIds}
            sides={[clubA, clubB]}
            slateDate={cutoff}
            dayType={mode.dayType}
            gamePk={null}
            gameNumber={null}
            game={null}
            plateUmpire={null}
            series={null}
            omit={['nine-keys', 'film-room']}
            jumpBar={false}
            onShown={onScout}
          />
        </Group>
      </div>
      {has('compare') && (
        <Group id="compare" label="Compare">
          {data && (
            <Flow>
              <Tape awayId={clubA} homeId={clubB} data={data} slateDate={cutoff} />
              <HotBats clubIds={clubIds} splitsByClub={data.hotBats} />
              <HomeRoad clubIds={clubIds} clubGames={data.clubGames} slateDate={cutoff} />
            </Flow>
          )}
          {data && <Bullpen clubIds={clubIds} boxscoresByClub={data.boxscores} slateDate={cutoff} />}
          {parts.strip}
          {meetings?.length > 0 && <FilmRoom meetings={meetings} compact={false} clubId={noteClub} />}
          {parts.nine}
          {parts.abs}
        </Group>
      )}
      {has('rosters') && (
        <Group id="rosters" label="Rosters">
          {parts.rosters}
        </Group>
      )}
    </>
  )
}
