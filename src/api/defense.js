// The fielding team's defensive alignment as it stands ENTERING a half-inning —
// the starting nine plus every defensive substitution/switch made before that
// half's first pitch (so a change made *during* the half is not shown until the
// user reveals their way into it). It is not, on its own, a score-revealing
// value, but substitution *timing* is spoiler-adjacent — a flurry of pre-half
// replacements telegraphs a sealed blowout — so defenseEntering enforces its
// own spoiler-safety gate: it takes `revealedThrough` and returns null for a
// half further out than the user's own next one to reveal (see
// safeToShowEntering in api/enteringHalf.js), rather than trusting the caller
// to check first. InningViewer just passes revealedThrough straight through;
// BoxScore renders the whole-game alignment (throughInning = Infinity) inside
// the box score's own seal, where revealedThrough is irrelevant (defaults to
// Infinity — see enteringHalf.js).

import { selectLineup } from './select.js'
import {
  forEachEventBeforeFirstPitch,
  enteringLastName,
  safeToShowEntering,
} from './enteringHalf.js'

// The eight positions that stand in the diamond (the pitcher has his own table;
// the DH bats but never fields, so he rides a line beneath the field).
const FIELD_POSITIONS = new Set(['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'])
// Rigid C→DH read order, same as the lineup page's opposing-defense list.
const DISPLAY_ORDER = ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH']

// Returns one entry per occupied position, in DISPLAY_ORDER:
//   { position, entries: [{ id, last, inning, replaced }, …] }
// entries run oldest→newest: the starter first (inning null), then each player
// who took the spot before this half began, tagged with the inning he entered.
// Every entry but the last carries replaced:true so the caller can strike it
// through, scorebook style — the surviving occupant is the final, un-struck
// name. Pass Infinity/'bottom' as through* to get the whole-game alignment.
//
// `revealedThrough` (a half-index; see halfIndex) is the caller's reveal
// high-water mark — required to render this outside a SealBox. Returns null
// when (throughInning, throughHalf) is further out than the half the user is
// due to reveal next; defaults to Infinity for callers already inside their
// own seal (BoxScore's whole-game read), which always passes the gate.
export function defenseEntering(feed, fieldingSide, throughInning, throughHalf, revealedThrough = Infinity) {
  if (!safeToShowEntering(revealedThrough, throughInning, throughHalf)) return null

  const lineup = selectLineup(feed, fieldingSide)
  const nameOf = (id) => enteringLastName(feed, id)

  // Substitutions are matched to positions by abbreviation, but both teams field
  // the same eight spots — so a sub must be attributed to the team that made it,
  // or the other club's move bleeds into this diamond (a Brewers switch showing
  // up at the Cardinals' 3B). Gate on the fielding team's own roster: only a
  // player on this side can take one of its positions.
  const box = feed?.liveData?.boxscore?.teams?.[fieldingSide]
  const teamIds = new Set(
    Object.values(box?.players ?? {})
      .map((p) => p?.person?.id)
      .filter((id) => id != null),
  )

  // Starting occupant per position (fielders + DH).
  const start = {}
  for (const p of lineup) {
    if (FIELD_POSITIONS.has(p.position) || p.position === 'DH') {
      start[p.position] = { id: p.id, last: p.last }
    }
  }

  // Replay defensive moves in order, up to (but not into) this half — each move
  // where a NEW player takes a fielding spot appends to that spot's chain; byPos
  // tracks the current occupant so a no-op (same player) is ignored.
  const changes = {} // pos -> [{ id, last, inning }]
  const byPos = {}
  for (const pos of Object.keys(start)) byPos[pos] = start[pos].id

  forEachEventBeforeFirstPitch(feed, throughInning, throughHalf, (ev, play) => {
    const et = ev?.details?.eventType
    if (et !== 'defensive_substitution' && et !== 'defensive_switch') return
    const pos = ev.position?.abbreviation
    const id = ev.player?.id
    if (!FIELD_POSITIONS.has(pos) || id == null || byPos[pos] === id) return
    if (!teamIds.has(id)) return // a sub the OTHER team made — not this defense
    ;(changes[pos] ??= []).push({ id, last: nameOf(id), inning: play?.about?.inning })
    byPos[pos] = id
  })

  return DISPLAY_ORDER.filter((pos) => start[pos] || changes[pos]).map((pos) => {
    const chain = []
    if (start[pos]) chain.push({ id: start[pos].id, last: start[pos].last, inning: null })
    for (const c of changes[pos] ?? []) chain.push({ id: c.id, last: c.last, inning: c.inning })
    return {
      position: pos,
      entries: chain.map((e, i) => ({ ...e, replaced: i < chain.length - 1 })),
    }
  })
}
