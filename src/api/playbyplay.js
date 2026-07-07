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
//  - A handful of eventTypes (caught stealing, pickoffs, wild pitches...)
//    describe a baserunning event with no batting result for whoever is
//    currently up — those don't get their own card, but their runners[] is
//    still walked for out attribution.
//  - Each play's `matchup.postOnFirst/Second/Third` is the base state after
//    that specific play resolves, already folding in anything since the
//    previous card (steals, pickoffs, wild pitches) — no separate bookkeeping
//    needed, just read it off the play whose card is being built.
//  - Hit coordinates (`playEvents[].hitData.coordinates`) are Statcast-only:
//    present for MLB balls in play, absent for MiLB and for BB/K/HBP plate
//    appearances. `hitLocation` is null in both cases and PlayDiamond omits
//    the marker rather than guessing.

import { personNameParts } from './select.js'

// Top-level plays that are baserunning events, not plate appearances: the
// batter's at-bat continues (or restarts next inning) as its own later play.
// Shared with derive.js and pitchers.js, whose PA / batters-faced counts must
// skip these or an inning-ending caught stealing mid-count double-counts the
// batter (both files still accumulate the play's PITCHES — those were
// genuinely thrown and are not re-listed in the resumed at-bat).
export const NON_PA_EVENT_TYPES = new Set([
  'stolen_base_2b', 'stolen_base_3b', 'stolen_base_home',
  'caught_stealing_2b', 'caught_stealing_3b', 'caught_stealing_home',
  'pickoff_1b', 'pickoff_2b', 'pickoff_3b',
  'pickoff_caught_stealing_2b', 'pickoff_caught_stealing_3b', 'pickoff_caught_stealing_home',
  'wild_pitch', 'passed_ball', 'balk',
])

// Swinging strike, swinging strike (blocked). Shared with derive.js.
export const WHIFF_CODES = new Set(['S', 'W'])
const FOUL_CODES = new Set(['F', 'L', 'T']) // foul, foul bunt, foul tip
const INPLAY_CODES = new Set(['D', 'X', 'E']) // in play: no out / out(s) / run(s)

// A pitch event's call code, wherever this feed variant put it. Shared with
// derive.js so the two never drift on the feed shape.
export function pitchCallCode(e) {
  return e?.details?.call?.code ?? e?.details?.code
}

// Classifies one pitch call code into the five dots the card renders.
// Unrecognized codes fall back to 'ball' rather than throwing.
export function pitchDotCategory(code) {
  if (code === 'C') return 'called'
  if (WHIFF_CODES.has(code)) return 'whiff'
  if (FOUL_CODES.has(code)) return 'foul'
  if (INPLAY_CODES.has(code)) return 'inplay'
  return 'ball'
}

function resolveBatter(feed, side, id) {
  const person = feed?.gameData?.players?.[`ID${id}`] ?? {}
  const box = feed?.liveData?.boxscore?.teams?.[side]?.players?.[`ID${id}`] ?? {}
  return {
    id,
    fullName: (person.fullName ?? '').trim(),
    ...personNameParts(person),
    pos: box.position?.abbreviation ?? '',
  }
}

// Strips the batter's own name off the front of an MLB description sentence
// (they're already named on the card) — descriptions are templated and
// consistently lead with the exact full name, except for the rare
// replay-challenge phrasing, so an unmatched prefix just falls back to the
// untrimmed sentence rather than mangling it.
function trimLeadingName(description, fullName) {
  if (!description) return ''
  if (fullName && description.startsWith(fullName)) {
    const rest = description.slice(fullName.length).trim()
    if (rest) return rest.charAt(0).toUpperCase() + rest.slice(1)
  }
  return description
}

// Builds the scorebook-style out description for the BATTER's own out on
// their own plate appearance — the fielding chain describes how the batted
// ball itself was fielded (fly/line/ground). Only ever called for that case:
// a runner put out later, on a different play than their own PA, keeps
// whatever their own card already says (they still walked, singled, etc.) —
// see the out-attribution loop below, which attaches only the sequence
// number in that case, not a replacement description.
function describeOut(play, runnerEntry) {
  const desc = play.result?.description ?? ''
  const chain = (runnerEntry.credits ?? []).map((c) => c.position.code)

  if (/strikes? out swinging/i.test(desc)) return { label: 'Strikeout', notation: 'K' }
  if (/called out on strikes/i.test(desc)) return { label: 'Strikeout', calledLooking: true }
  if (/sacrifice fly|sac fly/i.test(desc)) return { label: 'Sac fly', notation: chain.join('-') }
  if (/sacrifice bunt|sac bunt/i.test(desc)) return { label: 'Sac bunt', notation: chain.join('-') }
  if (/lines? (out|into)/i.test(desc)) return { label: 'Lineout', notation: `L${chain[chain.length - 1] ?? ''}` }
  if (/pops? (out|into)/i.test(desc)) return { label: 'Pop out', notation: `F${chain[chain.length - 1] ?? ''}` }
  if (/flies? (out|into)/i.test(desc)) return { label: 'Flyout', notation: `F${chain[chain.length - 1] ?? ''}` }
  return { label: /bunt/i.test(desc) ? 'Bunt groundout' : 'Groundout', notation: chain.join('-') }
}

// Ordered feed for one half-inning: plate-appearance cards interleaved with
// mound-visit / pitching-change notes, first-at-bat first. `battingSide` is
// 'away' | 'home' (top bats away, bottom bats home — same convention as the
// rest of InningViewer).
export function computeHalfInningFeed(feed, inningNum, half, battingSide) {
  const plays = (feed?.liveData?.plays?.allPlays ?? []).filter(
    (p) => p?.about?.inning === inningNum && p?.about?.halfInning === half,
  )

  const entries = []
  const originIndex = new Map() // batterId -> index of their own atbat card

  for (const play of plays) {
    for (const e of play.playEvents ?? []) {
      if (e.isPitch) continue
      const et = e.details?.eventType
      if (et === 'mound_visit' || et === 'pitching_substitution') {
        entries.push({ kind: 'event', eventType: et, text: e.details.description })
      }
    }

    const batterId = play.matchup?.batter?.id
    const isRealPA = batterId != null && !NON_PA_EVENT_TYPES.has(play.result?.eventType)
    const runners = play.runners ?? []

    if (isRealPA) {
      const batter = resolveBatter(feed, battingSide, batterId)
      const pitches = (play.playEvents ?? [])
        .filter((e) => e.isPitch)
        .map(pitchCallCode)

      // Base state after this play resolves, straight from the feed — already
      // accounts for anything that happened since the last card (steals,
      // pickoffs, wild pitches...), which don't get cards of their own.
      const basesAfter = [
        Boolean(play.matchup?.postOnFirst),
        Boolean(play.matchup?.postOnSecond),
        Boolean(play.matchup?.postOnThird),
      ]

      // Statcast hit coordinates, when the ball was put in play. MLB-only —
      // MiLB feeds and no-contact plate appearances (BB/K/HBP) leave this
      // null, and PlayDiamond just omits the marker in that case.
      const inPlayEvent = (play.playEvents ?? []).find(
        (e) => e.isPitch && INPLAY_CODES.has(pitchCallCode(e)) && e.hitData?.coordinates,
      )
      const hitLocation = inPlayEvent
        ? { x: inPlayEvent.hitData.coordinates.coordX, y: inPlayEvent.hitData.coordinates.coordY }
        : null

      const cardIndex = entries.length
      const card = {
        kind: 'atbat',
        batterId,
        batter,
        pitches,
        rbi: play.result?.rbi ?? 0,
        hitText: null,
        out: null,
        outNumber: null,
        basesAfter,
        hitLocation,
      }
      entries.push(card)
      originIndex.set(batterId, cardIndex)

      const batterRunner = runners.find((r) => r.details?.runner?.id === batterId)
      if (batterRunner?.movement?.isOut) {
        card.out = describeOut(play, batterRunner)
        card.outNumber = batterRunner.movement.outNumber
      } else {
        card.hitText = trimLeadingName(play.result?.description, batter.fullName)
      }
    }

    // A runner other than this play's batter can also be put out here — a
    // force, a caught stealing, the back half of a double play. That runner
    // already has their own card from when they batted (walked, singled...),
    // several cards back. This later out only adds their sequence number to
    // that card; it doesn't replace how they got on base with a description
    // of the play that ended it.
    for (const r of runners) {
      const rid = r.details?.runner?.id
      if (rid == null || rid === batterId || !r.movement?.isOut) continue
      const origin = originIndex.get(rid)
      if (origin == null) continue // no known origin card (e.g. a pinch-runner) — nothing to attach to
      entries[origin].outNumber = r.movement.outNumber
    }
  }

  return entries
}
