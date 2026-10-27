import { useEffect, useRef, useState } from 'react'
import '../../../../styles/gameday-next/stage.css'
import { motionIsReduced } from '../../../../hooks/preferences/motionIsReduced.js'
import { drawStage, stageScale, zoneBox } from './drawStage.js'
import { stateAt } from './play.js'
import { TOKENS } from './pixels.js'

// Gameday's stage: a low-resolution buffer (about 256 px wide) scaled up by a whole number, so every
// pixel stays square. `play` is stagePlay()'s output, built only from a REVEALED play (ADR-0001);
// without a `play` the canvas draws nothing. With `t` (seconds after the tap) it draws that one
// frame; without, it plays from `start` (a performance.now() time, so a re-render mid-play keeps its
// place) to the end of the play, or jumps to the end under reduced motion. `zones`
// tints the rest frame (drawStage). The tap rule and the mount are GamedayStage.js and tapRule.js.

// The --stage-* tokens as packed little-endian RGBA, in pixels.js's slot order. A 1 px canvas turns
// any CSS colour the token holds into bytes.
function paletteOf(el) {
  const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true }), cs = getComputedStyle(el)
  return TOKENS.map((n) => {
    g.clearRect(0, 0, 1, 1)
    g.fillStyle = cs.getPropertyValue(`--stage-${n}`).trim() || '#000'
    g.fillRect(0, 0, 1, 1)
    const [r, gr, b, a] = g.getImageData(0, 0, 1, 1).data
    return ((a << 24) | (b << 16) | (gr << 8) | r) >>> 0
  })
}

export function StageCanvas({ play, t, start, zones, onZone, label = 'The play on the field' }) {
  const box = useRef(null)
  const cv = useRef(null)
  const [size, setSize] = useState(null)
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ W: Math.floor(e.contentRect.width), H: Math.floor(e.contentRect.height) }))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  const scale = size ? stageScale(size.W) : 1
  const w = size ? Math.ceil(size.W / scale) : 0
  const h = size ? Math.ceil(size.H / scale) : 0
  useEffect(() => {
    if (!play || !w || !h) return undefined
    const g = cv.current.getContext('2d'), pal = paletteOf(cv.current), img = g.createImageData(w, h), out = new Uint32Array(img.data.buffer)
    const paint = (s) => {
      const fb = drawStage(stateAt(play, s), w, h, zones)
      for (let i = 0; i < fb.px.length; i++) out[i] = pal[fb.px[i]]
      g.putImageData(img, 0, 0)
    }
    if (t != null) { paint(t); return undefined }
    if (motionIsReduced()) { paint(play.end); return undefined }
    const t0 = start ?? performance.now()
    let id = 0
    const tick = (now) => {
      const s = Math.min(Math.max(0, now - t0) / 1000, play.end)
      paint(s)
      if (s < play.end) id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [play, t, start, zones, w, h])
  // A tap on the rest frame's strike zone toggles the zone map (`onZone`); the pointer shows where it lands.
  const inZone = (e) => {
    const r = e.currentTarget.getBoundingClientRect(), z = onZone && zoneBox(w, h), x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale
    return !!z && x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1
  }
  return (
    <div ref={box} className="gdstage">
      <canvas
        ref={cv} className="gdstage__canvas" role="img" aria-label={label} width={w} height={h} style={{ width: w * scale, height: h * scale }}
        onClick={(e) => { if (inZone(e)) onZone() }}
        onMouseMove={onZone ? (e) => { e.currentTarget.style.cursor = inZone(e) ? 'pointer' : '' } : undefined}
      />
    </div>
  )
}
