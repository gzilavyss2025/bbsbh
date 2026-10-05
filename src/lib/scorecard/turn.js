// The lens's page turn as a pure step (#724, L7): what useLensMotion's
// `turn(fn)` and `onAnimationEnd` do, kept here so a test can walk it.
//
// State: `turning` ('out' | 'in' | null, the class on the page) and `pending`
// (the side switch, run at the end of the out beat). Each step also returns
// `run`: a switch the caller must run now, or null.
//
// LEAVING MID-TURN. If the reader leaves the lens during the out beat ([Sheet],
// or the phone turned on its side), the out class goes away before its
// animationend, so that event never comes. The Turn tap still asked for the
// other side: `leave` hands back the switch to run at once, with no motion,
// and keeps no stale copy of it.

export const TURN_IDLE = { turning: null, pending: null, run: null }

export function turnStep(state, event) {
  switch (event.type) {
    case 'start':
      return { turning: 'out', pending: event.fn, run: null }
    case 'end':
      if (event.name === 'sc-lens-turn-out' && state.pending) return { turning: 'in', pending: null, run: state.pending }
      if (event.name === 'sc-lens-turn-in') return TURN_IDLE
      return { ...state, run: null }
    case 'leave':
      return { turning: null, pending: null, run: state.pending }
    default:
      return { ...state, run: null }
  }
}
