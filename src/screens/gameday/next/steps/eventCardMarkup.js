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
  return h('div', { className: 'gdevent', role: 'status' }, box && scorebookBox(h, box),
    h('div', { className: 'gdevent__txt' }, h('span', { className: 'gdevent__kind' }, (kind ?? '').replace(/\s+(2B|3B|Home)$/i, '')), h('span', null, text ?? '')))
}

export const eventCardMarkup = (h, { SealBox, feed, inning, half, count, sub }) =>
  sub > 0 && feed ? h(SealBox, { coverless: true, forceRevealed: true }, () => card(h, feed, inning, half, count, sub)) : null
