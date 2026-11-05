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
const MVP_PHOTOS = { 2026: { id: 'cz7beynol16rtuq2neot', club: 158 } } // club: the photo's side (Brewers), known before the award loads
const photoUrl = (id, w = 900) => id && `https://img.mlbstatic.com/mlb-images/image/upload/w_${w},h_${w},f_jpg,q_auto:good,c_fill,g_center/mlb/${id}.jpg`
// 450 for a 1x screen, 900 for 2x and up (the phone slab is about 360 CSS px wide).
const photoSrcSet = (id) => `${photoUrl(id, 450)} 450w, ${photoUrl(id)} 900w`

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
  // Keep the photo's side while the award loads and once it names an MVP; drop it on a settled miss.
  const photoClub = pick && (mvp || loading) ? pick.club : null
  return (
    <div className="ww-champhero">
      <DecidedHero mode={mode} mvp={mvp} stats={mvp ? mvpStatLine(log?.stats?.lines, mvp.playerId) : []} washBehind photo={photoClub ? photoUrl(pick.id) : null} photoSrcSet={photoClub ? photoSrcSet(pick.id) : undefined} photoTeamId={photoClub} stripe={stripeFor(photoClub ?? mvp?.teamId)} markHeight={64} scheduleTitle="An October to remember" />
    </div>
  )
}
