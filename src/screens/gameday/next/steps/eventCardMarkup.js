import { openAtBat } from '../../../../api/gameday/subSteps.js'
import { boxModel } from '../hero/heroModel.js'
import { scorebookBox } from '../hero/heroMarkup.js'
import { legAdvanceCode } from '../../../../api/playbyplay/advanceCode.js'

// THE EVENT CARD (#2571, round 2's wild-pitch card): a lower third on the stage while the sub-step on
// screen is a baserunning event or a change. The runner's own box runs to his new base; a change has
// no box. A `.js` builder so node --test renders it (heroMarkup's pattern). Read inside the SealBox reveal
// function, and only the shown sub-step: an event carries its own legs, never the play's end state
// (ADR-0123 decision 5), and a steal folded onto the last pitch takes its words from its own runner
// entry, never that pitch's description.

const BASE = { '1B': 1, '2B': 2, '3B': 3, score: 4 }
const BASE_WORD = { '1B': '1st', '2B': '2nd', '3B': '3rd' }

function card(h, feed, inning, half, count, sub) {
  const o = openAtBat(feed, inning, half, count)
  const s = o?.steps[sub - 1]
  if (!s || (s.kind !== 'event' && s.kind !== 'change')) return null
  const { play } = o
  const ev = play.playEvents.find((e) => e.index === s.index)
  const own = ev && !ev.isPitch
  const legs = s.legs ?? []
  const runner = feed.gameData?.players?.[`ID${s.playerId}`]
  const end = legs.at(-1)
  const kind = own ? ev.details?.event : play.runners.find((r) => r.details?.playIndex === s.index && r.details?.runner?.id === s.playerId)?.details?.event
  const text = own ? ev.details?.description
    : `${runner?.boxscoreName ?? runner?.lastName ?? ''} ${end?.out ? 'out' : end?.to === 'score' ? 'scores' : `to ${BASE_WORD[end?.to] ?? end?.to}`}.`
  const mine = s.kind === 'event' && o.runnerOf(s.playerId)
  // Each leg this event ran is penciled on its own base path, as on paper: SB 1st to 2nd, E2 2nd to 3rd (Gary, 2026-10-28).
  const notes = play.runners.filter((r) => r.details?.playIndex === s.index && r.details?.runner?.id === s.playerId && !r.movement?.isOut && BASE[r.movement?.end])
    .map((r) => ({ leg: BASE[r.movement.end], code: legAdvanceCode(play, r) }))
  const box = mine && end && { ...boxModel(mine), legs: BASE[end.out ? legs[0].from : end.to] ?? 0, out: null, rbi: 0, notes }
  // A change names the man coming in: his number, his position and his hand (Gary, 2026-10-28), "(41 · LHP)",
  // set in line right after his name.
  const inId = s.kind === 'change' && own ? ev.player?.id : null
  const inP = inId ? feed.gameData?.players?.[`ID${inId}`] : null
  const pos = ev?.position?.abbreviation ?? inP?.primaryPosition?.abbreviation ?? ''
  const hand = pos === 'P' ? (inP?.pitchHand?.code ? `${inP.pitchHand.code}HP` : '') : (inP?.batSide?.code ? `Bats ${inP.batSide.code}` : '')
  // A pitcher's hand says his position ("LHP"), so the P is left out.
  // The number he wears in this game (the boxscore's), else his profile's.
  const worn = ['away', 'home'].map((t) => feed.liveData?.boxscore?.teams?.[t]?.players?.[`ID${inId}`]?.jerseyNumber).find(Boolean)
  const facts = inP && [worn ?? inP.primaryNumber, pos !== 'P' && pos, hand].filter(Boolean).join(' · ')
  return h('div', { className: 'gdevent', role: 'status' }, box && scorebookBox(h, box),
    h('div', { className: 'gdevent__txt' }, h('span', { className: 'gdevent__kind' }, (kind ?? '').replace(/\s+(2B|3B|Home)$/i, '')), h('span', null, withFacts(h, unlabeled(text ?? '', kind), inP?.fullName, facts))))
}

// The tab already names the kind, so a sentence that opens on it ("Offensive Substitution: …") drops it (Gary, 2026-10-28).
const unlabeled = (text, kind) => (kind && text.toLowerCase().startsWith(`${kind.toLowerCase()}:`) ? text.slice(kind.length + 1).trimStart() : text) // caps-js-exempt: compares only, renders nothing

// The sentence with the facts right after the incoming man's name; at the end when the name is not in it.
function withFacts(h, text, name, facts) {
  if (!facts) return text
  const tag = h('span', { key: 'f', className: 'gdevent__facts' }, `(${facts})`)
  const at = name ? text.indexOf(name) : -1
  if (at < 0) return [text, ' ', tag]
  const cut = at + name.length
  return [text.slice(0, cut), ' ', tag, text.slice(cut)]
}

export const eventCardMarkup = (h, { SealBox, feed, inning, half, count, sub }) =>
  sub > 0 && feed ? h(SealBox, { coverless: true, forceRevealed: true }, () => card(h, feed, inning, half, count, sub)) : null
