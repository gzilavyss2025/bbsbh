// Identity at the reader's cursor. Call stageActors only inside a SealBox reveal
// function: defenseAt and openAtBat are reveal-only, with their existing step clamp.
import { defenseAt } from '../../../../api/gameday/defense.js'
import { openAtBat } from '../../../../api/gameday/subSteps.js'
import { halfIndex } from '../../../../api/select.js'
import { POS } from './scene.js'

export function stageActors(feed, { inning, half, mark, step = null, open, batter }) {
  if (!feed || !inning || !half || halfIndex(inning, half) > (mark ?? -1) + 1) return null
  const at = { ...defenseAt(feed, { inning, half, step, revealedThrough: mark }) }
  const current = open?.sub > 0 ? openAtBat(feed, inning, half, open.count) : null
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

export function spriteTargets(play, actors) {
  if (!actors) return []
  const person = (key, id, role) => {
    if (id == null) return null
    const p = actors.players['ID' + id]
    const name = p?.fullName || [p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Player ' + id
    return { key, id, name, role }
  }
  const out = Object.entries(actors.fielders).filter(([pos]) => POS[pos]).map(([pos, p]) => person(pos, pos === 'P' && !actors.open ? play.pitcherId ?? p.id : p.id, pos === 'P' ? 'Pitcher' : pos === 'C' ? 'Catcher' : pos))
  out.push(person('batter', actors.open ? actors.batterId : play.batterId ?? actors.batterId, 'Batter'))
  play.runners.forEach((r, i) => out.push(person('runner:' + i, r.id, r.start == null ? 'Batter running' : 'Baserunner')))
  return out.filter(Boolean)
}
