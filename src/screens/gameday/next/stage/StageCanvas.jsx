import { useEffect, useRef, useState } from 'react'
import '../../../../styles/gameday-next/stage.css'
import { motionIsReduced } from '../../../../hooks/preferences/motionIsReduced.js'
import { drawStage, stageScale } from './drawStage.js'
import { stateAt } from './play.js'
import { spriteHitArea } from './hitArea.js'
import { SpriteTargets } from './SpriteTargets.jsx'
import { spriteTargets } from './actors.js'
import { S, TOKENS } from './pixels.js'
import { preparePlayers, paintPlayers } from './art/players.js'

// Gameday's stage: a low-resolution buffer (about 480 px wide) scaled up by a whole number, so every
// pixel stays square. `play` is stagePlay()'s output, built only from a REVEALED play (ADR-0001);
// without a `play` the canvas draws nothing. With `t` (seconds after the tap) it draws that one
// frame; without, it plays from `start` (a performance.now() time, so a re-render mid-play keeps its
// place) to the end of the play, or jumps to the settled result under reduced motion.
// The zone card is a separate overlay. The tap rule and the mount are GamedayStage.js and tapRule.js.

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

export function StageCanvas({ play, t, start, actors, teamId, label = 'The play on the field' }) {
  const box = useRef(null)
  const cv = useRef(null)
  const targets = useRef(new Map())
  const [size, setSize] = useState(null)
  const [prepared, setPrepared] = useState(null)
  const art = prepared && prepared.teamId === teamId ? prepared.art : null
  useEffect(() => {
    let cancelled = false
    preparePlayers(teamId).then((art) => { if (!cancelled) setPrepared({ teamId, art }) }).catch(() => {})
    return () => { cancelled = true }
  }, [teamId])
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
    // The paper diagram shares the page canvas; only its rules, bags and players are painted.
    pal[S.overheadNight] = 0
    const firstTarget = targets.current.values().next().value
    const hitSize = firstTarget ? parseFloat(getComputedStyle(firstTarget.firstElementChild).width) : 0
    const paint = (s) => {
      const fb = drawStage(stateAt(play, s), w, h, !art)
      for (let i = 0; i < fb.px.length; i++) out[i] = pal[fb.px[i]]
      g.putImageData(img, 0, 0)
      if (art) paintPlayers(g, fb.sprites, art, w, play.batter)
      for (const [key, el] of targets.current) {
        const sprite = fb.sprites.find((p) => p.key === key)
        el.hidden = !sprite
        if (sprite) {
          el.style.transform = 'translate(' + sprite.x * scale + 'px,' + sprite.y * scale + 'px) translate(-50%, -50%)'
          el.style.clipPath = 'polygon(' + spriteHitArea(sprite, fb.sprites, hitSize, scale).map(([x, y]) => x + 'px ' + y + 'px').join(',') + ')'
        }
      }
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
  }, [play, t, start, actors, art, w, h, scale])
  return (
    <div ref={box} className="gdstage">
      <SpriteTargets targets={spriteTargets(play, actors).filter((p) => p.key === 'batter' || p.key.startsWith('runner:'))} elements={targets} />
      <canvas ref={cv} className="gdstage__canvas" role="img" aria-label={label} width={w} height={h} style={{ width: w * scale, height: h * scale }} />
    </div>
  )
}
