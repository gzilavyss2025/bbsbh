// A finite, authored action, not an oscillating celebration loop. Times are seconds.
// Artwork, timing and framing are separate: later pitcher/fielder sequences can
// supply their own track and atlas without changing the player or stadium renderer.
export const HOME_RUN = {
  duration: 2.8,
  captionAt: 0.72,
  accentAt: 0.86,
  frames: [
    { at: 0, frame: 0, beat: 'Anticipate' },
    { at: 0.18, frame: 1, beat: 'Anticipate' },
    { at: 0.32, frame: 2, beat: 'Anticipate' },
    { at: 0.46, frame: 3, beat: 'Turn' },
    { at: 0.58, frame: 4, beat: 'Turn' },
    { at: 0.68, frame: 5, beat: 'Turn' },
    { at: 0.76, frame: 6, beat: 'Accent' },
    { at: 0.86, frame: 7, beat: 'Accent' },
    { at: 1.04, frame: 8, beat: 'Accent' },
    { at: 1.48, frame: 10, beat: 'Settle' },
    { at: 1.72, frame: 11, beat: 'Settle' },
  ],
}

export const STRIKEOUT = {
  duration: 1.9,
  captionAt: 0.5,
  accentAt: 0.44,
  frames: [
    { at: 0, frame: 0, beat: 'Follow through' },
    { at: 0.12, frame: 1, beat: 'Rise' },
    { at: 0.24, frame: 2, beat: 'Gather' },
    { at: 0.34, frame: 3, beat: 'Gather' },
    { at: 0.44, frame: 4, beat: 'Pump' },
    { at: 0.54, frame: 5, beat: 'Release' },
    { at: 0.66, frame: 6, beat: 'Release' },
    { at: 0.78, frame: 7, beat: 'Settle' },
    { at: 0.92, frame: 8, beat: 'Settle' },
    { at: 1.06, frame: 9, beat: 'Settle' },
    { at: 1.2, frame: 10, beat: 'Settle' },
    { at: 1.38, frame: 11, beat: 'Settle' },
  ],
}

export const DEFENSIVE_CATCH = {
  duration: 2.8,
  captionAt: 0.78,
  accentAt: 0.7,
  flight: { startAt: 0, catchAt: 0.7, from: [0.08, 0.02], to: [0.815, 0.1], arc: -0.025 },
  frames: [
    { at: 0, frame: 0, beat: 'Track' },
    { at: 0.12, frame: 1, beat: 'Track' },
    { at: 0.24, frame: 2, beat: 'Reach' },
    { at: 0.4, frame: 3, beat: 'Reach' },
    { at: 0.56, frame: 4, beat: 'Reach' },
    { at: 0.7, frame: 5, beat: 'Catch' },
    { at: 0.86, frame: 6, beat: 'Absorb' },
    { at: 1.04, frame: 7, beat: 'Secure' },
    { at: 1.25, frame: 8, beat: 'Recover' },
    { at: 1.48, frame: 9, beat: 'Acknowledge' },
    { at: 1.72, frame: 10, beat: 'Acknowledge' },
    { at: 1.98, frame: 11, beat: 'Settle' },
  ],
}

export const clampTime = (time, track = HOME_RUN) => Math.max(0, Math.min(track.duration, Number.isFinite(time) ? time : 0))

export function momentAt(time, track = HOME_RUN) {
  const t = clampTime(time, track)
  let index = 0
  while (index + 1 < track.frames.length && track.frames[index + 1].at <= t) index++
  const phase = track.frames[index]
  return { ...phase, index, t, ended: t >= track.duration, caption: t >= track.captionAt }
}

// Frame-step means the adjacent authored pose, not 1/60 s of an unchanged pose.
export function stepTime(time, direction, track = HOME_RUN) {
  const i = momentAt(time, track).index
  return track.frames[Math.max(0, Math.min(track.frames.length - 1, i + direction))].at
}

export function advanceTime(time, delta, rate = 1, track = HOME_RUN) {
  return clampTime(time + Math.max(0, delta) * Math.max(0, rate), track)
}
