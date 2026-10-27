// Extras: things a scene draws over the backdrop and behind the batter. Each is (b, t, k, o) with k
// from beatsAt and o the words. A scene lists them by name, or passes its own functions.
import { BAND, C, chip, put, rect, sprite } from './cutsceneArt.js'

const hash = (a, b, c) => (((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) >>> 0)

// Club chips falling like confetti, tumbling as they fall, from the moment the crowd stands.
function chips(b, t, k, o) {
  if (!k.live) return
  for (let n = 0; n < 18; n++) {
    const h = hash(n, 3, 9), spd = 34 + ((h >>> 8) % 22), raw = k.since * spd - ((h >>> 12) % 70)
    if (raw < 0) continue
    const ph = (((h >>> 4) % 100) / 100) * 6.28, cx = Math.round((h % 23) * 9 + 4 + Math.sin(t * 1.7 + ph) * 6), cy = Math.round((raw % (BAND + 28)) - 14)
    const fw = Math.cos(t * (2 + (h % 5) * 0.6) + ph)
    if (cy - 7 < BAND) chip(b, cx, cy, Math.max(0.5, Math.abs(fw) * 6), fw < 0, o.mono)
  }
}

// Fireworks over the stands, five bursts on a loop.
function fireworks(b, t) {
  [[40, 18, 0.4], [150, 14, 0.75], [98, 10, 1.1], [62, 22, 1.5], [128, 20, 1.85]].forEach(([fx, fy, t0], n) => {
    const age = ((t - t0) % 1.9 + 1.9) % 1.9
    if (t < t0 || age > 0.8) return
    const r = Math.min(16, age * 46), col = age > 0.55 ? C.jerseyShade : n & 1 ? C.jerseyLight : C.chalk
    for (let a = 0; a < 12; a++) {
      const an = (a * Math.PI) / 6 + n
      put(b, Math.round(fx + Math.cos(an) * r), Math.round(fy + Math.sin(an) * r * 0.8), col)
      if (age < 0.4) put(b, Math.round(fx + Math.cos(an) * r * 0.6), Math.round(fy + Math.sin(an) * r * 0.5), C.trim)
    }
  })
}

// The bat flip: a two-tone stick spinning up and away to the left over 1.7 s from the cut.
function batFlip(b, t, k) {
  const tb = k.since
  if (tb <= 0 || tb >= 1.7) return
  const bx = 70 - tb * 34, by = 88 - (tb * 120 - tb * tb * 55), a = tb * 13, cx = Math.cos(a), sy = Math.sin(a)
  const seg = (u0, u1, r, c) => { for (let u = u0; u <= u1; u += 0.5) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) put(b, Math.round(bx + cx * u + i), Math.round(by + sy * u + j), c) }
  seg(-14, 2, 1, C.batShade); seg(2, 17, 2, C.batShade); seg(-14, 2, 0, C.bat); seg(3, 16, 1, C.bat)
}

// The dropped bat lying on the track at the left, barrel end out.
const BAT = ['WWWWWWWWWWWWWWW', 'wwwwwwwwwwwwwww']
function droppedBat(b) {
  const x = 4, y = 88, k = 2
  sprite(b, BAT, x, y, k)
  rect(b, x, y - k, x + 4 * k - 1, y - 1, C.bat)
  rect(b, x + 13 * k, y - k, x + 15 * k - 1, y - 1, C.bat)
  rect(b, x + 13 * k, y + 2 * k, x + 15 * k - 1, y + 3 * k - 1, C.batShade)
}

export const EXTRAS = { chips, fireworks, batFlip, droppedBat }
