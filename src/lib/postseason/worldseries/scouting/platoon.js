import { leadSide } from '../hotBats.js'

// PLATOON (#2316): each Series club's lineup OPS against right- and left-handed pitching (regular
// season, api/scout/seriesFit.js), and the hand each club faces in the focus game. Pure.
const HANDS = [
  { hand: 'R', title: 'vs right-handers', word: 'right-hander' },
  { hand: 'L', title: 'vs left-handers', word: 'left-hander' },
]
const real = (v) => Number.isFinite(v)
// Three places, the way OPS prints (.706), so the leader is picked on what is on screen.
const round3 = (v) => Math.round(v * 1000) / 1000

// 'R' | 'L' | '': the hand of the pitcher each club faces, which is the OTHER club's probable.
// {} for no game. A probable with no announced hand gives '' (nobody is tinted for that club).
export function facedHands(game) {
  if (!game) return {}
  return {
    [game.awayId]: game.home?.hand ?? '',
    [game.homeId]: game.away?.hand ?? '',
  }
}

// (ops { [clubId]: { R, L } }, { clubA, clubB, game, gameNumber }) -> null | [{ hand, title, cells }]
// A cell is { clubId, ops, lead, faces, caption }. `lead` is true only for the higher rounded OPS (a
// tie leads for nobody). A hand with no OPS for BOTH clubs is not a block; no block, no card.
export function platoonModel(ops, { clubA, clubB, game, gameNumber }) {
  const faced = facedHands(game)
  const blocks = HANDS.map(({ hand, title, word }) => {
    const [a, b] = [clubA, clubB].map((id) => (real(ops?.[id]?.[hand]) ? round3(ops[id][hand]) : null))
    if (a == null || b == null) return null
    const side = leadSide(a, b)
    const cells = [clubA, clubB].map((clubId, i) => {
      const faces = faced[clubId] === hand
      return {
        clubId,
        ops: i ? b : a,
        lead: side === (i ? 'b' : 'a'),
        faces,
        caption: faces ? `Faces a ${word}${gameNumber ? ` in Game ${gameNumber}` : ''}` : 'Regular season',
      }
    })
    return { hand, title, cells }
  }).filter(Boolean)
  return blocks.length ? blocks : null
}
