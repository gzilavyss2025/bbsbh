import { useEffect, useRef } from 'react'
import { batterPalette } from './batterPalette.js'
import { prepareBatter } from './batterArt.js'

// Static art only. No pitch or swing animation; a new club never reuses a stale async palette.
export function BatterSprite({ side, teamId, colors }) {
  const canvas = useRef(null)
  const { equipment, jersey, trim, pants } = batterPalette(teamId, colors)
  useEffect(() => {
    let cancelled = false
    const el = canvas.current, g = el.getContext('2d')
    g.clearRect(0, 0, el.width, el.height)
    el.style.backgroundImage = ''; delete el.dataset.ready
    prepareBatter({ equipment, jersey, trim, pants }).then((atlas) => {
      if (cancelled) return
      g.imageSmoothingEnabled = false
      const w = atlas.width / 2
      g.drawImage(atlas, side === 'L' ? w : 0, 0, w, atlas.height, 0, 0, el.width, el.height)
      el.style.backgroundImage = 'none'
      el.dataset.ready = 'true'
    }).catch(() => {}) // Decorative decode failure retains the uncolored source and readable zones.
    return () => { cancelled = true }
  }, [side, equipment, jersey, trim, pants])
  return <canvas ref={canvas} className="gdzonemap__sprite" width="384" height="512" aria-hidden="true" />
}
