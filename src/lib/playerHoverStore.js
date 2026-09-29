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
//
// The show delay is also HOVER INTENT, which is why it is the longer of the
// two: a pointer travelling down a batting order to reach the name below
// crosses several on the way, and at 150ms each of them opened a card. A
// reader who WANTS one rests on the name; a reader in transit does not.
//
// usePlayerHoverCard at the foot is the trigger's side of this: the ref and
// the four handlers a trigger spreads to write here. It subscribes to
// nothing, so a trigger still never re-renders on a hover.

import { useRef } from 'react'
import { useMediaQuery, HOVER_CARD_QUERY } from '../hooks/useMediaQuery.js'

const SHOW_DELAY_MS = 300
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
// between two adjacent names) must not clobber the newer hover. That gap
// jitter is the WHOLE job of the hide delay now: the card itself takes no
// pointer (72-player-hover-card.css), so there is no trigger-to-card travel
// left to hold it open for.
export function scheduleHoverHide(id) {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (state.id === id) commit({ id: null, name: null, rect: null })
  }, HIDE_DELAY_MS)
}

// Closes immediately, no grace period — Escape, an outside click/tap, or a
// scroll (the card is position: fixed off a captured rect, so it stops
// following its trigger the moment the page moves).
export function hideHoverNow() {
  clearTimeout(timer)
  if (state.id !== null) commit({ id: null, name: null, rect: null })
}

// A trigger's own box, or — when that box has collapsed to nothing — the box
// of what it actually renders. `.wire__cutline .plink` and
// `.txstory__cutline .plink` both go `display: contents` so a player's name
// wraps mid-sentence with the prose around it (04-site-bar.css,
// 29-team-transactions.css), predating this card; a `display: contents`
// element generates no box of its own, so its own getBoundingClientRect() is
// always all-zero even while it's on screen and hovered. Its rendered
// content still has a box, reached here through a Range over its children.
function triggerRect(el) {
  const own = el.getBoundingClientRect()
  if (own.width || own.height) return own
  const range = document.createRange()
  range.selectNodeContents(el)
  return range.getBoundingClientRect()
}

// The hover card's trigger props — a ref to measure and the four handlers —
// for PlayerLink's button (components/player/PlayerLink.jsx), and for a
// trigger that is not one: a whole-tile Card link (SimilarPlayerGrid, #1113
// slice C2) keeps the card PlayerLink gave it. Spread the result on the
// trigger element.
export function usePlayerHoverCard(id, displayName) {
  const ref = useRef(null)
  // Desktop-only (see HOVER_CARD_QUERY's own header): a real mouse, at the
  // app's own "wide" width. Read once per render rather than gating inside
  // the handlers below — the handlers still no-op on a stale `true` from the
  // instant before a resize, since the global card requires an active id it
  // never receives from a query that's already false by then.
  const hoverCapable = useMediaQuery(HOVER_CARD_QUERY)
  const show = (opts) => {
    if (!hoverCapable || !ref.current) return
    scheduleHoverShow(id, displayName, triggerRect(ref.current), opts)
  }
  const hide = () => {
    if (!hoverCapable) return
    scheduleHoverHide(id)
  }
  return {
    ref,
    onMouseEnter: () => show(),
    onMouseLeave: hide,
    onFocus: () => show({ immediate: true }),
    onBlur: hide,
  }
}
