// The leader board's fade-in plays for one thing only: the reader tapping a scope button
// (MLB, AL, NL, AAA, AA, A+, A) on /leaders. The tap arms this flag; the board spends it on
// its first render. A cold load, a Back, a poll and a force-reveal never arm it, so none of
// them play it. A module flag rather than state because the tap and the board are separate
// mounts: the page shows its loader between the two.
// A tap that ends with no board (an empty scope, a load error) disarms it: LeadersPage calls
// disarmBoardIn once it settles. ponytail: a reader who leaves mid-load leaves it armed for the
// next board to mount; not worth a timer.
let armed = false

export const armBoardIn = () => {
  armed = true
}

export const disarmBoardIn = () => {
  armed = false
}

// True once per arm: reads the flag and clears it.
export function takeBoardIn() {
  const was = armed
  armed = false
  return was
}
