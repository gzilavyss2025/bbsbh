// The leader board's fade-in plays for one thing only: the reader tapping a scope button
// (MLB, AL, NL, AAA, AA, A+, A) on /leaders. The tap arms this flag; the board spends it on
// its first render. A cold load, a Back, a poll and a force-reveal never arm it, so none of
// them play it. A module flag rather than state because the tap and the board are separate
// mounts: the page shows its loader between the two.
// ponytail: a tap that never reaches a board (the reader leaves first) leaves the flag armed
// for the next board to mount; spend it on the next mount anywhere, not worth a timer.
let armed = false

export const armBoardIn = () => {
  armed = true
}

// True once per arm: reads the flag and clears it.
export function takeBoardIn() {
  const was = armed
  armed = false
  return was
}
