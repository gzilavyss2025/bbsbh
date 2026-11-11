import '../../styles/worldseries/home.css'
import { fetchSeasonAward } from '../../api/awardsHistory.js'
import { TEAM_COLOR_PAIRS } from '../../lib/brandColors.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useSeriesLog } from '../../hooks/postseason/useSeriesLog.js'
import { mvpStatLine, MVP_PHOTOS, mvpPhotoUrl, mvpPhotoSrcSet } from '../../lib/postseason/mvpLine.js'
import { seriesMode } from '../../lib/postseason/worldseries/mode.js'
import { DecidedHero } from './Hero.jsx'

const photoUrl = mvpPhotoUrl
const photoSrcSet = mvpPhotoSrcSet

// The club's secondary outside, its primary in the middle (the Brewers: gold, navy, gold).
function stripeFor(teamId) {
  const pair = TEAM_COLOR_PAIRS[teamId]
  return pair ? [pair[1], pair[0]] : null
}

// The decided World Series on the home slate: the series page's MVP hero (LiveSeriesPage.jsx),
// read the same way. The Series photo draws at once, from a static id, so it needs no award fetch. If the
// award settles with no MVP (a 404, or offline) the hero falls back to the clubs' marks.
export function ChampionHero({ bracket }) {
  const ws = bracket.worldSeries
  const mode = seriesMode(ws)
  const season = bracket.season
  const { data: award, loading } = useAsync(() => fetchSeasonAward('WSMVP', season), [season])
  const { data: log } = useSeriesLog(ws?.games ?? [])
  if (!mode) return null
  const mvp = award?.recipients?.[0] ?? null
  const pick = MVP_PHOTOS[season]
  const ids = mode.series.slots.map((x) => x.club.id)
  // Keep the photo's side while the award loads and once it names an MVP we can place; else the marks.
  const photoClub = pick && ids.includes(pick.club) && (loading || ids.includes(mvp?.teamId)) ? pick.club : null
  return (
    <div className="ww-champhero">
      <DecidedHero mode={mode} mvp={mvp} stats={mvp ? mvpStatLine(log?.stats?.lines, mvp.playerId) : []} washBehind photo={photoClub ? photoUrl(pick.id) : null} photoSrcSet={photoClub ? photoSrcSet(pick.id) : undefined} photoTeamId={photoClub} stripe={stripeFor(photoClub ?? mvp?.teamId)} markHeight={64} scheduleTitle="An October to remember" />
    </div>
  )
}
