import { useAsync } from '../../hooks/useAsync.js'
import { fetchNotable, featsForGame } from '../../api/notable/notable.js'

// The feat label: "No-hitter: Don Larsen", "Cycle: Byron Buxton", "Triple play: Los
// Angeles Angels". A feat names the result (ADR-0101), so this mounts ONLY from inside
// the box score's SealBox reveal render (BoxScore.jsx, ADR-0002), and the fetch below
// runs only once that has happened. It rides the reveal that exists and writes
// nothing. Renders nothing for a game with no feat or a failed load. No score: the
// sheet beside it already shows that.
export function FeatLabel({ gamePk }) {
  const { data } = useAsync(fetchNotable, [])
  const lines = featsForGame(data, gamePk)
  if (!lines.length) return null
  return (
    <p className="bs__feats">
      {lines.map((line, i) => <mark key={i}>{line}</mark>)}
    </p>
  )
}
