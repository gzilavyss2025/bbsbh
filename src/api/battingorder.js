// Reveal-only: the batting side's live lineup card for a half-inning — the
// nine batting-order slots, each showing its starter plus every pinch-hitter/
// pinch-runner or double-switch sub who has taken that slot through the
// completion of the half being revealed. A lineup change is spoiler-adjacent
// exactly like a defensive change (api/defense.js) — a pinch-hitter mid-inning
// can telegraph a game situation — so this must ONLY be called from inside a
// SealBox's reveal render function, with the half being revealed as the
// `through` cutoff. Never call it at render top-level.
//
// Unlike defense.js, a player's batting SLOT never needs reconstructing from
// event replay: every boxscore player's own `battingOrder` value already
// encodes it directly as `slot * 100 + sequence` (a starter is an exact
// multiple of 100; the Nth sub in that slot is `slot*100 + N`) — so grouping
// by slot and sorting by the raw value gives the true chronological chain
// with no risk of the starting-position ambiguity that api/select.js's
// selectLineup had to fix (see its `position` comment).

import { lastName, halfIndex, entryIndexById } from './select.js'

export function revealBattingOrder(feed, battingSide, throughInning, throughHalf) {
  const team = feed?.liveData?.boxscore?.teams?.[battingSide]
  const boxPlayers = team?.players ?? {}
  const players = feed?.gameData?.players ?? {}
  const nameOf = (id) => lastName(players[`ID${id}`] ?? {}) || '—'
  const entered = entryIndexById(feed)
  const cutoff = halfIndex(throughInning, throughHalf)

  const bySlot = {} // slot (1-9) -> [{ id, bo }]
  for (const p of Object.values(boxPlayers)) {
    const bo = Number(p.battingOrder)
    if (!Number.isFinite(bo)) continue
    const slot = Math.floor(bo / 100)
    if (slot < 1 || slot > 9 || p.person?.id == null) continue
    ;(bySlot[slot] ??= []).push({ id: p.person.id, bo })
  }

  const slots = []
  for (let slot = 1; slot <= 9; slot++) {
    const members = (bySlot[slot] ?? []).sort((a, b) => a.bo - b.bo)
    const chain = []
    for (const m of members) {
      const idx = entered[m.id] ?? null // null for the starter, who has no entry event
      if (idx != null && idx > cutoff) continue // not revealed yet — stop the chain here
      chain.push({ last: nameOf(m.id), inning: idx != null ? Math.floor(idx / 2) + 1 : null })
    }
    if (chain.length === 0) continue
    slots.push({
      slot,
      entries: chain.map((e, i) => ({ ...e, replaced: i < chain.length - 1 })),
    })
  }
  return slots
}
