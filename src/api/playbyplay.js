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

// The two-column pitch ladder (see PlayByPlay.jsx) sorts each pitch into a
// ball column or a strike column, keeping its 1-based place in the at-bat.
// Anything that isn't a plain ball is a strike for column purposes (called,
// swinging, foul), and a ball put in play shows as an 'X' rather than a
// number. Returns { side: 'ball' | 'strike', label } per pitch, in order.
export function pitchLadder(codes) {
  return codes.map((code, i) => {
    const cat = pitchDotCategory(code)
    if (cat === 'ball') return { side: 'ball', label: String(i + 1) }
    if (cat === 'inplay') return { side: 'strike', label: 'X' }
    return { side: 'strike', label: String(i + 1) }
  })
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

// Scorebook shorthand for the BATTER's own out on their own plate appearance
// — the terse fielding notation (K, 6-3, L7, F8…) shown as a badge alongside
// the play's full prose description. The fielding chain describes how the
// batted ball itself was fielded (fly/line/ground). Only ever called for that
// case: a runner put out later, on a different play than their own PA, keeps
// whatever their own card already says (they still walked, singled, etc.) —
// see the out-attribution loop below, which attaches only the sequence number
// in that case, not a replacement description.

// How-reached codes keyed on the play's eventType, for a batter who was NOT
// retired on his own plate appearance.
const REACH_CODES = {
  single: '1B',
  double: '2B',
  triple: '3B',
  home_run: 'HR',
  walk: 'BB',
  intent_walk: 'IBB',
  hit_by_pitch: 'HBP',
  fielders_choice: 'FC',
  fielders_choice_out: 'FC',
  catcher_interf: 'CI',
}

// The Numbers Game #22-style scorebook denotation for a batter's own plate
// appearance — shown above the per-play diamond. Either how he reached (1B,
// 2B, HR, BB, E6, FC…) or how he was retired (K, F8, L7, 6-3…). A called
// third strike returns { calledLooking: true } so the card can draw the
// customary backwards K instead of a code string.
function scorebookCode(play, batterRunner) {
  const et = play.result?.eventType
  if (REACH_CODES[et]) return { code: REACH_CODES[et] }

  const desc = play.result?.description ?? ''
  const chain = (batterRunner?.credits ?? []).map((c) => c.position.code)

  if (et === 'field_error') {
    const errPos = (batterRunner?.credits ?? []).find((c) => /error/.test(c.credit ?? ''))
    return { code: `E${errPos?.position.code ?? ''}` }
  }
  if (/strikes? out swinging/i.test(desc)) return { code: 'K' }
  if (/called out on strikes/i.test(desc)) return { calledLooking: true }
  if (/lines? (out|into)/i.test(desc)) return { code: `L${chain[chain.length - 1] ?? ''}` }
  if (/pops? (out|into)/i.test(desc)) return { code: `F${chain[chain.length - 1] ?? ''}` }
  if (/flies? (out|into)/i.test(desc)) return { code: `F${chain[chain.length - 1] ?? ''}` }
  return { code: chain.join('-') }
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

      const cardIndex = entries.length
      const batterRunner = runners.find((r) => r.details?.runner?.id === batterId)
      const card = {
        kind: 'atbat',
        batterId,
        batter,
        pitches,
        rbi: play.result?.rbi ?? 0,
        // The full prose account of the play (batter name trimmed off the
        // front — it's already on the card). Shown for every plate
        // appearance, out or not.
        desc: trimLeadingName(play.result?.description, batter.fullName),
        // Scorebook denotation drawn above the diamond (1B, F8, 6-3…).
        ...scorebookCode(play, batterRunner),
        outNumber: null,
        // Furthest base this batter reached / whether he scored — filled in
        // by the advancement pass below, which follows him as a baserunner
        // across the rest of the half.
        reached: 0,
        scored: false,
      }
      entries.push(card)
      originIndex.set(batterId, cardIndex)

      if (batterRunner?.movement?.isOut) {
        card.outNumber = batterRunner.movement.outNumber
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

  // Advancement pass: follow each batter as a baserunner across every play of
  // the half and record the furthest base he reached (and whether he scored),
  // so his own card's diamond can shade the bases he legged out — filled solid
  // when he came around to score. An out on the bases doesn't advance him; he
  // keeps whatever base he'd already reached.
  const BASE_NUM = { '1B': 1, '2B': 2, '3B': 3 }
  const progress = new Map() // runnerId -> furthest base (1-3, or 4 for a run)
  for (const play of plays) {
    for (const r of play.runners ?? []) {
      const rid = r.details?.runner?.id
      if (rid == null || r.movement?.isOut) continue
      const end = r.movement?.end
      const base = end === 'score' ? 4 : (BASE_NUM[end] ?? 0)
      if (base > (progress.get(rid) ?? 0)) progress.set(rid, base)
    }
  }
  for (const [rid, cardIndex] of originIndex) {
    const base = progress.get(rid) ?? 0
    entries[cardIndex].scored = base === 4
    entries[cardIndex].reached = base === 4 ? 4 : base
  }

  return entries
}
