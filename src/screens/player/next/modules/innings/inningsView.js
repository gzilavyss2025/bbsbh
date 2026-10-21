// The innings card's pure view (#1928): share per position, ring sizes, the scope list.
// The data shapers (fieldingView, starterRelieverView) stay in src/api/person.js; this
// turns their output into what the board draws.
import { ipToOuts, outsToIp } from '../../../../../lib/math/innings.js'
import { parkWindow } from '../../../../../lib/ballpark/layout/parkWindow.js'

// Same anchors as PositionInnings, in percent of FieldBackdrop's box (the card's art for a
// player whose club has no park on file).
const FIELD_SPOTS = {
  LF: { x: 23, y: 24 },
  CF: { x: 50, y: 12 },
  RF: { x: 77, y: 24 },
  SS: { x: 32, y: 45 },
  '2B': { x: 68, y: 45 },
  '3B': { x: 22, y: 65 },
  '1B': { x: 78, y: 65 },
  C: { x: 50, y: 94 },
  P: { x: 50, y: 64.4 },
}
// The board's anchors in the park diagram's own space, where home is (310, 505) and one unit is
// one foot, so a ring stands where the position does in any park. The crop is innWindow's.
const PARK_SPOTS = {
  P: [310, 444], C: [310, 527], '1B': [374, 442], '2B': [362, 386], '3B': [246, 442], SS: [258, 386],
  LF: [185, 300], CF: [310, 235], RF: [435, 300],
}
// The board's window onto the park: its own sides (x 30 to 590, the poles with a little paper)
// and the park's own sky trim (parkWindow.js), so a shallow park leaves no empty band on top.
export const innWindow = (park) => parkWindow(park, { x: 30, w: 560 })

// A spot as { x, y } percent of the art's box: the window's for a park, the shared field's else.
export const spotAt = (pos, win) => {
  if (!win) return FIELD_SPOTS[pos]
  const [x, y] = PARK_SPOTS[pos]
  const at = win.percent({ x, y })
  return { x: at.left, y: at.top }
}

export const FIELD_ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
// Where a ring's innings tag sits so it clears its neighbours (above, below, left, right).
export const TAG_SIDE = { C: 'b', '1B': 'r', '2B': 'a', '3B': 'l', SS: 'a', LF: 'b', CF: 'b', RF: 'b' }

// A club with a parent org is a minor-league club (identity.js), the live History tab's own test.
export const inMinors = (bio) => Boolean(bio.team?.parentOrgId)
// Season always; MLB career after a debut; MiLB career for a player now in the minors (so a
// pre-debut prospect has a card). The keys are loadPositionScope's own.
export const scopeOptions = (bio) => [
  { key: 'season', label: 'Season' },
  ...(bio.debut ? [{ key: 'mlb', label: 'MLB career' }] : []),
  ...(inMinors(bio) ? [{ key: 'milb', label: 'MiLB career' }] : []),
]

// A ring's arc as a percent of the circle; a sliver still shows, and none stays none.
export const ringSize = (share) => (share > 0 ? Math.min(100, Math.max(3, share * 100)) : 0)

// Hitting: one ring per position played, sized by its share of his field innings. The
// mound is the pitcher card's, so P is left out. Null when he has neither a ring nor a DH game.
export function batterView(fielding) {
  const outs = new Map(
    (fielding?.positions ?? [])
      .filter((p) => FIELD_ORDER.includes(p.pos) && ipToOuts(p.innings) > 0)
      .map((p) => [p.pos, ipToOuts(p.innings)]),
  )
  const total = [...outs.values()].reduce((a, b) => a + b, 0)
  const top = [...outs].sort((a, b) => b[1] - a[1])[0]?.[0]
  const rings = FIELD_ORDER.filter((pos) => outs.has(pos)).map((pos) => ({
    pos,
    innings: outsToIp(outs.get(pos)),
    share: outs.get(pos) / total,
    size: ringSize(outs.get(pos) / total),
    top: pos === top,
  }))
  const dh = fielding?.dh?.games ?? 0
  return rings.length || dh ? { rings, idle: FIELD_ORDER.filter((pos) => !outs.has(pos)), dh } : null
}

// Pitching: one ring on the mound, its arc the starter's share of his innings.
export function pitcherView(split) {
  const sp = ipToOuts(split?.starter)
  const rp = ipToOuts(split?.reliever)
  if (!sp && !rp) return null
  return { starter: split.starter, reliever: split.reliever, size: ringSize(sp / (sp + rp)) }
}
