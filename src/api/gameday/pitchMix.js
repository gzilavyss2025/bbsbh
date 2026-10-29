// Tonight's pitch mix for the arm on the mound (Gary, 2026-10-29): every pitch he has thrown that
// the reader has on screen, each tagged so the card can drill in — by the batter's hand, by what
// the pitch did, by inning, and by the time through the order. REVEAL-ONLY (ADR-0001): a pitch's
// outcome ("in play") is a result, so call it only inside a SealBox reveal render function.
//
// THE CLAMP is dayLine.js's: earlier halves count whole, the reader's half up to the last plate
// appearance on screen (stepCutAtBatIndex, built WITH the step cap), and a half past
// revealedThrough + 1 answers null. The open, still-live plate appearance counts for nothing until
// it ends, the same as his line's pitch count, so the two always agree — EXCEPT in pitch mode:
// `open` ({ count, sub }, the reader's sub-step cursor, ADR-0123) adds the pitches of the at-bat
// being stepped through that are already on screen (subSteps.js openAtBat, its first `sub` steps),
// so the mix moves with every pitch tapped and never one pitch early.
//
// Time through the order is per batter: the nth time this batter has stood in against him tonight.

import { halfIndex } from '../select.js'
import { stepCutAtBatIndex, safeStep } from './stepCut.js'
import { openAtBat } from './subSteps.js'

const WHIFF = new Set(['S', 'W', 'M', 'Q'])
const FOUL = new Set(['F', 'T', 'L', 'R', 'O'])

// One pitch's outcome bucket: 'ball' | 'called' | 'whiff' | 'foul' | 'inplay'.
export function pitchOutcome(details = {}) {
  const code = details.call?.code ?? details.code ?? ''
  if (details.isInPlay) return 'inplay'
  if (code === 'C') return 'called'
  if (WHIFF.has(code)) return 'whiff'
  if (FOUL.has(code)) return 'foul'
  return 'ball'
}

// Every on-screen pitch he has thrown tonight, oldest first:
// [{ type, typeName, hand: 'L'|'R', outcome, mph, inning, tto }]. Null past the reader's reach.
export function tonightPitches(feed, pitcherId, { inning, half, step = null, revealedThrough, open = null }) {
  if (pitcherId == null || !inning || !half) return null
  const here = halfIndex(inning, half)
  if (here > (revealedThrough ?? -1) + 1) return null
  const cut = stepCutAtBatIndex(feed, inning, half, safeStep(step, here, revealedThrough))
  const faced = new Map()
  const out = []
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const inn = play?.about?.inning
    const h = play?.about?.halfInning
    if (!inn || !h) continue
    const i = halfIndex(inn, h)
    if (i > here) break
    if (i === here && (play.about?.atBatIndex ?? Infinity) > cut) continue
    if (play.matchup?.pitcher?.id !== pitcherId) continue
    const batterId = play.matchup?.batter?.id
    const tto = (faced.get(batterId) ?? 0) + 1
    faced.set(batterId, tto)
    // A change in the middle of the plate appearance: the pitches before it were the other man's.
    const events = play.playEvents ?? []
    const from = events.findLastIndex((ev) => ev?.details?.eventType === 'pitching_substitution') + 1
    for (const ev of events.slice(from)) {
      if (!ev?.isPitch) continue
      out.push({
        type: ev.details?.type?.code ?? '',
        typeName: ev.details?.type?.description ?? '',
        hand: play.matchup?.batSide?.code === 'L' ? 'L' : 'R',
        outcome: pitchOutcome(ev.details),
        mph: ev.pitchData?.startSpeed ?? null,
        inning: inn,
        tto,
      })
    }
  }
  if (open?.sub > 0) out.push(...openPitches(feed, pitcherId, inning, half, open, faced))
  return out
}

// The shown pitches of the at-bat being stepped through, his only.
function openPitches(feed, pitcherId, inning, half, { count, sub }, faced) {
  const o = openAtBat(feed, inning, half, count)
  if (!o?.play || o.play.matchup?.pitcher?.id !== pitcherId) return []
  const events = o.play.playEvents ?? []
  const tto = (faced.get(o.play.matchup?.batter?.id) ?? 0) + 1
  return o.steps
    .slice(0, sub)
    .map((s) => events.find((e) => e.index === s.index))
    .filter((e) => e?.isPitch)
    .map((e) => ({
      type: e.details?.type?.code ?? '',
      typeName: e.details?.type?.description ?? '',
      hand: o.play.matchup?.batSide?.code === 'L' ? 'L' : 'R',
      outcome: pitchOutcome(e.details),
      mph: e.pitchData?.startSpeed ?? null,
      inning,
      tto,
    }))
}

// The mix of a pitch list: [{ type, typeName, n, share, mph }], most thrown first; `mph` is the
// average release speed of the pitches that carry one (null when none do). Pure.
export function mixOf(pitches) {
  const by = new Map()
  for (const p of pitches ?? []) {
    const row = by.get(p.type) ?? { type: p.type, typeName: p.typeName, n: 0, speed: 0, timed: 0 }
    row.n += 1
    if (typeof p.mph === 'number') {
      row.speed += p.mph
      row.timed += 1
    }
    by.set(p.type, row)
  }
  const total = pitches?.length ?? 0
  return [...by.values()]
    .map(({ speed, timed, ...r }) => ({ ...r, share: total ? r.n / total : 0, mph: timed ? speed / timed : null }))
    .sort((a, b) => b.n - a.n)
}
