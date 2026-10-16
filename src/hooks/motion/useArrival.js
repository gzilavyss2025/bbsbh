import { useBecameTrue } from './useBecameTrue.js'

// THE ARRIVAL'S CLASS LIST (ADR-0113, slice 3; docs/motion.md). A notification card starts as
// the plain yellow card. `open` is "its extra data is here". The card wears:
//   arrival        always; the arrival's resting looks hang off it
//   is-in          while `open`: the card is drawn arrived (band, sections open)
//   arrival--play  only for the render in which `open` went false -> true with the card
//                  already mounted, and while it stays true: the one-shot gate
//                  (useBecameTrue). Every transition hangs off this class.
// A card that mounts with its data in hand (the repeat, which reads the kept answer; a return
// to a half) gets `arrival is-in` and no `arrival--play`: it draws the final state, still.
// Timing depends on the fetch alone, never on the game (ADR-0046).
export function useArrival(open) {
  const play = useBecameTrue(open)
  return `arrival${open ? ' is-in' : ''}${play ? ' arrival--play' : ''}`
}
