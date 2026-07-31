// The pure, React-free core of useGameData.js's `useEverActive` — pulled out
// so the "fetch once, stay cached, reset only on a new game" guarantee can be
// tested directly, without a DOM or a React renderer. The hook wires this
// into useState; the transition rule lives here.

// Given the previous sticky state, whether the consuming surface is active
// THIS render, and the identity (gamePk) the state is scoped to: returns the
// next state. `everActive` latches to true the first time `active` is true
// for a given `resetKey` and then never reverts to false on that same
// `resetKey` — so a fetch gated on it fires once and stays cached even after
// the user navigates away from its consuming surface. A `resetKey` change (a
// new game) drops the latch and re-seeds it from this render's own `active`,
// so a lineup-page cold open on a NEW game never inherits the previous game's
// "already visited" flag.
export function nextEverActiveState(state, active, resetKey) {
  if (state.resetKey !== resetKey) return { resetKey, everActive: active }
  if (active && !state.everActive) return { resetKey, everActive: true }
  return state
}
