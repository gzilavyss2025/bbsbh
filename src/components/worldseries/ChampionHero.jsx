import '../../styles/worldseries/home.css'
import { fetchSeasonAward } from '../../api/awardsHistory.js'
import { TEAM_COLOR_PAIRS } from '../../lib/brandColors.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useSeriesLog } from '../../hooks/postseason/useSeriesLog.js'
import { mvpStatLine } from '../../lib/postseason/mvpLine.js'
import { seriesMode } from '../../lib/postseason/worldseries/mode.js'
import { DecidedHero } from './Hero.jsx'

// A Series photo of the MVP, picked by hand from the clincher's MLB highlights (an image id on
// img.mlbstatic.com). 2026: Contreras lifting the MVP trophy after Game 5.
const MVP_PHOTOS = { 2026: 'cz7beynol16rtuq2neot' }
const photoUrl = (id) => id && `https://img.mlbstatic.com/mlb-images/image/upload/w_900,h_900,f_jpg,c_fill,g_center/mlb/${id}.jpg`

// The club's secondary outside, its primary in the middle (the Brewers: gold, navy, gold).
function stripeFor(teamId) {
  const pair = TEAM_COLOR_PAIRS[teamId]
  return pair ? [pair[1], pair[0]] : null
}

// The decided World Series on the home slate: the series page's MVP hero (LiveSeriesPage.jsx),
// read the same way. Before MLB names the MVP (a 404) the hero keeps the clubs' marks.
export function ChampionHero({ bracket }) {
  const ws = bracket.worldSeries
  const mode = seriesMode(ws)
  const season = bracket.season
  const { data: award } = useAsync(() => fetchSeasonAward('WSMVP', season), [season])
  const { data: log } = useSeriesLog(ws?.games ?? [])
  if (!mode) return null
  const mvp = award?.recipients?.[0] ?? null
  return (
    <div className="ww-champhero">
      <DecidedHero mode={mode} mvp={mvp} stats={mvp ? mvpStatLine(log?.stats?.lines, mvp.playerId) : []} washBehind photo={photoUrl(MVP_PHOTOS[season])} stripe={stripeFor(mvp?.teamId)} markHeight={64} scheduleTitle="An October to remember" />
    </div>
  )
}
