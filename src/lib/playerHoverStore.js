// The global player hover card's trigger state — WHO is being pointed at and
// WHERE, shared by every PlayerLink on the page and read by the one
// <PlayerHoverCard> instance that actually renders it.
//
// An external store, not React state or Context, for the same reason
// SyncStatusProvider is one (components/sync/SyncStatusProvider.jsx): a page
// can carry dozens of PlayerLinks, and putting this in a Context whose value
// changes on every hover would re-render every single one of them on every
// mouse pass. Here, writing (scheduleHoverShow/scheduleHoverHide) is a
// plain function call with a permanently stable identity — no subscription,
// no re-render — and only the one component that reads it (via
// useSyncExternalStore) ever re-renders.
//
// The show/hide calls are debounced through one shared timer rather than
// firing immediately, so a fast mouse pass over a dense list of names (a
// leaderboard, a box score) doesn't fire a request per name it glides over.

const SHOW_DELAY_MS = 150
const HIDE_DELAY_MS = 150

let state = { id: null, name: null, rect: null }
let timer = null
const listeners = new Set()

function commit(next) {
  state = next
  for (const listener of listeners) listener()
}

export function subscribeHover(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getHoverSnapshot() {
  return state
}

// `rect` is the trigger's own getBoundingClientRect() at hover/focus time —
// the card positions itself off it once, and closes on scroll rather than
// tracking it live (see PlayerHoverCard.jsx). `immediate` skips the
// hover-intent delay for a keyboard focus, which shouldn't feel laggy the
// way a mouse pass-over would.
export function scheduleHoverShow(id, name, rect, { immediate = false } = {}) {
  clearTimeout(timer)
  if (immediate) {
    commit({ id, name, rect })
    return
  }
  timer = setTimeout(() => commit({ id, name, rect }), SHOW_DELAY_MS)
}

// Only clears state that still belongs to `id` — a leave event queued from a
// trigger the pointer already left for a DIFFERENT one (fast mouse travel
// between two adjacent names) must not clobber the newer hover.
export function scheduleHoverHide(id) {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (state.id === id) commit({ id: null, name: null, rect: null })
  }, HIDE_DELAY_MS)
}

// Cancels a pending hide — the card's own onMouseEnter calls this, so moving
// the pointer off the trigger and onto the card itself doesn't close it
// mid-hover.
export function cancelHoverSchedule() {
  clearTimeout(timer)
}

// Closes immediately, no grace period — Escape, an outside click/tap, or a
// scroll (the card is position: fixed off a captured rect, so it stops
// following its trigger the moment the page moves).
export function hideHoverNow() {
  clearTimeout(timer)
  if (state.id !== null) commit({ id: null, name: null, rect: null })
}
