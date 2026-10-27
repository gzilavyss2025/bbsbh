// The big-play cutscene's clock, pure: what is on screen `t` seconds after the cut, for a resolved
// scene (sceneOf) whose typed band line has `typedLen` letters. Two white frames, the batter slides in,
// the typed line types in and flashes, the other lines follow it by their own `after`; the pose cycle
// runs at the scene's beat. The same clock runs the drawing and the tests, and CutsceneCanvas ends
// the play at `end`.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export function beatsAt(t, scene, typedLen) {
  const q = scene.sequence, done = q.typeAt + q.perLetter * typedLen
  const ease = 1 - clamp((t - 0.15) / 0.3, 0, 1)
  const beat = scene.poses.length > 1 && t >= q.beatAt ? Math.floor(t * q.beatHz) % scene.poses.length : 0
  return {
    white: t < 0.07 || (t > 0.12 && t < 0.16),
    slide: Math.round(70 * ease * ease * ease),          // px the batter still has to come from the right
    live: t > q.enterAt,
    since: t - q.enterAt,                                // seconds since the crowd stood
    wave: t > q.enterAt ? Math.floor(t * 7) : -1,        // which third of the stands is on its feet
    typed: clamp(Math.floor((t - q.typeAt) / q.perLetter) + 1, 0, typedLen),
    done,
    flashing: t > done && t < done + q.flashFor && Math.floor((t - done) / 0.08) % 2 === 0,
    pose: scene.poses[beat],
    end: done + q.hold,
  }
}

// Whether a band line (BAND_LINES shape) is on screen at `t`, given the beats.
export function lineShown(line, t, k) {
  if (line.typed) return k.typed > 0
  const at = k.done + (line.after || 0)
  return t > at && !(line.blink && t < at + 0.08)
}
