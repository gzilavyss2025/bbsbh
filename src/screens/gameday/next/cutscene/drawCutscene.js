// One frame of the big-play cutscene as a slot buffer (cutsceneArt.js): the "Night Game" direction.
// Patterned stands with a third of the fans on their feet, the outfield wall and the track, club
// chips falling, the batter waist-up at twice the scene's pixel, and the black band's type.
import { BAND, C, H, SPR, W, WAIST, chip, newBuf, put, rect, sprite, text, textW } from './cutsceneArt.js'
import { beatsAt } from './cutsceneTimeline.js'

const hash = (a, b, c) => (((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) >>> 0)
// The sprite's top-left at scale 2; the belt meets the band.
export const BATTER_X = 40
export const BATTER_Y = 38

// The stands: a brick of 6 x 8 fan cells, head over shoulders, two body tones by cell, the back three
// rows in shadow. After the cut a third of the lower fans stand (one pixel up), rotating with `wave`.
function stands(b, wave) {
  for (let y = 0; y < 56; y++) for (let x = 0; x < W; x++) {
    const row = Math.floor(y / 8), xs = x + (row & 1) * 3, xx = xs % 6, cell = Math.floor(xs / 6)
    const up = wave >= 0 && row >= 3 && (cell + row * 2 + wave) % 3 === 0 ? 1 : 0, yy = (y % 8) + up
    const back = row < 3, body = back ? (cell & 1 ? C.crowd1 : C.night) : (cell + row) & 1 ? C.crowd2 : C.crowd1
    let c = C.night
    if (yy >= 1 && yy <= 2 && xx >= 2 && xx <= 3) c = back ? C.crowd2 : (cell * 3 + row) % 4 === 0 ? C.crowd3 : C.crowd4
    else if (yy >= 3 && yy <= 6 && xx >= 1 && xx <= 4) c = body
    else if (yy >= 4 && yy <= 6 && (xx === 0 || xx === 5)) c = body
    if (!back && yy === 0 && xx === 0 && hash(cell, row, wave) % 9 === 2) c = C.chalk   // flashbulbs
    put(b, x, y, c)
  }
}

function field(b) {
  rect(b, 0, 56, W - 1, 57, C.wallLit)
  rect(b, 0, 58, W - 1, 79, C.wall)
  for (let x = 0; x < W; x += 32) rect(b, x, 58, x, 79, C.wallDeep)
  rect(b, 0, 80, W - 1, 80, C.wallDeep)
  rect(b, 0, 81, W - 1, 95, C.dirt)
  for (let y = 82; y < 96; y += 3) for (let x = (y * 5) % 7; x < W; x += 7) put(b, x, y, C.dirtLit)
}

// Club chips falling like confetti behind the batter, tumbling as they fall.
function chips(b, t, mono) {
  for (let k = 0; k < 18; k++) {
    const h = hash(k, 3, 9), spd = 34 + ((h >>> 8) % 22), raw = (t - 0.25) * spd - ((h >>> 12) % 70)
    if (raw < 0) continue
    const ph = (((h >>> 4) % 100) / 100) * 6.28, cx = Math.round((h % 23) * 9 + 4 + Math.sin(t * 1.7 + ph) * 6), cy = Math.round((raw % (BAND + 28)) - 14)
    const fw = Math.cos(t * (2 + (h % 5) * 0.6) + ph)
    if (cy - 7 < BAND) chip(b, cx, cy, Math.max(0.5, Math.abs(fw) * 6), fw < 0, mono)
  }
}

// Fireworks over the stands, five bursts on a loop.
function fireworks(b, t) {
  [[40, 18, 0.4], [150, 14, 0.75], [98, 10, 1.1], [62, 22, 1.5], [128, 20, 1.85]].forEach(([fx, fy, t0], k) => {
    const age = ((t - t0) % 1.9 + 1.9) % 1.9
    if (t < t0 || age > 0.8) return
    const r = Math.min(16, age * 46), col = age > 0.55 ? C.jerseyShade : k & 1 ? C.jerseyLight : C.chalk
    for (let a = 0; a < 12; a++) {
      const an = (a * Math.PI) / 6 + k
      put(b, Math.round(fx + Math.cos(an) * r), Math.round(fy + Math.sin(an) * r * 0.8), col)
      if (age < 0.4) put(b, Math.round(fx + Math.cos(an) * r * 0.6), Math.round(fy + Math.sin(an) * r * 0.5), C.trim)
    }
  })
}

// The bat flip: a two-tone stick spinning up and away to the left, drawn as thick segments.
function batFlip(b, tb) {
  if (tb <= 0 || tb >= 1.7) return
  const bx = 70 - tb * 34, by = 88 - (tb * 120 - tb * tb * 55), a = tb * 13, cx = Math.cos(a), sy = Math.sin(a)
  const seg = (u0, u1, r, c) => { for (let u = u0; u <= u1; u += 0.5) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) put(b, Math.round(bx + cx * u + i), Math.round(by + sy * u + j), c) }
  seg(-14, 2, 1, C.batShade); seg(2, 17, 2, C.batShade); seg(-14, 2, 0, C.bat); seg(3, 16, 1, C.bat)
}

// `o`: { variant: 'hr' | 'slam' | 'rbi', headline, name, detail, mono }. Text is caps-only in the font.
export function drawCutscene(t, o) {
  const b = newBuf(), head = String(o.headline || '').toUpperCase(), name = String(o.name || '').toUpperCase(), detail = String(o.detail || '').toUpperCase()
  const k = beatsAt(t, o.variant, head.length)
  if (k.white) { b.px.fill(C.chalk); return b }
  stands(b, k.wave)
  field(b)
  if (k.fireworks) fireworks(b, t)
  if (k.live) chips(b, t, o.mono)
  batFlip(b, k.batFlip)
  sprite(b, SPR[k.pose], BATTER_X + k.slide, BATTER_Y, 2, 0, WAIST)
  // The band: the typed letters, the newest one popped 2 px high in the light club colour.
  rect(b, 0, BAND, W - 1, H - 1, C.outline)
  const hx = Math.round((W - textW(head, 2)) / 2), typed = head.slice(0, k.typed), base = k.typed < head.length ? typed.slice(0, -1) : typed
  text(b, base, hx, 102, 2, k.flashing ? C.jerseyLight : C.chalk, C.jerseyLight)
  if (k.typed > 0 && k.typed < head.length) text(b, typed.slice(-1), hx + textW(base, 2) + 2, 100, 2, C.jerseyLight)
  if (k.name) text(b, name, Math.round((W - textW(name, 1)) / 2), 122, 1, C.chalk)
  if (k.detail) text(b, detail, Math.round((W - textW(detail, 1)) / 2), 133, 1, C.trim)
  return b
}
