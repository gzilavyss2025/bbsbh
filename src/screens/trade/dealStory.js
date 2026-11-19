import { buildCutline } from '../../api/transactions/cutline.js'
import { teamClubName, teamFullName } from '../../lib/teams.js'
import { wirePos, pickText } from '../../lib/trade/deal.js'

// The deal as a wire story, so the card draws it the way the home page's
// offseason feed draws a major trade (components/transactions/MoveRow.jsx):
// faces with In / Out banners, both club marks, the cutline the wire writes
// for a trade ("Acquired … from the Arizona Diamondbacks for …"), and each
// player's note. Told from club A's side, as the wire tells a trade from its
// owner's. The rows are shaped like statsapi /transactions rows, so the
// cutline is the wire's own builder, not a copy. Null when no player moves:
// picks and cash alone have no wire story, and the card keeps its sentence.
const rowOf = (p, from, to) => ({
  typeCode: 'TR',
  person: { id: p.id, fullName: p.name },
  fromTeam: { id: from, name: teamFullName(from) },
  toTeam: { id: to, name: teamFullName(to) },
})

export function dealStory({ a, b, sendsA, sendsB, picksA = [], picksB = [], cashA = 0, cashB = 0 }) {
  const rows = [
    ...sendsB.map((p) => ({ row: rowOf(p, b, a), role: 'in' })),
    ...sendsA.map((p) => ({ row: rowOf(p, a, b), role: 'out' })),
  ]
  if (!rows.length) return null
  const positions = Object.fromEntries([...sendsA, ...sendsB].map((p) => [p.id, wirePos(p)]))
  const partner = teamFullName(b)
  // The partner club is a linked name, as on the wire; MoveRow reads it for the second mark.
  const cutline = buildCutline({ storyType: 'trade', rows }, { positions }).flatMap((seg) => {
    const at = seg.playerId ? -1 : seg.text.indexOf(partner)
    if (at < 0) return [seg]
    return [{ text: seg.text.slice(0, at) }, { text: partner, teamId: b }, { text: seg.text.slice(at + partner.length) }].filter((s) => s.text)
  })
  // Picks and cash ride in rows the wire never files: one plain sentence per club.
  const extras = (picks, cash) => [...picks.map(pickText), ...(cash ? ['cash'] : [])]
  for (const [club, list] of [[a, extras(picksB, cashB)], [b, extras(picksA, cashA)]]) {
    if (list.length) cutline.push({ text: ` The ${teamClubName(club)} also get ${list.join(' and ')}.` })
  }
  const slot = (p, role, teamId) => ({ role, banner: role === 'in' ? 'In' : 'Out', playerId: p.id, name: p.name, tintTeamId: teamId, isMlb: p.onForty })
  return {
    id: 'trade-simulator',
    type: 'trade',
    typeLabel: 'Trade',
    codes: ['TR'],
    teamId: a,
    rail: [...sendsB.map((p) => slot(p, 'in', b)), ...sendsA.map((p) => slot(p, 'out', a))],
    cutline,
  }
}
