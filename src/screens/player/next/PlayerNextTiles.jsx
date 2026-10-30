import { fetchRankMarks } from '../../../api/player/leagueRanks.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { StatTile } from '../../../components/ui/frame/StatTile.jsx'
import { useState } from 'react'
import { TileHistogram, histogramFor } from './top/TileHistogram.jsx'
import { rankFor, tileStampDelay } from './heroData.js'

// Every tile is plain; the one whose ruler is open turns ink (Gary, 2026-10-30). The caption is the tile's
// own ("680 PA", "20 GS"). A tile that opens a ruler carries neither caption nor league figure: both
// moved into the ruler's label (Gary, 2026-10-30).
function captionOf(t, group) {
  return histogramFor(group, t.k) ? undefined : t.caption || undefined
}

// One role's five tiles. A two-way player gets a labelled row per role.
export function PlayerNextTiles({ block, playerId, name, position, season, label }) {
  // The open tile, and whether its ruler is sliding back under the row. A close plays the slide in
  // reverse and unmounts on its end; with reduced motion there is no slide, so it unmounts at once.
  const [open, setOpen] = useState(null)
  const [closing, setClosing] = useState(false)
  const toggle = (k) => {
    if (open === k && !closing) {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) setOpen(null)
      else setClosing(true)
    } else {
      setOpen(k)
      setClosing(false)
    }
  }
  const marks = useAsync(() => fetchRankMarks(playerId, block.group, block.rankSplits, season), [playerId, block, season]).data
  return (
    <section className="pnext__tiles" aria-label={label}>
      {label && <h2 className="pnext__rowlabel">{label}</h2>}
      <div className="pnext__tilerow">
        {block.tiles.map((t, i) => {
          const tile = (
            <StatTile
              key={t.k}
              label={i === 0 ? <>{t.k}<span className="pnext__tileyr">{` · ${season}`}</span></> : t.k}
              value={t.v}
              caption={captionOf(t, block.group)}
              rank={rankFor(marks, t.k)}
              tone={open === t.k && !closing ? 'ink' : 'plain'}
              className="stattile--compact"
              stampIn
              style={{ '--stamp-delay': tileStampDelay(i) }}
            />
          )
          // A tile with a league pool opens its histogram under the row; tap again to close.
          return histogramFor(block.group, t.k) ? (
            <button key={t.k} type="button" className="pnext__tilebtn" aria-expanded={open === t.k && !closing} onClick={() => toggle(t.k)}>
              {tile}
            </button>
          ) : tile
        })}
      </div>
      {open && (
        <TileHistogram
          group={block.group}
          tile={block.tiles.find((t) => t.k === open)}
          season={season}
          name={name}
          position={position}
          closing={closing}
          onClosed={() => (setOpen(null), setClosing(false))}
        />
      )}
    </section>
  )
}
