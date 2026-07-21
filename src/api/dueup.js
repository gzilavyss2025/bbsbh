// Who's due up first at the start of a half — the first few batting-order
// slots, resolved WITHOUT needing that half to have actually started yet.
// Combines two already-safe primitives: lineupEntering (api/battingorder.js)
// for WHO occupies each slot as the half begins, and a scan of the side's own
// last completed half for WHICH slot leads off it. Two callers:
//   - selectDueUpNext: the OTHER side's NEXT half, previewed once the
//     CURRENT half is fully revealed (see DueUpNextCard.jsx).
//   - selectDueUpNow: the batting side's OWN half, previewed BEFORE any of it
//     is revealed (see UpNextBatters.jsx) — same shape, just a different
//     target half.
//
// SPOILER SAFETY: entirely inherited from lineupEntering's own gate
// (safeToShowEntering, api/enteringHalf.js) — this file adds no new boundary
// of its own.

import { halfIndex } from './select.js'
import { lineupEntering } from './battingorder.js'
import { NON_PA_EVENT_TYPES, GAME_ADVISORY_EVENT_TYPE } from './playbyplay.js'

// The batting-order slot (1-9) due up first at the start of (targetInning,
// targetHalf): one past the slot that made the last completed plate
// appearance in that side's most recent PREVIOUS half of the same type (own
// half-type never changes — away always tops, home always bottoms — so
// "previous" just means an earlier inning of the same type, strictly before
// the target). A side with no previous half yet (home's very first turn,
// entering the game's own bottom 1st) has no prior PA to key off — its actual
// leadoff man is slot 1, same as the game's own top 1st.
function dueUpSlot(feed, battingSide, targetInning, targetHalf) {
  const boxPlayers = feed?.liveData?.boxscore?.teams?.[battingSide]?.players ?? {}
  let last = null
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const about = play?.about ?? {}
    if (about.halfInning !== targetHalf) continue
    if (halfIndex(about.inning, about.halfInning) >= halfIndex(targetInning, targetHalf)) break
    const eventType = play.result?.eventType
    if (play.result?.type !== 'atBat' || NON_PA_EVENT_TYPES.has(eventType) || eventType === GAME_ADVISORY_EVENT_TYPE) {
      continue
    }
    const batterId = play.matchup?.batter?.id
    if (batterId != null) last = batterId
  }
  if (last == null) return 1
  const bo = Number(boxPlayers[`ID${last}`]?.battingOrder)
  if (!Number.isFinite(bo)) return 1
  const slot = Math.floor(bo / 100)
  return slot >= 9 ? 1 : slot + 1
}

// { battingSide, batters: [{ slot, id, last, first, jersey, position }, …] }
// (up to `count`, batting-order order, wrapping past 9 back to 1) or null —
// either lineupEntering itself isn't safe to show yet, or the half's lineup
// hasn't posted (MiLB gap, or the game just hasn't gotten there).
function battersDueUp(feed, battingSide, targetInning, targetHalf, revealedThrough, count) {
  const slots = lineupEntering(feed, battingSide, targetInning, targetHalf, revealedThrough)
  if (!slots || slots.length === 0) return null

  const bySlot = new Map(slots.map((s) => [s.slot, s.entries[s.entries.length - 1]]))
  const startSlot = dueUpSlot(feed, battingSide, targetInning, targetHalf)

  const batters = []
  for (let i = 0; i < count && i < slots.length; i++) {
    const slot = ((startSlot - 1 + i) % 9) + 1
    const entry = bySlot.get(slot)
    if (entry) batters.push({ slot, ...entry })
  }
  if (batters.length === 0) return null
  return { battingSide, batters }
}

// The OTHER side's NEXT half — see DueUpNextCard.jsx. Safe to show only once
// the current half is fully revealed: the next half is exactly
// revealedThrough + 1 by then (any earlier and it's two-halves-out, blocked
// by lineupEntering's own gate), which lines up with when a caller would
// reach for this — right as the "NEXT >" nav appears.
export function selectDueUpNext(feed, inning, half, revealedThrough = Infinity, count = 3) {
  const battingSide = half === 'top' ? 'home' : 'away'
  const nextHalf = half === 'top' ? 'bottom' : 'top'
  const nextInning = half === 'top' ? inning : inning + 1
  return battersDueUp(feed, battingSide, nextInning, nextHalf, revealedThrough, count)
}

// The batting side's OWN half — see UpNextBatters.jsx. Safe to show as soon
// as this half is the user's own next one to reveal (the same footing the
// pre-pitch lineup/defense reference already stands on, ADR-0010), i.e.
// BEFORE any of it has actually been revealed.
export function selectDueUpNow(feed, inning, half, revealedThrough = Infinity, count = 3) {
  const battingSide = half === 'top' ? 'away' : 'home'
  return battersDueUp(feed, battingSide, inning, half, revealedThrough, count)
}
