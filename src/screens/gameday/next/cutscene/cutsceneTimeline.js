// The big-play cutscene's clock, pure: what is on screen `t` seconds after the cut. Two white
// frames, the batter slides in, the headline types in letter by letter and flashes, then the name
// line, then the detail line. `variant` picks the celebration: 'hr' (bat flip, fist pump), 'slam'
// (both fists, fireworks), 'rbi' (a point to the dugout). The same clock runs the drawing and the
// tests, and CutsceneCanvas ends the play at `end`.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export const TYPE_AT = 0.45       // the first letter
export const PER_LETTER = 0.05
export const ENTER_AT = 0.25      // the crowd, chips and the bat flip start
export const PUMP_AT = 0.5        // the pump's first down-beat
export const PUMP_HZ = 3.3

export function beatsAt(t, variant, headlineLen) {
  const done = TYPE_AT + PER_LETTER * headlineLen
  const ease = 1 - clamp((t - 0.15) / 0.3, 0, 1)
  const beat = t >= PUMP_AT && Math.floor(t * PUMP_HZ) % 2 === 1
  const pose = variant === 'rbi' ? (beat ? 'point2' : 'point') : beat ? 'pump' : 'up'
  return {
    white: t < 0.07 || (t > 0.12 && t < 0.16),
    slide: Math.round(70 * ease * ease * ease),        // px the batter still has to come from the right
    live: t > ENTER_AT,
    wave: t > ENTER_AT ? Math.floor(t * 7) : -1,       // which third of the stands is on its feet
    typed: clamp(Math.floor((t - TYPE_AT) / PER_LETTER) + 1, 0, headlineLen),
    done,
    flashing: t > done && t < done + 0.5 && Math.floor((t - done) / 0.08) % 2 === 0,
    name: t > done + 0.25 && !(t < done + 0.33),      // a one-blink entrance
    detail: t > done + 0.45,
    pose,
    batFlip: variant === 'hr' ? t - ENTER_AT : -1,     // seconds into the flip, or none
    fireworks: variant === 'slam',
    end: done + 1.6,
  }
}
