import { fetchRankMarks } from '../../../api/player/leagueRanks.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { StatTile } from '../../../components/ui/frame/StatTile.jsx'
import { DASH } from '../parts.jsx'
import { rankFor } from './heroData.js'

// The lead tile is ink, the second a tint, the rest plain (B-phone). The caption
// is the tile's own ("680 PA", "20 GS"), else the league figure, else "MLB calc"
// under a WAR that has a number.
function captionOf(t) {
  if (t.caption) return t.caption
  if (t.lg) return `Lg ${t.lg}`
  return t.k === 'WAR' && t.v !== DASH ? 'MLB calc' : undefined
}

// One role's five tiles. A two-way player gets a labelled row per role.
export function PlayerNextTiles({ block, playerId, season, label }) {
  const marks = useAsync(() => fetchRankMarks(playerId, block.group, block.rankSplits, season), [playerId, block, season]).data
  return (
    <section className="pnext__tiles" aria-label={label}>
      {label && <h2 className="pnext__rowlabel">{label}</h2>}
      <div className="pnext__tilerow">
        {block.tiles.map((t, i) => (
          <StatTile
            key={t.k}
            label={i === 0 ? `${t.k} · ${season}` : t.k}
            value={t.v}
            caption={captionOf(t)}
            rank={rankFor(marks, t.k)}
            tone={i === 0 ? 'ink' : i === 1 ? 'tint' : 'plain'}
            stampIn
            style={{ '--stamp-delay': `${60 + i * 40}ms` }}
          />
        ))}
      </div>
    </section>
  )
}
