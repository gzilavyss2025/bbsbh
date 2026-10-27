import { Reel } from '../../components/worldseries/Reel.jsx'
import { useMemo } from 'react'
import { loadPlatoon } from '../../api/scout/seriesFit.js'
import { useAsync } from '../../hooks/useAsync.js'
import { platoonModel } from '../../lib/postseason/worldseries/scouting/platoon.js'
import { Flow } from '../../components/worldseries/Flow.jsx'
import { GroupJump, Group } from '../../components/worldseries/GroupJump.jsx'
import { Bullpen } from '../../components/worldseries/cards/Bullpen.jsx'
import { HomeRoad } from '../../components/worldseries/cards/HomeRoad.jsx'
import { HotBats } from '../../components/worldseries/cards/HotBats.jsx'
import { Tape } from '../../components/worldseries/cards/Tape.jsx'
import { FilmRoom } from '../../components/worldseries/cards/scouting/FilmRoom.jsx'
import { Platoon } from '../../components/worldseries/cards/scouting/Platoon.jsx'

// No LCS names: a finished Series has games, so the Reel's "Road here" chips never draw.
const NO_LCS = () => ''

// Platoon in Compare: each club's regular-season lineup OPS against each hand. No game, so no hand is
// tinted as the one a club faces. Nothing when the read fails or comes back empty.
function ComparePlatoon({ clubIds, sides, season }) {
  const { data } = useAsync(() => loadPlatoon({ clubIds, season }), [clubIds[0], clubIds[1], season])
  const blocks = useMemo(() => platoonModel(data, { clubA: sides[0], clubB: sides[1], game: null, gameNumber: null }), [data, sides[0], sides[1]])
  return blocks ? <Platoon blocks={blocks} /> : null
}

// The finished World Series page's jump-bar groups (layout C, as on LiveSeriesPage): Series,
// Compare, Rosters. No Scout group: nothing is ahead, and Platoon, its one card that still reads, sits
// in Compare. No Now group and no Hero: a finished Series has no next game. `view` is
// useWorldSeriesView's result for the history mode; `cutoff` is the day after the last game, so
// every read ends on the Series' last day. `parts` are the page's own elements (false = no data).
export function FinishedGroups({ groups, parts, view, cutoff, meetings, noteClub }) {
  const has = (key) => groups.some((g) => g.key === key)
  const { data, series, clubIds } = view
  const [clubA, clubB] = clubIds
  return (
    <>
      <GroupJump groups={groups} />
      {has('series') && (
        <Group id="series" label="Series" bare>
          {parts.flow}
          {parts.games}
          {data && <Reel series={series} slateDate={cutoff} clubGames={data.clubGames} lcsRound={NO_LCS} labelAs="h3" />}
          {/* Totals beside the batting and pitching leaders from 740px (series-live.css). */}
          <div className="psseries__totalspair">
            {parts.totals}
            {parts.leaders}
          </div>
        </Group>
      )}
      {has('compare') && (
        <Group id="compare" label="Compare">
          {data && (
            <Flow>
              <Tape awayId={clubA} homeId={clubB} data={data} slateDate={cutoff} labelAs="h3" />
              <HotBats clubIds={clubIds} splitsByClub={data.hotBats} labelAs="h3" />
              <HomeRoad clubIds={clubIds} clubGames={data.clubGames} slateDate={cutoff} labelAs="h3" />
              <ComparePlatoon clubIds={clubIds} sides={[clubA, clubB]} season={Number(cutoff.slice(0, 4))} />
            </Flow>
          )}
          {data && <Bullpen clubIds={clubIds} boxscoresByClub={data.boxscores} slateDate={cutoff} labelAs="h3" />}
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
