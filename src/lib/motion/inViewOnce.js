// The one-shot rule for an entrance on the player page (#2073), as pure logic.
// An entrance (a rise, a bar grow, a draw) plays the first time its block comes
// into view in this page visit. It does not play again on a re-render, a poll, a
// data refresh, or Back inside the app in the same tab. It plays again after a
// full page load, because that is a new bundle and a new Set.
//
// hooks/scroll/useInViewOnce.js is the React half. The Set is here, in a plain
// module, so a node test can cover it with no DOM.

const seen = new Set()

// The key for one block: the player, then the slot on that player's page.
export const viewKey = (playerId, slotKey) => `${playerId}:${slotKey}`

export const hasSeen = (key) => seen.has(key)

// Records a block as seen. True only the first time, so a caller can tell a
// first sighting from a repeat.
export function markSeen(key) {
  if (seen.has(key)) return false
  seen.add(key)
  return true
}

// The phase a block starts in.
//   rest  no entrance: already seen, reduced motion, or no IntersectionObserver.
//   wait  the entrance will play when the block comes into view; hold it hidden.
// 'play' is never a first phase: only the observer moves a block to it.
export function firstPhase(key, { canObserve, reduced }) {
  if (!canObserve || reduced || seen.has(key)) return 'rest'
  return 'wait'
}

// The class for a phase, for a block that wears the shared player rise
// (styles/motion/player-rise.css). A block with its own entrance maps the phase
// to its own class instead.
export function riseClass(phase) {
  if (phase === 'wait') return 'player-rise--wait'
  if (phase === 'play') return 'player-rise'
  return ''
}
