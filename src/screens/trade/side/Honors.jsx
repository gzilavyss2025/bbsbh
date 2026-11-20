import { useAsync } from '../../../hooks/useAsync.js'
import { loadStoryData } from '../../../api/trade/storyData.js'
import { HONORS, honorsOf, allStarSeasons } from '../story/honors.js'

// A player's major awards and All-Star teams, one stamp each, under his figures
// in the trade sheet: "2026 NL Cy Young", "All-Star 2025, 2026". The same two
// stored files the trade story reads (loadStoryData), so usually already in memory.
const SHORT = { 'Cy Young Award': 'Cy Young', 'Rookie of the Year Award': 'Rookie of the Year', 'Reliever of the Year Award': 'Reliever of the Year' }

export function Honors({ playerId }) {
  const data = useAsync(() => loadStoryData().catch(() => null), [])
  if (!data.data) return null
  const honors = honorsOf(playerId, data.data.awards)
  const stars = allStarSeasons(playerId, data.data.allStars)
  if (!honors.length && !stars.length) return null
  const words = (key) => {
    const h = HONORS.find((x) => x.key === key)
    return SHORT[h.words] ?? h.words
  }
  const major = (key) => Boolean(HONORS.find((x) => x.key === key)?.major)
  // A major award is an ink stamp (year over award); a team honor a highlighter chip.
  return (
    <ul className="playersheet__honors" aria-label="Awards">
      {honors.map((h) => (
        <li key={`${h.key}-${h.season}`} className={major(h.key) ? 'playersheet__honor playersheet__honor--major' : 'playersheet__honor'}>
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
    </ul>
  )
}
