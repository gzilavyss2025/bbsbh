// Reveal-only: the fielding team's live defensive alignment for a half-inning,
// built up from the starting nine plus every defensive substitution/switch made
// through the completion of that half. A defensive change is spoiler-adjacent —
// a flurry of replacements telegraphs a sealed blowout — so, exactly like
// linescore.js / derive.js, this must ONLY be called from inside a SealBox's
// reveal render function, with the half being revealed as the `through` cutoff.
// Never call it at render top-level: passing a future inning would leak
// substitutions the user hasn't uncovered yet.

import { selectLineup, lastName, halfIndex } from './select.js'

// The eight positions that stand in the diamond (the pitcher has his own table;
// the DH bats but never fields, so he rides a line beneath the field).
const FIELD_POSITIONS = new Set(['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'])
// Rigid C→DH read order, same as the lineup page's opposing-defense list.
const DISPLAY_ORDER = ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH']

// Returns one entry per occupied position, in DISPLAY_ORDER:
//   { position, entries: [{ last, inning, replaced }, …] }
// entries run oldest→newest: the starter first (inning null), then each player
// who took the spot, tagged with the inning he entered. Every entry but the
// last carries replaced:true so the caller can strike it through, scorebook
// style — the surviving occupant is the final, un-struck name.
export function revealDefense(feed, fieldingSide, throughInning, throughHalf) {
  const lineup = selectLineup(feed, fieldingSide)
  const players = feed?.gameData?.players ?? {}
  const nameOf = (id) => lastName(players[`ID${id}`] ?? {}) || '—'

  // Starting occupant per position (fielders + DH).
  const start = {}
  for (const p of lineup) {
    if (FIELD_POSITIONS.has(p.position) || p.position === 'DH') {
      start[p.position] = { id: p.id, last: p.last }
    }
  }

  // Replay defensive moves in order, gated to the half being revealed. Each
  // move where a NEW player takes a fielding spot appends to that spot's chain;
  // byPos tracks the current occupant so a no-op (same player) is ignored.
  const cutoff = halfIndex(throughInning, throughHalf)
  const changes = {} // pos -> [{ last, inning }]
  const byPos = {}
  for (const pos of Object.keys(start)) byPos[pos] = start[pos].id

  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const inn = play?.about?.inning
    const half = play?.about?.halfInning
    if (!inn || !half) continue
    if (halfIndex(inn, half) > cutoff) break // allPlays is chronological
    for (const ev of play.playEvents ?? []) {
      const et = ev?.details?.eventType
      if (et !== 'defensive_substitution' && et !== 'defensive_switch') continue
      const pos = ev.position?.abbreviation
      const id = ev.player?.id
      if (!FIELD_POSITIONS.has(pos) || id == null || byPos[pos] === id) continue
      ;(changes[pos] ??= []).push({ last: nameOf(id), inning: inn })
      byPos[pos] = id
    }
  }

  return DISPLAY_ORDER.filter((pos) => start[pos] || changes[pos]).map((pos) => {
    const chain = []
    if (start[pos]) chain.push({ last: start[pos].last, inning: null })
    for (const c of changes[pos] ?? []) chain.push({ last: c.last, inning: c.inning })
    return {
      position: pos,
      entries: chain.map((e, i) => ({ ...e, replaced: i < chain.length - 1 })),
    }
  })
}
