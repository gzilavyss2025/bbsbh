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

// Non-pitch playEvents that get their own interstitial note in the feed: mound
// visits, pitching changes, and the fielding-side moves (a fresh defender, or a
// player who stays in the game at a new position — 'X remains in the game as
// the right fielder'). These live INSIDE a play's playEvents, at the start of
// whichever plate appearance follows the stoppage, so they're already gated to
// the half being revealed. Offensive subs are skipped — a pinch-hitter shows up
// as his own batting row, a pinch-runner as the baserunner he becomes.
const STOPPAGE_EVENTS = new Set([
  'mound_visit',
  'pitching_substitution',
  'defensive_substitution',
  'defensive_switch',
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

// Every player in the game, name → id, longest name first so a longer name
// wins over a shorter one it contains. Used to find player references inside
// the templated prose descriptions / substitution notes.
function buildNameIndex(feed) {
  return Object.values(feed?.gameData?.players ?? {})
    .map((p) => ({ name: (p.fullName ?? '').trim(), id: p.id }))
    .filter((p) => p.name && p.id)
    .sort((a, b) => b.name.length - a.name.length)
}

// Split a prose string into segments, tagging the spans that are player names
// with their id: [{ text }, { text, id }, …]. Non-overlapping, earliest match
// wins. Lets the card render those spans as uppercase / a deep link while the
// surrounding words stay plain.
function linkifyNames(text, index) {
  if (!text) return [{ text: '' }]
  const hits = []
  for (const { name, id } of index) {
    let from = 0
    let at
    while ((at = text.indexOf(name, from)) !== -1) {
      hits.push({ start: at, end: at + name.length, id })
      from = at + name.length
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end)
  const segments = []
  let pos = 0
  for (const h of hits) {
    if (h.start < pos) continue // overlaps an already-taken span
    if (h.start > pos) segments.push({ text: text.slice(pos, h.start) })
    segments.push({ text: text.slice(h.start, h.end), id: h.id })
    pos = h.end
  }
  if (pos < text.length) segments.push({ text: text.slice(pos) })
  return segments
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
  // Every strikeout is a K — swinging, on a foul tip, on a foul bunt, a checked
  // swing — keyed off the eventType, not one description phrasing (a foul-tip K
  // reads "strikes out on a foul tip", not "…swinging", and used to fall through
  // to the catcher's putout "2"). The customary backwards "looking" K is drawn
  // only for a called third strike.
  if (et === 'strikeout' || et === 'strikeout_double_play') {
    if (/called out on strikes/i.test(desc)) return { calledLooking: true, codeKind: 'out' }
    return { code: 'K', codeKind: 'out' }
  }
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
// the base where his path is capped: "CS 2-4" caught stealing, "PK 3-6" pickoff,
// else the bare fielding chain that put him out (6-4, 4-6…).
//
// The kind of out is read from the RUNNER's own event, not `play.result` — a
// caught stealing / pickoff shows up as a runners[] entry INSIDE whatever
// batter's plate appearance it happened during, so the play's own result is
// that batter's (a strikeout, a groundout), not the baserunning out. (For a
// rare top-level CS/PK play with no batter, fall back to the play result.)
function runnerOutCode(play, runnerEntry) {
  const et = runnerEntry.details?.eventType ?? play.result?.eventType ?? ''
  const chain = (runnerEntry.credits ?? [])
    .filter((c) => /putout|assist/.test(c.credit ?? ''))
    .map((c) => c.position.code)
    .join('-')
  let tag = ''
  if (et.startsWith('caught_stealing')) tag = 'CS'
  else if (et.startsWith('pickoff')) tag = 'PK' // includes pickoff_caught_stealing
  if (tag) return chain ? `${tag} ${chain}` : tag
  return chain || 'OUT'
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
  const nameIndex = buildNameIndex(feed)

  // Pinch runners: an `offensive_substitution` whose incoming man is a Runner
  // (position abbreviation 'PR') drops a fresh runner onto the base of a runner
  // already aboard. He takes no plate appearance, so he owns no card — alias his
  // id to the runner he replaced (chained, so a pinch runner FOR a pinch runner
  // still resolves back to the batter whose card it is) so all of his later
  // baserunning flows onto that card, and record the swap so the card can strike
  // the replaced batter's name and pencil the pinch runner in (see PlayByPlay).
  // Field paths (player.id incoming, replacedPlayer.id outgoing,
  // position.abbreviation, numeric `base`) verified against gamePk 776137/776141.
  const prAlias = new Map() // pinch-runner id -> replaced runner id
  const prSubs = [] // { pinchId, replacedId, base }, in game order
  for (const play of plays) {
    for (const e of play.playEvents ?? []) {
      if (e.details?.eventType !== 'offensive_substitution') continue
      if (e.position?.abbreviation !== 'PR') continue
      const pinchId = e.player?.id
      const replacedId = e.replacedPlayer?.id
      if (pinchId == null || replacedId == null) continue
      prAlias.set(pinchId, replacedId)
      prSubs.push({ pinchId, replacedId, base: e.base ?? null })
    }
  }
  // Resolve a runner id to the card-owning batter, following pinch-runner swaps
  // to their root (an id that never pinch-ran returns unchanged).
  const rootRunner = (id) => {
    let cur = id
    const seen = new Set()
    while (prAlias.has(cur) && !seen.has(cur)) {
      seen.add(cur)
      cur = prAlias.get(cur)
    }
    return cur
  }

  for (const play of plays) {
    // Non-pitch playEvents split two ways: STOPPAGE_EVENTS (mound visits,
    // subs) are their own interstitial notes; baserunning events (caught
    // stealing, pickoffs, steals, wild pitches, passed balls, balks) carry the
    // prose account of a play that has no batting result of its own — collect
    // them to hang on the card of the plate appearance they happened during
    // (they live inside that PA's playEvents), so the feed explains the out /
    // advance instead of leaving a bare mark on the diamond.
    const baserunningNotes = []
    for (const e of play.playEvents ?? []) {
      if (e.isPitch) continue
      const et = e.details?.eventType
      if (STOPPAGE_EVENTS.has(et)) {
        const text = e.details.description
        entries.push({ kind: 'event', eventType: et, text, segments: linkifyNames(text, nameIndex) })
      } else if (NON_PA_EVENT_TYPES.has(et) && e.details?.description) {
        baserunningNotes.push({ eventType: et, segments: linkifyNames(e.details.description, nameIndex) })
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
        // front — it's already on the card), split so the other players named
        // in it (fielders, a scoring runner) render as uppercase spans.
        descSegments: linkifyNames(
          trimLeadingName(play.result?.description, batter.fullName),
          nameIndex,
        ),
        // Scorebook denotation drawn above the diamond (1B, F8, 6-3…).
        ...scorebookCode(play, batterRunner),
        // Prose for any baserunning event (a steal, a caught stealing, a wild
        // pitch…) that occurred during this plate appearance.
        baserunningNotes,
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
    } else {
      // A top-level baserunning play with no plate appearance of its own (an
      // inning-ending caught stealing, whose batter's count resumes next
      // inning) has no card to hang its prose on — emit it as its own note so
      // the account isn't lost.
      for (const n of baserunningNotes) {
        entries.push({ kind: 'event', eventType: n.eventType, segments: n.segments })
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
      // A pinch runner resolves back to the card of the batter he ran for.
      const origin = originIndex.get(rootRunner(rid))
      if (origin == null) continue // no known origin card — nothing to attach to
      entries[origin].outNumber = r.movement.outNumber
      // Where and how he was cut down, for the diamond's tick + out code.
      entries[origin].outAt = BASE_NUM[r.movement.outBase] ?? null
      entries[origin].outCode = runnerOutCode(play, r)
    }
  }

  // Hang each pinch-runner swap on the card of the batter it ultimately replaced
  // (chains resolved to the root), so the card can strike that batter's name and
  // list the pinch runner(s) who took over — with the base each entered at, for
  // the diamond's red PR marker.
  for (const sub of prSubs) {
    const cardIndex = originIndex.get(rootRunner(sub.replacedId))
    if (cardIndex == null) continue
    const person = feed?.gameData?.players?.[`ID${sub.pinchId}`] ?? {}
    const card = entries[cardIndex]
    card.pinchRunners = card.pinchRunners ?? []
    card.pinchRunners.push({ id: sub.pinchId, ...personNameParts(person), base: sub.base })
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
      // Credit a pinch runner's advance to the batter whose card he inherited.
      const canon = rootRunner(rid)
      const base = BASE_NUM[r.movement?.end] ?? 0
      if (base > (endBase.get(canon) ?? 0)) endBase.set(canon, base)
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
