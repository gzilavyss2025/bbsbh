// THE TAP RULE (#2573): the stage is playing or at rest. A tap while playing finishes the play (its
// end state) and is swallowed, so a double tap never reveals a play the reader has not seen; a tap
// at rest advances. Pure, so the suite pins it (test/gameday-stage-mount.test.js).
//
// The stage plays only on the reveal tap (#2568, "Spoiler-rule check"): never on a cold load, a
// return visit, a poll or a force-reveal. A reveal tap arms the stage; the engine reports the new
// last at-bat a render later, and only an armed change plays. Anything else that moves the last
// at-bat, or a new half, puts the stage back at rest. Under Motion: Reduced (read at the tap) the
// revealed play shows its end state with no animation.
//
// State: `seen` the last finished at-bat as of the cursor, `view` the half on screen, `armed` a
// reveal tap waiting for its play, `shown` the at-bat the stage draws (null: the rest frame),
// `playing` whether it animates. Indexes and flags only, never a play value.

export const rest = (seen, view) => ({ seen, view, armed: null, shown: null, playing: false })

// The advance tap. -> [state, advance?] Once the checkpoint is presented, the tap passes through
// and arms nothing. useGamedayStage intercepts the preceding ending-celebration dismissal.
export function tap(s, reveals, reduced, covered = false) {
  if (covered) return [{ ...s, armed: null, playing: false }, true]
  if (s.playing) return [{ ...s, playing: false }, false]
  return [{ ...s, armed: reveals ? { reduced } : null }, true]
}

// Keys are the last at-bat's index, or a sub-step's { count, sub, last } (steps/subStep.js stageKey).
const same = (a, b) => a === b || (a != null && b != null && typeof a === 'object' && a.count === b.count && a.sub === b.sub && a.last === b.last)

// Every render: the last at-bat and the half as of now.
export function saw(s, seen, view) {
  if (view !== s.view) return rest(seen, view)
  if (same(seen, s.seen)) return s
  if (s.armed && seen != null) return { seen, view, armed: null, shown: seen, playing: !s.armed.reduced }
  return rest(seen, view)
}

// A tap on a trail card: play that at-bat again. It is one the reader already revealed (the trail draws
// inside its seal), so no tap rule gates it. `run` counts replays, so a second tap on the same card restarts it.
// A reveal tap still waiting for its play stays armed: the revealed play takes over when it arrives.
export const replay = (s, idx, reduced) => ({ ...s, shown: idx, playing: !reduced, run: (s.run ?? 0) + 1 })

// The animation reached its end on its own.
export const ended = (s) => (s.playing ? { ...s, playing: false } : s)

// The tapped step settled without a new last at-bat (a stoppage, a placed runner): a later change
// that no tap made must not play.
export const disarm = (s) => (s.armed ? { ...s, armed: null } : s)
