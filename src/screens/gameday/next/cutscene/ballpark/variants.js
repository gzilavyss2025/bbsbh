// Authored rows in the generated study; source gutters are deliberately excluded.
// Equal playback cells are prepared once, preserving each row's scale and baseline.
const columns = [0, 257, 480, 688, 896, 1117, 1374]
const rows = [0, 239, 474, 707, 951, 1145]
const art = (row) => ({
  url: '/art/ballpark/celebrations.png', columns: 6, rows: 1,
  height: row === 2 ? 360 : 440, centerX: 0.64, top: row === 2 ? 52 : 0,
  sourceCells: columns.slice(0, -1).map((x, i) => [x + 4, rows[row] + 4, columns[i + 1] - x - 8, rows[row + 1] - rows[row] - 8]),
})
const track = (duration, times, beats, extra = {}) => ({
  duration, captionAt: times[2], accentAt: times[3], ...extra,
  frames: times.map((at, frame) => ({ at, frame, beat: beats[frame] })),
})

export const FIST_PUMP = {
  character: art(0),
  track: track(2.4, [0, 0.24, 0.44, 0.64, 0.94, 1.5],
    ['Anticipate', 'Gather', 'Rise', 'Pump', 'Hold', 'Settle'], { effect: 'sparkles' }),
}
export const CONFETTI_WIN = {
  character: art(1),
  track: track(3.6, [0, 0.28, 0.5, 0.76, 1.2],
    ['Anticipate', 'Gather', 'Rise', 'Celebrate', 'Hold'], { effect: 'confetti' }),
}
export const VICTORY_HOP = {
  character: art(2),
  track: track(2.8, [0, 0.22, 0.4, 0.58, 0.86, 1.12],
    ['Anticipate', 'Crouch', 'Launch', 'Hop', 'Land', 'Settle'], { effect: 'starburst', hop: { start: 0.4, apex: 0.58, end: 0.86, height: 32 } }),
}
export const HOME_RUN_SALUTE = {
  character: art(3),
  track: track(2.8, [0, 0.22, 0.44, 0.7, 1.02, 1.65],
    ['Anticipate', 'Gather', 'Lift bat', 'Salute', 'Hold', 'Settle'], { effect: 'fireworks' }),
}
export const PITCHER_PUMP = {
  character: art(4),
  track: track(1.9, [0, 0.18, 0.34, 0.48, 0.72, 1.08],
    ['Follow through', 'Rise', 'Gather', 'Pump', 'Release', 'Settle'], { effect: 'sparkles' }),
}
