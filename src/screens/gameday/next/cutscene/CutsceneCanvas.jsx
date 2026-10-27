import { useEffect, useRef, useState } from 'react'
import '../../../../styles/gameday-next/cutscene.css'
import { motionIsReduced } from '../../../../hooks/preferences/motionIsReduced.js'
import { H, KIT_SLOTS, TOKENS, W } from './cutsceneArt.js'
import { drawCutscene } from './drawCutscene.js'
import { beatsAt } from './cutsceneTimeline.js'

// The big-play cutscene, standalone: a 192 x 144 buffer scaled up by a whole number. Not mounted by
// Gameday yet; the mount decides when a play earns it and hands it the words. Props:
//   variant   'hr' | 'slam' | 'rbi' (the celebration)
//   headline  the play's name ("HOME RUN!"); name, detail the two lines under it ("382 FT")
//   kit       { helmet, trim, jersey } as CSS colours; the shades are derived. mono: one letter for the chip.
//   start     a performance.now() time the play began (a re-render mid-play keeps its place); `t` draws one frame
//   onDone    called once the play ends (or at once under reduced motion, which shows the last frame)

// Any CSS colour to packed little-endian RGBA through a 1 px canvas; `f` scales the channels.
function bytesOf(g, css, f = 1) {
  g.clearRect(0, 0, 1, 1)
  g.fillStyle = css || '#000'
  g.fillRect(0, 0, 1, 1)
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data, s = (v) => Math.max(0, Math.min(255, Math.round(v * f + (f > 1 ? (f - 1) * 48 : 0))))
  return ((255 << 24) | (s(b) << 16) | (s(gr) << 8) | s(r)) >>> 0
}
function paletteOf(el, kit) {
  const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true }), cs = getComputedStyle(el)
  const tok = TOKENS.map((n) => bytesOf(g, cs.getPropertyValue(`--stage-${n}`).trim()))
  const fill = { helmet: [kit.helmet, 1], 'helmet-shade': [kit.helmet, 0.55], trim: [kit.trim, 1], jersey: [kit.jersey, 1], 'jersey-shade': [kit.jersey, 0.55], 'jersey-light': [kit.jersey, 1.35] }
  return [...tok, ...KIT_SLOTS.map((n) => bytesOf(g, ...fill[n]))]
}

export function CutsceneCanvas({ variant = 'hr', headline = '', name = '', detail = '', mono = '', kit = {}, start, t, onDone, label = 'The big play' }) {
  const box = useRef(null)
  const cv = useRef(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setScale(Math.max(1, Math.floor(Math.min(e.contentRect.width / W, e.contentRect.height / H)))))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  const words = { variant, headline, name, detail, mono }
  const end = beatsAt(0, variant, headline.length).end
  useEffect(() => {
    const g = cv.current.getContext('2d'), pal = paletteOf(cv.current, kit), img = g.createImageData(W, H), out = new Uint32Array(img.data.buffer)
    const paint = (s) => {
      const fb = drawCutscene(s, words)
      for (let i = 0; i < fb.px.length; i++) out[i] = pal[fb.px[i]]
      g.putImageData(img, 0, 0)
    }
    if (t != null) { paint(t); return undefined }
    if (motionIsReduced()) { paint(end); onDone?.(); return undefined }
    const t0 = start ?? performance.now()
    let id = 0
    const tick = (now) => {
      const s = Math.min(Math.max(0, now - t0) / 1000, end)
      paint(s)
      if (s < end) id = requestAnimationFrame(tick)
      else onDone?.()
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [variant, headline, name, detail, mono, kit.helmet, kit.trim, kit.jersey, start, t]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={box} className="gdcut">
      <canvas ref={cv} className="gdcut__canvas" role="img" aria-label={`${label}: ${headline}`} width={W} height={H} style={{ width: W * scale, height: H * scale }} />
    </div>
  )
}
