// Who's due up first when the OTHER side's next half starts — a preview card
// for the half the user hasn't reached yet, shown once the CURRENT half is
// fully revealed (see HalfInning.jsx). Combines two already-safe primitives:
// lineupEntering (api/battingorder.js) for WHO occupies each batting-order
// slot as that half begins, and a scan of the side's own last completed half
// for WHICH slot leads off it.
//
// SPOILER SAFETY: entirely inherited from lineupEntering's own gate
// (safeToShowEntering, api/enteringHalf.js) — this file adds no new boundary
// of its own. The next half is always exactly revealedThrough + 1 by the time
// this is safe to show (the current half must be fully revealed before its
// own "next half" stops being two-halves-out), which is also exactly when a
// caller would reach for this: right as the "NEXT >" nav appears.

import { halfIndex } from './select.js'
import { lineupEntering } from './battingorder.js'
import { NON_PA_EVENT_TYPES, GAME_ADVISORY_EVENT_TYPE } from './playbyplay.js'

// The batting-order slot (1-9) due up first in a side's NEXT half: one past
// the slot that made the last completed plate appearance in that side's most
// recent PREVIOUS half (own half-type never changes — away always tops,
// home always bottoms — so "previous" just means the same half-type, an
// earlier inning). A side with no previous half yet (home's very first turn,
// entering the game's own bottom 1st) has no prior PA to key off — its actual
// leadoff man is slot 1, same as the game's own top 1st.
function dueUpSlot(feed, battingSide, nextInning, nextHalf) {
  const boxPlayers = feed?.liveData?.boxscore?.teams?.[battingSide]?.players ?? {}
  let last = null
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const about = play?.about ?? {}
    if (about.halfInning !== nextHalf) continue
    if (halfIndex(about.inning, about.halfInning) >= halfIndex(nextInning, nextHalf)) break
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
// either lineupEntering itself isn't safe to show yet, or the next half's
// lineup hasn't posted (MiLB gap, or the game just hasn't gotten there).
export function selectDueUpNext(feed, inning, half, revealedThrough = Infinity, count = 3) {
  const battingSide = half === 'top' ? 'home' : 'away'
  const nextHalf = half === 'top' ? 'bottom' : 'top'
  const nextInning = half === 'top' ? inning : inning + 1

  const slots = lineupEntering(feed, battingSide, nextInning, nextHalf, revealedThrough)
  if (!slots || slots.length === 0) return null

  const bySlot = new Map(slots.map((s) => [s.slot, s.entries[s.entries.length - 1]]))
  const startSlot = dueUpSlot(feed, battingSide, nextInning, nextHalf)

  const batters = []
  for (let i = 0; i < count && i < slots.length; i++) {
    const slot = ((startSlot - 1 + i) % 9) + 1
    const entry = bySlot.get(slot)
    if (entry) batters.push({ slot, ...entry })
  }
  if (batters.length === 0) return null
  return { battingSide, batters }
}
