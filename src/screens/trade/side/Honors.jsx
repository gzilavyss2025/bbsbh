import { useAsync } from '../../../hooks/useAsync.js'
import { loadStoryData } from '../../../api/trade/storyData.js'
import { fetchProspectRankHistory } from '../../../api/player/prospectRankHistory.js'
import { HONORS, honorsOf, allStarSeasons } from '../story/honors.js'

// A player's major awards, All-Star teams and (once he is a big leaguer) his
// whether he was ever a top 100 prospect, one stamp each, under his figures
// in the trade sheet: "2026 NL Cy Young", "All-Star 2025, 2026". The same two
// stored files the trade story reads (loadStoryData), so usually already in memory.
const SHORT = { 'Cy Young Award': 'Cy Young', 'Rookie of the Year Award': 'Rookie of the Year', 'Reliever of the Year Award': 'Reliever of the Year' }

// Whether he ever made a top-prospect list: a yes/no stamp, not a rank or a year.
const wasRanked = (history, playerId) => Boolean(history?.players?.[playerId]?.length)

// `debuted`: a big leaguer, whose old prospect ranking now reads as an honor
// (a prospect still ranked wears his stamp instead).
export function Honors({ playerId, debuted = false }) {
  const data = useAsync(() => Promise.all([loadStoryData().catch(() => null), debuted ? fetchProspectRankHistory().catch(() => null) : null]), [debuted])
  if (!data.data?.[0]) return null
  const honors = honorsOf(playerId, data.data[0].awards)
  const stars = allStarSeasons(playerId, data.data[0].allStars)
  const former = debuted && wasRanked(data.data[1], playerId)
  if (!honors.length && !stars.length && !former) return null
  const words = (key) => {
    const h = HONORS.find((x) => x.key === key)
    return SHORT[h.words] ?? h.words
  }
  const major = (key) => Boolean(HONORS.find((x) => x.key === key)?.major)
  return (
    <ul className="playersheet__honors" aria-label="Awards">
      {honors.map((h) => (
        <li key={`${h.key}-${h.season}`} className="playersheet__honor">
          <span className="playersheet__honoryr">{h.season}</span>
          <span>{major(h.key) && h.league ? `${h.league} ` : ''}{words(h.key)}</span>
        </li>
      ))}
      {stars.length > 0 && (
        <li className="playersheet__honor">
          <span className="playersheet__honoryr">{stars.length > 1 ? `${stars.length}×` : stars[0]}</span>
          <span>All-Star{stars.length > 1 ? ` (${[...stars].sort((x, y) => x - y).join(', ')})` : ''}</span>
        </li>
      )}
      {former && <li className="playersheet__honor">Former top 100 prospect</li>}
    </ul>
  )
}
