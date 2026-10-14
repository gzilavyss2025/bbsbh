import { easeOutQuart } from '../../../../../lib/motion/curves.js'

// The Arsenal card's timeline (#2073, board ArsenalReveal.dc.html): every beat of the side view, the mix bar
// and the menu, as a pure function of t, the ms since the card started to play. Pure; no clock, no DOM.
// The board's numbers, kept as it has them: a 760ms build-up, then every pitch leaves the one release point
// at the same moment and flies at 1/S of real speed, then a 760ms hold after the last landing.

export const LEAD = 760 // ms before the release (the board's T0)
export const TAIL = 760 // ms held after the last landing

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
// The board's `eo`: an ease-out quart that holds at 0 before its start and at 1 after its end.
export const eo = (x) => easeOutQuart(clamp(x))

// The timeline's length in ms. `pitches` are { code, ft, rpm }; ft (s) is null for a pitch with no path.
export function totalMs(pitches, S = 3) {
  const longest = Math.max(0, ...pitches.filter((p) => p.ft != null).map((p) => p.ft * 1000 * S))
  return Math.round(LEAD + longest + TAIL)
}

// A figure counting up to v as e goes 0 -> 1, with v's own decimals, or d.
export function countText(v, e, d = (String(v).split('.')[1] ?? '').length) {
  return (v * clamp(e)).toFixed(d)
}

// Every beat at t. `solo` is the picked code (only when that pitch has a path): the others are ghosts,
// drawn whole and faint, with no ball. Each pitch's index in `pitches` sets its menu row's stagger.
export function beatsAt(t, pitches, { S = 3, solo = null } = {}) {
  const rel = t - LEAD
  const roll = eo((t - 100) / 900)
  const ringE = eo(rel / 380)
  return {
    roll, // the mix bar's revealed share, 0 -> 1
    rollEdge: roll > 0 && roll < 1, // the moving shadow edge shows while the bar rolls
    ring: { r: 3 + 13 * ringE, o: rel > 0 && rel < 380 ? 0.8 * (1 - ringE) : 0 },
    ticks: [0, 1, 2, 3, 4, 5].map((k) => ({ draw: eo((t - (120 + k * 40)) / 300), label: eo((t - (260 + k * 40)) / 400) })),
    pitches: pitches.map((p, i) => {
      const ghost = solo != null && solo !== p.code
      const flies = p.ft != null
      const land = flies ? LEAD + p.ft * 1000 * S : Infinity
      const u = ghost ? 1 : flies ? clamp(rel / (p.ft * 1000 * S)) : 0
      const landed = !ghost && t >= land
      const since = t - land
      const born = eo((t - (LEAD - 260)) / 260)
      const gone = eo(since / 140)
      return {
        code: p.code,
        ghost,
        u, // the share of the flight drawn: the ball sits at u * T seconds
        landed,
        trail: ghost ? 0.22 * eo((t - 300) / 400) : u <= 0 ? 0 : 1 - 0.55 * eo(since / 500),
        ball: { o: ghost ? 0 : born * (1 - gone), k: 0.85 + 0.15 * born, spin: p.rpm ? (-u * 360 * p.rpm) / 900 : 0 },
        ripple: { r: 4 + 10 * eo(since / 380), o: landed && since < 380 ? 0.6 * (1 - eo(since / 380)) : 0 },
        mark: { o: ghost ? 0.3 * eo((t - 600) / 300) : landed ? Math.min(1, since / 70) : 0, k: landed ? 1 + 0.7 * (1 - eo(since / 260)) : 1 },
        flash: landed ? 0.5 * (1 - eo(since / 420)) : 0,
        row: { e: eo((t - (140 + i * 80)) / 520), count: eo((t - (240 + i * 80)) / 700), dim: ghost ? 0.45 : 1 },
        sweep: { x: landed ? eo(since / 260) : 0, o: landed ? 1 - eo((since - 260) / 700) : 0 },
        glyph: landed ? 1 + 0.45 * (1 - eo(since / 320)) : 1,
      }
    }),
  }
}
