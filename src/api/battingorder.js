// The batting side's lineup card as it stands ENTERING a half-inning — the nine
// batting-order slots, each showing its starter plus every pinch-hitter/
// pinch-runner or double-switch sub who took that slot before the half's first
// pitch (a change made *during* the half stays sealed until the user reveals
// their way into it). Each occupant carries his jersey number and fielding
// position for a scorebook-ready row.
//
// Like api/defense.js's defenseEntering, this is spoiler-adjacent by substitution
// *timing* (a pinch-hitter telegraphs a game situation), so lineupEntering
// enforces its own spoiler-safety gate rather than trusting the caller: it
// takes `revealedThrough` and returns null for a half further out than the
// user's own next one to reveal (see safeToShowEntering in
// api/enteringHalf.js).
//
// A player's batting SLOT never needs reconstructing from event replay: every
// boxscore player's own `battingOrder` value already encodes it directly as
// `slot * 100 + sequence` (a starter is an exact multiple of 100; the Nth sub in
// that slot is `slot*100 + N`) — so grouping by slot and sorting by the raw
// value gives the true chronological chain. Only the *timing* (which members are
// in the game yet, entering this half) comes from event replay, via
// entrantsBeforeFirstPitch; the fielding position comes from defenseEntering.

import { entryIndexById, startingPositionAbbr } from './select.js'
import {
  enteringLastName,
  enteringFirstName,
  entrantsBeforeFirstPitch,
  safeToShowEntering,
} from './enteringHalf.js'
import { defenseEntering } from './defense.js'

export function lineupEntering(feed, battingSide, throughInning, throughHalf, revealedThrough = Infinity) {
  if (!safeToShowEntering(revealedThrough, throughInning, throughHalf)) return null

  const team = feed?.liveData?.boxscore?.teams?.[battingSide]
  const boxPlayers = team?.players ?? {}
  const players = feed?.gameData?.players ?? {}
  const nameOf = (id) => enteringLastName(feed, id)
  const firstNameOf = (id) => enteringFirstName(feed, id)
  const entered = entryIndexById(feed)

  // Who's in the game as this half begins: starters (no entry event) always,
  // plus every sub whose entry landed before the half's first pitch. A sub who
  // enters mid-half (or in a later, still-sealed half) is left off.
  const entrantsBefore = entrantsBeforeFirstPitch(feed, throughInning, throughHalf)
  const inGame = (id, entryIdx) => entryIdx == null || entrantsBefore.has(id)

  // Fielding position per player entering this half, inverted from the side's
  // defensive alignment — the last (un-replaced) occupant of each spot. Covers
  // the eight fielders + DH; anyone else (a batting pitcher, or a sub not yet
  // assigned a spot) falls back to his own starting/primary position. The
  // gate above already passed, so this nested defenseEntering call is safe
  // regardless of whether revealedThrough is threaded through it too — but it
  // is, for defense in depth.
  const posById = {}
  for (const spot of defenseEntering(feed, battingSide, throughInning, throughHalf, revealedThrough) ?? []) {
    const cur = spot.entries[spot.entries.length - 1]
    if (cur?.id != null) posById[cur.id] = spot.position
  }
  const jerseyOf = (id) =>
    boxPlayers[`ID${id}`]?.jerseyNumber ?? players[`ID${id}`]?.primaryNumber ?? ''
  const posOf = (id) => posById[id] ?? startingPositionAbbr(boxPlayers[`ID${id}`])

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
      if (!inGame(m.id, idx)) continue // not in the game yet, entering this half
      chain.push({
        id: m.id,
        last: nameOf(m.id),
        first: firstNameOf(m.id),
        jersey: jerseyOf(m.id),
        position: posOf(m.id),
        inning: idx != null ? Math.floor(idx / 2) + 1 : null,
      })
    }
    if (chain.length === 0) continue
    slots.push({
      slot,
      entries: chain.map((e, i) => ({ ...e, replaced: i < chain.length - 1 })),
    })
  }
  return slots
}
