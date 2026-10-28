import { HARD_HIT_MPH } from '../../../../lib/ballpark/hitProjection.js'
import { pitchLadder } from '../../../../api/playbyplay/pitchInfo.js'

// The hero's pure parts: what the scorebook box draws for one at-bat entry (a computeHalfInningFeed
// card, already clamped to the reader's cursor by its caller), and the words around it.

const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
export const ordinal = (n) => ORD[n] ?? ''

// How a scorer splits an out between the box and the diamond (Gary, 2026-10-27): the kind of out goes
// in the box (GO, FO, LO, PO, K, SF, SAC, GIDP, TP), the fielders who made it in the middle of the
// diamond (6-3, F8). A hit, a walk, an error keep their code in the box and the diamond's middle empty.
// -> { box, mid }
export function splitCode(code, kind) {
  // An at-bat cut short by the half's last out on the bases (CS →): nothing in the box, the play in the diamond.
  if (kind === 'interrupted') return { box: '', mid: code }
  // A strikeout reads SO in the box and its K in the diamond (Gary, 2026-10-28).
  if (code === 'K') return { box: 'SO', mid: 'K' }
  if (kind !== 'out' || !code) return { box: code, mid: '' }
  const [head, chain] = code.includes('\n') ? code.split('\n') : [null, code]
  if (head) return { box: head, mid: chain }
  const sac = /^(SAC|SF)\s*(.*)$/.exec(code)
  if (sac) return { box: sac[1], mid: sac[2] }
  const tp = /^TP\s+(.*)$/.exec(code)
  if (tp) return { box: 'TP', mid: tp[1] }
  // A ball caught for a double play keeps the play in the box: LO DP.
  const caught = /^(DP\s+)?F?([LPF])\d/.exec(code)
  if (caught) return { box: `${caught[2]}O${caught[1] ? ' DP' : ''}`, mid: code.replace(/^DP\s+/, '') }
  if (/^\d/.test(code)) return { box: 'GO', mid: code }
  return { box: code, mid: '' }
}

// Two pitch columns (numbers, X for the ball put in play), the legs the batter ran as of the cursor
// (4 = scored), the code, the RBI and the out number. A called third strike has no code by design
// (scorebookCode.js): `looking` tells the box to draw the backwards K.
export function boxModel(e) {
  const ladder = pitchLadder(e.pitches ?? [])
  const looking = Boolean(e.calledLooking)
  return {
    balls: ladder.filter((p) => p.side === 'ball').map((p) => p.label),
    strikes: ladder.filter((p) => p.side === 'strike').map((p) => p.label),
    legs: e.scored ? 4 : e.reached ?? 0,
    code: looking ? 'K' : e.code ?? '',
    ...splitCode(looking ? 'K' : e.code ?? '', e.codeKind),
    hit: e.codeKind === 'hit',
    looking,
    rbi: e.rbi ?? 0,
    out: e.outNumber ?? null,
  }
}

// Exit velocity to a tenth, the ".0" dropped: 115.5, 103.
const velo = (v) => String(Math.round(v * 10) / 10)

// "103 mph · 30° · 382 ft"; a ground ball's distance is where it was fielded, so it is left out.
export function contactLine(e) {
  const b = e.battedBall
  if (!b || b.exitVelo == null) return ''
  const parts = [`${velo(b.exitVelo)} mph`]
  if (b.launchAngle != null) parts.push(`${b.launchAngle}°`)
  if (b.distance != null && b.trajectory !== 'ground_ball') parts.push(`${b.distance} ft`)
  return parts.join(' · ')
}

// The same three numbers as the line, one entry each, for the hero's stat card.
export function contactStats(e) {
  const b = e.battedBall
  if (!b || b.exitVelo == null) return []
  return [
    // Statcast's hard-hit line (95 mph) marks the cell (Gary, 2026-10-28: a slow pulse, hero.css).
    { label: 'Exit velo', value: velo(b.exitVelo), unit: 'mph', hard: b.exitVelo >= HARD_HIT_MPH },
    b.launchAngle != null && { label: 'Launch angle', value: `${b.launchAngle}°`, unit: '' },
    b.distance != null && b.trajectory !== 'ground_ball' && { label: 'Distance', value: b.distance, unit: 'ft' },
  ].filter(Boolean)
}

export const playLine = (e) => (e.descSegments ?? []).map((s) => s.text ?? '').join('').trim()

// The out that cut an at-bat short (an inning-ending caught stealing or pickoff), as the scorer writes it
// on the runner: "CS 2-4", and the play's own words. `play` is the card's feed play, read by the caller
// inside the reveal. -> { code, text } or null.
export function cutShort(play, outCode) {
  const r = (play?.runners ?? []).find((x) => x.movement?.isOut)
  if (!r) return null
  return { code: outCode(play, r), text: play.result?.description ?? '' }
}
