import { useMemo, useState } from 'react'
import { fetchReelGames } from '../../api/postseason/worldSeriesHome.js'
import { useAsync } from '../../hooks/useAsync.js'
import { buildReel, reelFilterOptions, reelSources, roadClubs } from '../../lib/postseason/worldseries/reel.js'
import { HighlightSheet } from '../playbyplay/HighlightSheet.jsx'
import { Chips } from '../ui/control/Chips.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { ReelCard } from './ReelCard.jsx'

// THE REEL: "Series reel" from the day after Game 1, "Road here" before that.
// A horizontal snap rail of clips and photographer stills with a filter. Past
// games only (the sources never include a game dated on or after the slate
// date, and fetchReelGames drops one before any read). It draws nothing while
// loading, on failure, or with no items: never an empty frame.
export function Reel({ series, slateDate, clubGames, lcsRound }) {
  const [filter, setFilter] = useState('all')
  const [clip, setClip] = useState(null)
  const source = useMemo(
    () => reelSources({ seriesGames: series.games, roadClubList: roadClubs(series.slots, clubGames, lcsRound), slateDate }),
    [series, clubGames, lcsRound, slateDate],
  )
  const key = source.games.map((g) => g.gamePk).join(',')
  const loaded = useAsync(() => (key ? fetchReelGames(source.games, slateDate) : Promise.resolve([])), [key, slateDate])
  const cards = useMemo(() => buildReel(loaded.data ?? [], { slateDate }), [loaded.data, slateDate])
  if (cards.length === 0) return null

  const road = source.title === 'Road here'
  const options = reelFilterOptions(cards, road ? series.slots.map((s) => s.club.abbreviation) : null)
  const shown = filter === 'all' ? cards : cards.filter((c) => c.filter === filter)
  return (
    <Card frame="stamped" label={source.title} className="ww-reel">
      <Chips label="Filter the reel" options={options} value={filter} onChange={(v) => setFilter(v ?? 'all')} />
      <ul className="ww-reel__rail">
        {shown.map((c) => (
          <li key={`${c.kind}-${c.gamePk}-${c.kind === 'photo' ? c.photo.id : c.item.id}`} className="ww-reel__slot">
            <ReelCard card={c} onOpenClip={setClip} />
          </li>
        ))}
      </ul>
      {clip && <HighlightSheet item={clip} onClose={() => setClip(null)} />}
    </Card>
  )
}
