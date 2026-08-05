// The in-game progress walk that every live (entering-tense) note builder
// folds into its "that's No. 16 this season" counts. Split out of
// ../callout-notes.js — see that file's header for the two-tenses rule
// (ADR-0014) this whole directory implements.

import { NON_PA_EVENT_TYPES, FOUL_CODES, pitchCallCode } from '../playbyplay.js'
import { HIT_TRIGGERS, STRIKEOUT_EVENTS, SB_EVENTS, CS_EVENTS, ON_BASE_EVENTS } from './shared.js'

// --- in-game progress ----------------------------------------------------------
// One pass over the whole feed producing, for each play, the cumulative
// in-game counts the note builders fold into their entering numbers — so a
// card can read "that's No. 16 this season" instead of last night's 15.
// Snapshots are THROUGH the play, inclusive, so a note on a revealed card
// only ever counts plays the reader has also revealed. REVEAL-ONLY, same rule
// as the other whole-feed walks here (results give away hits/runs).
//
// Returns { byPlay: Map(atBatIndex -> snapshot), reached: Set(batterId),
//           sbGame: Map(runnerId -> { n, firstInning, beforeCaught }),
//           caught: Map(runnerId -> inning) }:
//   snapshot = {
//     cats: { hr/triples/doubles/bb_b/hbp: n } — the play's own batter's counts,
//     reachedBefore / reachedHere — his on-base state (streak extension),
//     pitcherK — the play's pitcher's strikeouts so far,
//     sb: Map(runnerId -> { n, caughtBefore }) — steals credited on THIS play,
//   }
// `reached` is every batter who got aboard at any point (the roll-up's
// streak-ended check); `sbGame`/`caught` are each runner's whole-game steal
// tally (with the inning of his first bag, and how many came before any CS)
// and the inning he was first caught — the roll-up's narrative steal wording.
// Steals are counted off each play's own playEvents — the same path the SB
// leader note triggers on — so the two can't disagree; a steal logged as its
// own top-level play (no playEvents entry) is simply not folded in, an
// undercount never an overclaim.
export function computeCalloutProgress(feed) {
  const byPlay = new Map()
  const catByBatter = new Map() // batterId -> { [cat]: n }
  const reached = new Set()
  const kByPitcher = new Map()
  const sbByRunner = new Map()
  const caughtRunners = new Set()
  const sbGame = new Map() // runnerId -> { n, firstInning, beforeCaught }
  const caught = new Map() // runnerId -> inning of his first CS tonight
  const foulsByBatter = new Map() // batterId -> fouls hit tonight (raw count)

  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const idx = play.about?.atBatIndex
    const batterId = play.matchup?.batter?.id
    const pitcherId = play.matchup?.pitcher?.id
    const eventType = play.result?.eventType ?? null
    const isPA = !NON_PA_EVENT_TYPES.has(eventType)

    const reachedBefore = batterId != null && reached.has(batterId)
    const reachedHere = batterId != null && isPA && ON_BASE_EVENTS.has(eventType)

    if (batterId != null && isPA) {
      const trig = HIT_TRIGGERS[eventType]
      if (trig) {
        const cats = catByBatter.get(batterId) ?? {}
        cats[trig.cat] = (cats[trig.cat] ?? 0) + 1
        catByBatter.set(batterId, cats)
      }
      if (reachedHere) reached.add(batterId)
    }
    if (pitcherId != null && STRIKEOUT_EVENTS.has(eventType)) {
      kByPitcher.set(pitcherId, (kByPitcher.get(pitcherId) ?? 0) + 1)
    }

    const sbHere = new Map()
    for (const e of play.playEvents ?? []) {
      if (e.isPitch) {
        // Tonight's raw foul tally per batter — feeds the box-score
        // restatement of the foulSpoiler card ("Fouled off 6 tonight…").
        const code = pitchCallCode(e)
        if (batterId != null && code && FOUL_CODES.has(code)) {
          foulsByBatter.set(batterId, (foulsByBatter.get(batterId) ?? 0) + 1)
        }
        continue
      }
      const et = e.details?.eventType
      const rid = e.player?.id
      if (rid == null) continue
      if (SB_EVENTS.has(et)) {
        const caughtBefore = caughtRunners.has(rid)
        const n = (sbByRunner.get(rid) ?? 0) + 1
        sbByRunner.set(rid, n)
        sbHere.set(rid, { n, caughtBefore })
        const g = sbGame.get(rid) ?? { n: 0, firstInning: play.about?.inning ?? null, beforeCaught: 0 }
        g.n = n
        if (!caughtBefore) g.beforeCaught = n
        sbGame.set(rid, g)
      } else if (CS_EVENTS.has(et)) {
        caughtRunners.add(rid)
        if (!caught.has(rid)) caught.set(rid, play.about?.inning ?? null)
      }
    }

    if (idx == null) continue
    byPlay.set(idx, {
      cats: batterId != null ? { ...(catByBatter.get(batterId) ?? {}) } : {},
      reachedBefore,
      reachedHere,
      pitcherK: pitcherId != null ? kByPitcher.get(pitcherId) ?? 0 : 0,
      sb: sbHere,
    })
  }
  return { byPlay, reached, sbGame, caught, foulsByBatter }
}
