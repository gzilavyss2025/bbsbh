import { computeHalfInningFeed, nextStepBoundary } from '../../../../api/playbyplay.js'
import { lineupEntering } from '../../../../api/battingorder.js'
import { battingSideOf, stepCutAtBatIndex } from '../../../../api/gameday/stepCut.js'
import { halfIndex } from '../../../../api/select.js'
import { openAtBat } from '../../../../api/gameday/subSteps.js'
import { legAdvanceCode } from '../../../../api/playbyplay/advanceCode.js'

// What the panels read at the reader's cursor. REVEAL-ONLY (cutAt): call it inside a SealBox
// reveal render function, as the panels do.

// A called third strike has no code of its own (scorebookCode.js); the chip says K, as the trail does.
export const chipCode = (card) => card.code || (card.calledLooking ? 'K' : '')

// The at-bat cards on screen at `step`, at the cap PlayByPlay renders (a first entry that is a note
// bundles forward to the first at-bat), and whether the half has plays left. `step` null: committed.
export function cutAt(feed, inning, half, step) {
  if (step === 0) return { cards: [], cap: 0, more: true } // a reached half with nothing stepped yet
  const side = battingSideOf(half)
  let entries = computeHalfInningFeed(feed, inning, half, side, step)
  // `hitters` is every batter on screen in order, an announced pinch hitter included, for the order's names.
  const hittersOf = (list) => list.flatMap((e) => (e.kind === 'atbat' ? [e.batter?.id] : e.eventType === 'pinch_hitting' ? [e.playerId] : []))
  if (step == null) return { cards: entries.filter((e) => e.kind === 'atbat'), hitters: hittersOf(entries), cap: null, more: false }
  const cap = Math.max(step, nextStepBoundary(entries, 0))
  if (cap > step) entries = computeHalfInningFeed(feed, inning, half, side, cap)
  const shown = entries.slice(0, cap)
  return { cards: shown.filter((e) => e.kind === 'atbat'), hitters: hittersOf(shown), cap, more: entries.length > cap }
}

// The batting order entering the half (lineupEntering gates itself), each slot with the codes of
// every at-bat on screen by anyone who held it, so a pinch hitter's at-bat stays on its row. A slot
// names the last man on screen to bat in it (`hitters`, cutAt's), so an announced pinch hitter takes it.
export function orderAt(feed, side, inning, half, mark, cards, hitters = []) {
  const slotOf = (id) => Math.floor(Number(feed?.liveData?.boxscore?.teams?.[side]?.players?.[`ID${id}`]?.battingOrder) / 100)
  return (lineupEntering(feed, side, inning, half, mark) ?? []).map(({ slot, entries }) => {
    const ph = hitters.findLast((id) => slotOf(id) === slot)
    const now = ph != null && ph !== entries.at(-1).id ? pinchHitter(feed, ph) : entries.at(-1)
    const mine = cards.filter((c) => slotOf(c.batter?.id) === slot)
    // `trip` is his latest at-bat when he reached on it (the diamond reads its legs); `outcome` is its code
    // when he did not (K, F9), drawn in the diamond's column.
    const latest = mine.at(-1) ?? null
    const trip = latest && (latest.reached > 0 || latest.scored) ? latest : null
    const outcome = latest && !trip ? chipCode(latest) || null : null
    return { slot, id: now.id, last: now.last, first: now.first, jersey: now.jersey, position: now.position, codes: mine.map(chipCode), trip, outcome, looking: !!(outcome && latest.calledLooking) }
  })
}

// The base running of the at-bat being stepped through, laid over each runner's trip (Gary, 2026-10-29: a
// steal shown mid at-bat moves his diamond): only the open at-bat's shown sub-steps (`open`, up to `sub`),
// so a runner's diamond moves exactly when the event card shows it, never sooner. An out on the bases
// marks where he was put out.
const BASE = { '1B': 1, '2B': 2, '3B': 3, score: 4 }
export function withOpenRunning(rows, feed, inning, half, open) {
  if (!(open?.sub > 0)) return rows
  const o = openAtBat(feed, inning, half, open.count)
  if (!o?.play) return rows
  const events = o.steps.slice(0, open.sub).filter((s) => s.kind === 'event' && s.playerId != null)
  if (!events.length) return rows
  const runners = o.play.runners ?? []
  return rows.map((r) => {
    if (!r.trip || r.trip.scored) return r
    let trip = r.trip
    for (const s of events.filter((e) => e.playerId === r.id)) {
      for (const leg of runners.filter((x) => x.details?.playIndex === s.index && x.details?.runner?.id === r.id)) {
        const to = BASE[leg.movement?.end]
        if (leg.movement?.isOut) trip = { ...trip, outAt: BASE[leg.movement?.outBase] ?? (trip.reached ?? 0) + 1, outCode: legAdvanceCode(o.play, leg) || 'CS' }
        else if (to) trip = { ...trip, reached: Math.max(trip.reached ?? 0, to), scored: to === 4 || trip.scored, legNotations: { ...(trip.legNotations ?? {}), [to]: { code: legAdvanceCode(o.play, leg), slot: null } } }
      }
    }
    return trip === r.trip ? r : { ...r, trip }
  })
}

// A revealed half read back at one of its at-bats (Gary, 2026-10-29: a chip tapped, or the read-back walk):
// the game AS OF that at-bat, so the band, the line score and the Due up show what they showed then. Only
// ever less than the reveal mark allows: the half is under it. `atBatIndex` is the last at-bat counted.
// { step, mark, runsInProgress } for the panels and the band, or null when that at-bat is not in the half.
const HITS = new Set(['single', 'double', 'triple', 'home_run'])
export const walkCut = (feed, inning, half, open) => (open?.sub > 0 ? openAtBat(feed, inning, half, open.count)?.done?.at(-1)?.atBatIndex ?? -1 : null)

export function rewindTo(feed, inning, half, atBatIndex) {
  if (atBatIndex == null) return null
  if (atBatIndex < 0) return { step: 0, mark: halfIndex(inning, half) - 1, runsInProgress: { idx: halfIndex(inning, half), runs: 0, hits: 0 } }
  let step = null
  for (let k = 1; k < 200; k++) {
    const cut = stepCutAtBatIndex(feed, inning, half, k)
    if (cut === atBatIndex) { step = k; break }
    if (cut > atBatIndex) break
  }
  if (step == null) return null
  const idx = halfIndex(inning, half)
  const side = battingSideOf(half)
  const key = side === 'away' ? 'awayScore' : 'homeScore'
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const mine = plays.filter((p) => p.about?.inning === inning && p.about?.halfInning === half && (p.about?.atBatIndex ?? Infinity) <= atBatIndex)
  const first = plays.findIndex((p) => p.about?.inning === inning && p.about?.halfInning === half)
  const before = first > 0 ? plays[first - 1]?.result?.[key] ?? 0 : 0
  const after = mine.at(-1)?.result?.[key] ?? before
  const hits = mine.filter((p) => HITS.has(p.result?.eventType)).length
  return { step, mark: idx - 1, runsInProgress: { idx, runs: after - before, hits } }
}

// A pinch hitter's row: his own name and number, PH until he takes a spot in the field.
function pinchHitter(feed, id) {
  const p = feed?.gameData?.players?.[`ID${id}`] ?? {}
  return { id, last: p.useLastName ?? p.lastName ?? '', first: p.useName ?? p.firstName ?? '', jersey: p.primaryNumber ?? '', position: 'PH' }
}
