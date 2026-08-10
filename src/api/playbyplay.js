// Per-plate-appearance play-by-play feed for a half-inning — pitch sequence,
// scorebook-style out notation, and RBI — interleaved with mound visits and
// pitching changes. This is score-revealing (result descriptions give away
// outs/hits/runs), so like linescore.js and derive.js it must only be called
// from inside a SealBox's reveal render function, never at render top-level.
//
// Field paths verified against the July 5 2026 Brewers @ D-backs game
// (gamePk 825061, see mlb.js):
//  - Each play's `runners[]` entry carries its own `credits[]` (fielder id +
//    position code + 'f_putout'/'f_assist') and, when that runner was put
//    out, `movement.outNumber` — the half-inning's own 1/2/3 sequence number,
//    supplied directly by the feed. No need to derive it from `count.outs`.
//  - A force play or double play can put out a runner who is NOT the current
//    batter (e.g. the lead runner doubled off second). That runner's own
//    `runners[]` entry is what carries their out — the badge belongs on
//    THEIR plate-appearance card, which may be several cards back, not on
//    the card for the play where the out physically happened.
//  - Mound visits and pitching changes are not separate top-level plays —
//    they show up as non-pitch entries inside a play's own `playEvents[]`
//    (details.eventType 'mound_visit' / 'pitching_substitution'), usually at
//    the start of whichever batter's plate appearance follows the stoppage.
//    Verified live (July 15 2026 All-Star Game, gamePk 823443): a stoppage
//    can also land trailing in the playEvents of the PA that just ended,
//    rather than leading the next one. Either way it's nested, not its own
//    top-level play — but mid-poll the live feed can transiently surface it
//    AS one anyway, with `matchup.batter` carrying over the previous batter
//    and `result.description` holding the substitution prose instead of a
//    real result. `result.type` distinguishes a genuine plate appearance
//    ('atBat') from this kind of transient/action entry — see `isRealPA`.
//  - A handful of eventTypes (caught stealing, pickoffs, wild pitches...)
//    describe a baserunning event with no batting result for whoever is
//    currently up — those get no RESULT card, but their runners[] is still
//    walked for out attribution, and when such a play carries pitch events
//    (an inning-ending caught stealing mid-count) the batter who was up gets
//    an INTERRUPTED at-bat card so those pitches aren't lost (verified
//    against gamePk 823764, bottom 7: Luis Lara 1-2 when Cooper Pratt was
//    caught stealing for out 3; Lara restarted at 0-0 leading off the 8th).
//  - Each runner's `movement.end` ('1B'/'2B'/'3B'/'score'/null) is walked
//    across the whole half to find how far each batter got as a baserunner
//    (his card's diamond shades the bases he legged out, solid if he scored)
//    and how he advanced each leg on a later play (BB/GO/2B…). An out on the
//    bases (`movement.isOut`) doesn't advance him.
//
// Split (ADR-0038, check-file-size.mjs) into src/api/playbyplay/ — one module
// per concern, catalogued in that directory. This file is a thin re-export so
// no caller needs to change: see src/api/playbyplay/*.js for the actual code.

export {
  NON_PA_EVENT_TYPES,
  GAME_ADVISORY_EVENT_TYPE,
  BASERUNNING_NOTE_EVENT_TYPES,
} from './playbyplay/eventTypes.js'

export {
  sentenceCaseEventText,
  moundVisitsAllowed,
  moundVisitRemainings,
  pitchingChangePitcher,
  defensiveChangeFielder,
  pinchRunningPlayers,
  pinchHittingBatter,
  runnerLastName,
} from './playbyplay/notificationCards.js'

export {
  WHIFF_CODES,
  FOUL_CODES,
  FOUL_ENDS_AB_CODES,
  BALL_CODES,
  pitchCallCode,
  pitchDotCategory,
  pitchLadder,
  hasPitchLocations,
} from './playbyplay/pitchInfo.js'

export { interruptedCode, battingSlot } from './playbyplay/advanceCode.js'

export {
  firstRunPlay,
  firstPAIndexByBatter,
  firstRispPAIndexByBatter,
} from './playbyplay/firsts.js'

export { nextStepBoundary, lastVisibleAtBatIndex, deriveLiveState } from './playbyplay/entriesView.js'

export { computeHalfInningFeed } from './playbyplay/halfInningFeed.js'
