// One frame of the big-play cutscene as a slot buffer (cutsceneArt.js): the scene's backdrop, its
// extras, the batter at twice the scene's pixel, and the band's lines.
import { BAND, C, H, SPR, W, newBuf, rect, sprite, text, textW } from './cutsceneArt.js'
import { BACKDROPS } from './cutsceneBackdrops.js'
import { EXTRAS } from './cutsceneExtras.js'
import { sceneOf } from './cutsceneScenes.js'
import { beatsAt, lineShown } from './cutsceneTimeline.js'

// `o`: { scene: a preset name or a spec (cutsceneScenes.js), headline, name, detail, mono }. The font is caps-only.
export function drawCutscene(t, o) {
  const scene = sceneOf(o.scene ?? o.variant)
  const words = { headline: o.headline, name: o.name, detail: o.detail }
  const wordOf = (s) => String(s || '').replace(/\$(headline|name|detail)/g, (_, w) => words[w] || '').toUpperCase()
  const lines = scene.lines.map((l) => ({ ...l, s: wordOf(l.text) }))
  const typedLine = lines.find((l) => l.typed)
  const k = beatsAt(t, scene, typedLine ? typedLine.s.length : 0)
  const b = newBuf()
  if (k.white) { b.px.fill(C.chalk); return b }
  const backdrop = typeof scene.backdrop === 'function' ? scene.backdrop : BACKDROPS[scene.backdrop] || BACKDROPS.night
  backdrop(b, k, t)
  for (const e of scene.extras) { const fn = typeof e === 'function' ? e : EXTRAS[e]; if (fn) fn(b, t, k, o) }
  const rows = { ...SPR, ...scene.sprites }[k.pose] || SPR.up
  sprite(b, rows, scene.at[0] + k.slide, scene.at[1], 2, 0, scene.rows, scene.facing === 'left')
  rect(b, 0, BAND, W - 1, H - 1, C.outline)
  for (const l of lines) {
    if (!lineShown(l, t, k)) continue
    const s = l.typed ? l.s.slice(0, k.typed) : l.s, full = l.typed ? l.s : s
    const x = l.align === 'left' ? 8 : l.align === 'right' ? W - 8 - textW(full, l.scale) : Math.round((W - textW(full, l.scale)) / 2)
    const colour = l.typed && k.flashing ? C.jerseyLight : C[l.colour] ?? C.chalk, shadow = l.shadow ? C[l.shadow] : undefined
    if (l.typed && k.typed < l.s.length) {
      // The newest letter pops: drawn 2 px high in the light club colour.
      const base = s.slice(0, -1)
      text(b, base, x, l.y, l.scale, colour, shadow)
      text(b, s.slice(-1), x + textW(base, l.scale) + l.scale, l.y - 2, l.scale, C.jerseyLight)
    } else text(b, s, x, l.y, l.scale, colour, shadow)
  }
  return b
}
