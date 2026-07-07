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
//  - Each runner's `movement.end` ('1B'/'2B'/'3B'/'score'/null) is walked
//    across the whole half to find how far each batter got as a baserunner
//    (his card's diamond shades the bases he legged out, solid if he scored)
//    and how he advanced each leg on a later play (BB/GO/2B…). An out on the
//    bases (`movement.isOut`) doesn't advance him.

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

const HIT_EVENTS = new Set(['single', 'double', 'triple', 'home_run'])

// The Numbers Game #22-style scorebook denotation for a batter's own plate
// appearance — shown above the per-play diamond. Either how he reached (1B,
// 2B, HR, BB, E6, FC…) or how he was retired (K, F8, L7, 6-3…). Returns a
// `kind` ('hit' | 'error' | 'reach' | 'out') so the card can ink hits green
// and errors red. A called third strike returns { calledLooking: true } so the
// card can draw the customary backwards K instead of a code string.
function scorebookCode(play, batterRunner) {
  const et = play.result?.eventType
  if (REACH_CODES[et]) return { code: REACH_CODES[et], codeKind: HIT_EVENTS.has(et) ? 'hit' : 'reach' }

  const desc = play.result?.description ?? ''
  const chain = (batterRunner?.credits ?? []).map((c) => c.position.code)

  if (et === 'field_error') {
    const errPos = (batterRunner?.credits ?? []).find((c) => /error/.test(c.credit ?? ''))
    return { code: `E${errPos?.position.code ?? ''}`, codeKind: 'error' }
  }
  if (/strikes? out swinging/i.test(desc)) return { code: 'K', codeKind: 'out' }
  if (/called out on strikes/i.test(desc)) return { calledLooking: true, codeKind: 'out' }
  if (/lines? (out|into)/i.test(desc)) return { code: `L${chain[chain.length - 1] ?? ''}`, codeKind: 'out' }
  if (/pops? (out|into)/i.test(desc)) return { code: `F${chain[chain.length - 1] ?? ''}`, codeKind: 'out' }
  if (/flies? (out|into)/i.test(desc)) return { code: `F${chain[chain.length - 1] ?? ''}`, codeKind: 'out' }
  return { code: chain.join('-'), codeKind: 'out' }
}

// Short code for how a runner ADVANCED to a base on a given play — written by
// the base he moved up to, scorebook-style (BB forced him over, GO/FO moved
// him up on an out, 1B/2B on the hit that drove him, SB stole, WP/PB/BK, etc).
const ADVANCE_CODES = {
  single: '1B', double: '2B', triple: '3B', home_run: 'HR',
  walk: 'BB', intent_walk: 'IBB', hit_by_pitch: 'HBP',
  sac_fly: 'SF', sac_bunt: 'SAC',
  stolen_base_2b: 'SB', stolen_base_3b: 'SB', stolen_base_home: 'SB',
  wild_pitch: 'WP', passed_ball: 'PB', balk: 'BK',
  field_error: 'E', fielders_choice: 'FC', fielders_choice_out: 'FC',
}

function advanceCode(play) {
  const et = play.result?.eventType
  if (ADVANCE_CODES[et]) return ADVANCE_CODES[et]
  if (/(flies|fly ball|pops|lines|line drive|sacrifice fly)/i.test(play.result?.description ?? '')) return 'FO'
  return 'GO'
}

const BASE_NUM = { '1B': 1, '2B': 2, '3B': 3, '4B': 4, score: 4 }

// The lineup slot (1-9) a player bats in, from his boxscore battingOrder —
// starters are exact multiples of 100 (500 → 5), subs are offset (503 → 5).
// Used to credit which hitter drove a runner over.
function battingSlot(feed, side, id) {
  const order = feed?.liveData?.boxscore?.teams?.[side]?.players?.[`ID${id}`]?.battingOrder
  const n = parseInt(order, 10)
  return Number.isFinite(n) ? Math.floor(n / 100) : null
}

// How a runner (not the batter) was retired on the bases, for the notation by
// the base where his path is capped: CS caught stealing, PK pickoff, else the
// fielding chain that put him out (6-4, 4-6…).
function runnerOutCode(play, runnerEntry) {
  const et = play.result?.eventType ?? ''
  if (et.startsWith('caught_stealing')) return 'CS'
  if (et.startsWith('pickoff')) return 'PK'
  const chain = (runnerEntry.credits ?? [])
    .filter((c) => /putout|assist/.test(c.credit ?? ''))
    .map((c) => c.position.code)
  return chain.join('-') || 'OUT'
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
      // Where and how he was cut down, for the diamond's tick + out code.
      entries[origin].outAt = BASE_NUM[r.movement.outBase] ?? null
      entries[origin].outCode = runnerOutCode(play, r)
    }
  }

  // Advancement pass: follow each batter as a baserunner across every play of
  // the half. Record the furthest base he reached (and whether he scored), so
  // his diamond can shade the bases he legged out — filled solid when he came
  // around to score. Also record, per base, HOW he got there (BB, GO, 2B…),
  // for the notations drawn along the base paths — with the lineup slot of the
  // hitter who drove him over — but only for advancement on OTHER plays; the
  // leg(s) he reached on his own PA are already labeled by the code above the
  // diamond. Only a plate appearance credits a hitter; steals/wild pitches
  // advance a runner on their own, so those carry no slot. An out on the bases
  // doesn't advance him.
  const progress = new Map() // runnerId -> furthest base (1-3, or 4 for a run)
  const legs = new Map() // runnerId -> { baseNum: { code, slot } }
  for (const play of plays) {
    const code = advanceCode(play)
    const playBatter = play.matchup?.batter?.id
    const slot = playBatter != null && !NON_PA_EVENT_TYPES.has(play.result?.eventType)
      ? battingSlot(feed, battingSide, playBatter)
      : null
    // The feed can split one runner's multi-base move on a single play into
    // separate legs (2nd→3rd, 3rd→home). Keep only the furthest destination
    // per runner per play, so a two-base advance is labeled once, at its end.
    const endBase = new Map() // runnerId -> furthest base reached on THIS play
    for (const r of play.runners ?? []) {
      const rid = r.details?.runner?.id
      if (rid == null || r.movement?.isOut) continue
      const base = BASE_NUM[r.movement?.end] ?? 0
      if (base > (endBase.get(rid) ?? 0)) endBase.set(rid, base)
    }
    for (const [rid, base] of endBase) {
      if (base > (progress.get(rid) ?? 0)) progress.set(rid, base)
      if (rid !== playBatter) {
        const m = legs.get(rid) ?? {}
        m[base] = { code, slot }
        legs.set(rid, m)
      }
    }
  }
  for (const [rid, cardIndex] of originIndex) {
    const base = progress.get(rid) ?? 0
    entries[cardIndex].scored = base === 4
    entries[cardIndex].reached = base
    entries[cardIndex].legNotations = legs.get(rid) ?? {}
  }

  return entries
}
