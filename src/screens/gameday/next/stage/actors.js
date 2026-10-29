// Identity at the reader's cursor. Call stageActors only inside a SealBox reveal
// function: defenseAt and openAtBat are reveal-only, with their existing step clamp.
import { computeHalfInningFeed } from '../../../../api/playbyplay.js'
import { defenseAt } from '../../../../api/gameday/defense.js'
import { openAtBat } from '../../../../api/gameday/subSteps.js'
import { safeStep } from '../../../../api/gameday/stepCut.js'
import { halfIndex } from '../../../../api/select.js'
import { POS } from './scene.js'

export function stageActors(feed, { inning, half, mark, step = null, open, batter, shown }) {
  if (!feed || !inning || !half || halfIndex(inning, half) > (mark ?? -1) + 1) return null
  step = safeStep(step, halfIndex(inning, half), mark)
  // A trail replay may be earlier than the scoring cursor. Stop on its card,
  // before a later card's defensive changes, while keeping the original reveal cap.
  if (typeof shown === 'number') {
    const cards = computeHalfInningFeed(feed, inning, half, half === 'top' ? 'away' : 'home', step)
    const visible = step == null ? cards : cards.slice(0, step)
    const index = visible.findIndex((c) => c.kind === 'atbat' && c.atBatIndex === shown)
    if (index >= 0) step = index + 1
  }
  const at = { ...defenseAt(feed, { inning, half, step, revealedThrough: mark }) }
  const current = typeof shown !== 'number' && open?.sub > 0 ? openAtBat(feed, inning, half, open.count) : null
  const side = half === 'top' ? 'home' : 'away'
  const ours = new Set(Object.values(feed.liveData?.boxscore?.teams?.[side]?.players ?? {}).map((p) => p.person?.id))
  // Apply only changes whose own sub-step has been revealed, never later events.
  for (const s of current?.steps.slice(0, open.sub) ?? []) {
    if (s.kind !== 'change' || !ours.has(s.playerId)) continue
    const pos = s.eventType === 'pitching_substitution' ? 'P' : s.position
    if (!['pitching_substitution', 'defensive_substitution', 'defensive_switch'].includes(s.eventType) || !POS[pos]) continue
    for (const key of Object.keys(at)) if (at[key]?.id === s.playerId) delete at[key]
    at[pos] = { id: s.playerId }
  }
  let batterId = batter?.id ?? current?.play?.matchup?.batter?.id ?? null
  // A later pinch hitter must not acquire the earlier batter's hover target.
  const unseen = current?.steps.slice(open.sub).find((s) => s.eventType === 'offensive_substitution')
  if (unseen?.replacedId != null) batterId = unseen.replacedId
  return { fielders: at, batterId, players: feed.gameData?.players ?? {}, open: !!current }
}

