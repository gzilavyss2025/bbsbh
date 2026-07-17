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

// A placeholder top-level play the feed uses to log pregame/mid-game status
// transitions (Pre-Game -> Warmup -> In Progress, or a delay's own "Status
// Change" advisories) as nested "Game Advisory" playEvents. It carries a real
// matchup (whoever is next due up to bat/pitch) but is never an actual plate
// appearance, so it's checked alongside NON_PA_EVENT_TYPES anywhere a play's
// eventType decides PA/BF counting — otherwise it renders as a bogus at-bat
// card with an empty diamond (verified live, gamePk 823440, the half hour
// before first pitch). See api/select.js's selectGameStatus (`isWarmup`) for
// the structural, spoiler-free notice built from the same detailedState.
export const GAME_ADVISORY_EVENT_TYPE = 'game_advisory'

// Non-pitch playEvents that get their own interstitial note in the feed: mound
// visits, pitching changes, ejections, and the fielding-side moves (a fresh
// defender, or a player who stays in the game at a new position — 'X remains
// in the game as the right fielder'). These live INSIDE a play's playEvents,
// at the start of whichever plate appearance follows the stoppage, so they're
// already gated to the half being revealed. Offensive subs are mostly skipped
// — a pinch-hitter shows up as his own batting row — except a pinch-RUNNER,
// which gets its own notification pushed separately below (see the main loop)
// since it happens mid-flow, distinct from the batter-card annotation that
// also strikes the replaced runner's name.
const STOPPAGE_EVENTS = new Set([
  'mound_visit',
  'pitching_substitution',
  'defensive_substitution',
  'defensive_switch',
  'ejection',
])

// Position abbreviation -> lowercase phrase, for "now playing {phrase}" on a
// defensive-substitution notice. No DH entry — a DH never takes the field.
const POSITION_LOWER = {
  C: 'catcher',
  '1B': 'first base',
  '2B': 'second base',
  '3B': 'third base',
  SS: 'shortstop',
  LF: 'left field',
  CF: 'center field',
  RF: 'right field',
  P: 'pitcher',
}

// statsapi event descriptions arrive Title-Cased ("Defensive Substitution:
// David Hamilton replaces Sal Frelick…"). The play-by-play event notes read as
// natural sentences (they're caps-exempt in the CSS), so lowercase the
// Title-Case LABEL that prefixes the first colon — all but its first word — and
// leave the sentence body untouched (it already carries natural-case player
// names). A description with no "Label:" prefix ("Lawrence Butler remains in the
// game as the right fielder.") is already sentence-case and passes through. The
// transform never changes the string's length, so name offsets computed by
// linkifyNames stay valid.
export function sentenceCaseEventText(text) {
  if (!text) return text
  const ci = text.indexOf(':')
  if (ci === -1) return text
  const label = text
    .slice(0, ci)
    .replace(/(\w)(\w*)/g, (m, first, tail, off) =>
      off === 0 ? first + tail : first.toLowerCase() + tail,
    )
  return label + text.slice(ci)
}

// MLB gives each club 5 mound visits through 9 innings and one more for each
// extra inning played. Exported so the notification bar's pip row (used vs
// still-available) can size itself off the same rule moundVisitRemainings
// uses internally, without duplicating the "+1 per extra inning" formula.
export function moundVisitsAllowed(inning) {
  return 5 + Math.max(0, inning - 9)
}

// Mound-visit accounting for the notification bar. A visit is charged to the
// DEFENSIVE club. Walks every play through (inning, half) inclusive and, for
// the club fielding THIS half (the opposite of battingSide), returns the
// running "visits remaining" AFTER each of its mound visits that happened in
// this half, in order — so the bar on each mound-visit card shows how many
// that club had left right after it. Remaining never goes negative.
export function moundVisitRemainings(feed, inning, half, battingSide) {
  const defenseSide = battingSide === 'away' ? 'home' : 'away'
  const allowed = moundVisitsAllowed(inning)
  const targetIdx = half === 'bottom' ? inning * 2 : inning * 2 - 1 // 1-based half order
  let used = 0
  const inHalf = []
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const pi = p.about?.inning
    const ph = p.about?.halfInning // 'top' | 'bottom'
    if (pi == null || ph == null) continue
    const playIdx = ph === 'bottom' ? pi * 2 : pi * 2 - 1
    if (playIdx > targetIdx) break
    if ((ph === 'top' ? 'home' : 'away') !== defenseSide) continue
    for (const e of p.playEvents ?? []) {
      if (e.details?.eventType === 'mound_visit') {
        used += 1
        if (playIdx === targetIdx) inHalf.push(Math.max(0, allowed - used))
      }
    }
  }
  return inHalf
}

// The incoming pitcher's card fields for a mid-inning pitching-change note — the
// same shape selectPrePitchChanges builds for a between-halves change, so both
// render through the one PitcherNotice card. Name as "Last, First", jersey and
// throwing hand off his gameData record.
export function pitchingChangePitcher(feed, playerId) {
  if (playerId == null) return null
  const person = feed?.gameData?.players?.[`ID${playerId}`] ?? {}
  const { last, first, useName } = personNameParts(person)
  const name = last
    ? `${last}${first ? `, ${useName || first}` : ''}`
    : person.fullName ?? ''
  return {
    id: playerId,
    name,
    jersey: person.primaryNumber ?? '',
    hand: person.pitchHand?.code ?? '',
  }
}

// The incoming fielder's card fields for a mid-inning defensive-substitution
// note (see FielderNotice) — same "Last, First" + jersey shape as
// pitchingChangePitcher, plus the lowercase position phrase for "now playing
// {position}". `positionAbbr` comes off the same playEvent (`position.abbreviation`)
// computeHalfInningFeed already carries on the entry.
export function defensiveChangeFielder(feed, playerId, positionAbbr) {
  if (playerId == null) return null
  const person = feed?.gameData?.players?.[`ID${playerId}`] ?? {}
  const { last, first, useName } = personNameParts(person)
  const name = last
    ? `${last}${first ? `, ${useName || first}` : ''}`
    : person.fullName ?? ''
  return {
    id: playerId,
    name,
    jersey: person.primaryNumber ?? '',
    position: POSITION_LOWER[positionAbbr] ?? '',
  }
}

// The incoming pinch runner + the runner he replaced, for a mid-inning
// pinch-running note (see PinchRunNotice) — pushed at the moment the swap
// happens, distinct from the retroactive strike-through this same swap also
// leaves on the replaced batter's own card (see the prSubs bookkeeping below).
export function pinchRunningPlayers(feed, pinchId, replacedId) {
  const nameOf = (id) => {
    if (id == null) return null
    const person = feed?.gameData?.players?.[`ID${id}`] ?? {}
    const { last, first, useName } = personNameParts(person)
    const name = last
      ? `${last}${first ? `, ${useName || first}` : ''}`
      : person.fullName ?? ''
    return { id, name, jersey: person.primaryNumber ?? '' }
  }
  return { runner: nameOf(pinchId), replaced: nameOf(replacedId) }
}

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

// Whether a plate appearance's pitch detail carries plottable plate-crossing
// locations — true only if at least one pitch has numeric pX/pZ AND a batter
// zone (strikeZoneTop/Bottom) to scale against. False at MiLB parks with no
// tracking, so callers can drop the strike-zone diagram entirely.
export function hasPitchLocations(pitchDetails) {
  return (pitchDetails ?? []).some(
    (p) =>
      typeof p.px === 'number' &&
      typeof p.pz === 'number' &&
      typeof p.szTop === 'number' &&
      typeof p.szBottom === 'number',
  )
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
  // A ball caught for the out in FOUL territory gets an "F" penciled in front
  // of its normal code (a foul pop out to 1st is FP3, a foul fly to left is
  // FF7) — MLB's description names it explicitly ("… in foul territory").
  const foul = /in foul territory/i.test(desc) ? 'F' : ''
  if (/lines? (out|into)/i.test(desc)) return { code: `${foul}L${chain[chain.length - 1] ?? ''}`, codeKind: 'out' }
  // A pop out (P) is its own scorebook code, distinct from a fly out (F) —
  // both come back from MLB as "pops out"/"flies out" in the description.
  if (/pops? (out|into)/i.test(desc)) return { code: `${foul}P${chain[chain.length - 1] ?? ''}`, codeKind: 'out' }
  if (/flies? (out|into)/i.test(desc)) return { code: `${foul}F${chain[chain.length - 1] ?? ''}`, codeKind: 'out' }
  // A single-fielder chain (no throw — he fielded it and recorded the putout
  // himself) is the scorebook's "unassisted" play: 3U, 6U, etc, not a bare
  // position number.
  const code = chain.length === 1 ? `${chain[0]}U` : chain.join('-')
  return { code, codeKind: 'out' }
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
  field_error: 'E', error: 'E', fielders_choice: 'FC', fielders_choice_out: 'FC',
}

function advanceCode(play) {
  const et = play.result?.eventType
  if (ADVANCE_CODES[et]) return ADVANCE_CODES[et]
  if (/(flies|fly ball|pops|lines|line drive|sacrifice fly)/i.test(play.result?.description ?? '')) return 'FO'
  return 'GO'
}

// A runner's leg-advance code, preferring the position-specific error code
// (E8, E5…) straight off THIS movement's own error credit — a plain "E" (the
// ADVANCE_CODES/advanceCode fallback) doesn't say who bobbled it, and the
// runner-level eventType the feed uses for an error-driven advance ("error")
// doesn't match ADVANCE_CODES' "field_error" key (that one's the BATTER's own
// reach-on-error, from scorebookCode) — verified against gamePk 823036's top
// 2nd (Bauers 2nd->3rd on a CF fielding error).
function legAdvanceCode(play, r) {
  const errCred = (r.credits ?? []).find((c) => /error/.test(c.credit ?? ''))
  if (errCred) return `E${errCred.position?.code ?? ''}`
  const rEt = r.details?.eventType
  if (rEt && ADVANCE_CODES[rEt]) return ADVANCE_CODES[rEt]
  return advanceCode(play)
}

// The base a batter's OWN reach code (scorebookCode's REACH_CODES) already
// implies he's on — so his diamond only needs a FURTHER leg notation when he
// advances past it on the SAME play (e.g. a single plus a fielding error that
// lets him take an extra 90 feet), never for the base his own hit already
// names (a double's "2B" up top already explains 2nd; it doesn't also need
// "2B" penciled at the base itself).
const NATURAL_BASE = {
  single: 1, double: 2, triple: 3, home_run: 4,
  walk: 1, intent_walk: 1, hit_by_pitch: 1,
  fielders_choice: 1, fielders_choice_out: 1, catcher_interf: 1, field_error: 1,
}

// The fielder charged with an error anywhere on this play (Error position,
// scorebook-style E-code) — used to attribute a BATTER's own bonus base to
// the same misplay even when the feed's error credit landed on a different
// runner's movement entry than his (see gamePk 823036: the CF's fielding
// error credit sits on the trailing runner's leg, not the batter's own
// 1st->2nd leg, even though the same misplay is what let the batter move up
// too). Null when the play carries no error at all — its usual case.
function playErrorCredit(play) {
  for (const r of play.runners ?? []) {
    const errCred = (r.credits ?? []).find((c) => /error/.test(c.credit ?? ''))
    if (errCred) return `E${errCred.position?.code ?? ''}`
  }
  return null
}

const BASE_NUM = { '1B': 1, '2B': 2, '3B': 3, '4B': 4, score: 4 }

// The lineup slot (1-9) a player bats in, from his boxscore battingOrder —
// starters are exact multiples of 100 (500 → 5), subs are offset (503 → 5).
// Used to credit which hitter drove a runner over, and by the Scorecard Lab's
// full-reveal grid to place each plate appearance on its batting-order row.
export function battingSlot(feed, side, id) {
  const order = feed?.liveData?.boxscore?.teams?.[side]?.players?.[`ID${id}`]?.battingOrder
  const n = parseInt(order, 10)
  return Number.isFinite(n) ? Math.floor(n / 100) : null
}

// How a runner (not the batter) was retired on the bases, for the notation by
// the base where his path is capped: "CS 2-4" caught stealing, "PK 3-6" pickoff,
// "DP 4-6" a runner erased on the batter's double play, "FC 6" a runner forced
// out or retired on a fielder's choice (the batter put the ball in play and the
// defense chose this runner), else the bare fielding chain (6-4, 4-6…).
//
// The kind of out is read from the RUNNER's own event, not `play.result` — a
// caught stealing / pickoff shows up as a runners[] entry INSIDE whatever
// batter's plate appearance it happened during, so the play's own result is
// that batter's (a strikeout, a groundout), not the baserunning out. (For a
// rare top-level CS/PK play with no batter, fall back to the play result.)
// Runner-event types where the batter put the ball in play and the defense
// elected to retire this runner. A runner erased on the batter's double play
// gets "DP"; a bare force out or a true fielder's choice gets "FC".
const DOUBLE_PLAY_EVENTS = new Set(['grounded_into_double_play', 'double_play'])
const FORCED_OUT_EVENTS = new Set([
  'force_out',
  'fielders_choice',
  'fielders_choice_out',
])

function runnerOutCode(play, runnerEntry) {
  const et = runnerEntry.details?.eventType ?? play.result?.eventType ?? ''
  const chain = (runnerEntry.credits ?? [])
    .filter((c) => /putout|assist/.test(c.credit ?? ''))
    .map((c) => c.position.code)
    .join('-')
  let tag = ''
  if (et.startsWith('caught_stealing')) tag = 'CS'
  else if (et.startsWith('pickoff')) tag = 'PK' // includes pickoff_caught_stealing
  else if (DOUBLE_PLAY_EVENTS.has(et)) tag = 'DP'
  else if (FORCED_OUT_EVENTS.has(et)) tag = 'FC'
  if (tag) return chain ? `${tag} ${chain}` : tag
  return chain || 'OUT'
}

// The play that scored the GAME's first run, for the "scoring first" call-out —
// the earliest play (by feed order) whose cumulative score first goes above 0.
// `result.awayScore`/`homeScore` are the running totals AFTER the play (verified
// against a live game). Returns { atBatIndex, side } where side ('away' | 'home')
// is the team that scored (the batting side of that half), or null before any
// run. Reveal-only, like the rest of this module — reads scoring state.
export function firstRunPlay(feed) {
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const r = p.result ?? {}
    if ((r.awayScore ?? 0) + (r.homeScore ?? 0) > 0) {
      return {
        atBatIndex: p.about?.atBatIndex ?? null,
        side: p.about?.halfInning === 'bottom' ? 'home' : 'away',
      }
    }
  }
  return null
}

// atBatIndex of each batter's FIRST plate appearance in the whole game, so a
// "coming into today" note (a streak) can render once — on his first card —
// rather than every inning he bats. Reveal-only, like the rest of this module.
export function firstPAIndexByBatter(feed) {
  const first = new Map()
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const bid = p.matchup?.batter?.id
    if (
      bid == null ||
      NON_PA_EVENT_TYPES.has(p.result?.eventType) ||
      p.result?.eventType === GAME_ADVISORY_EVENT_TYPE
    )
      continue
    if (!first.has(bid)) first.set(bid, p.about?.atBatIndex ?? null)
  }
  return first
}

// (Times-through-the-order counting used to live here as a per-PA map; the
// per-play note it fed was replaced by the pre-half strip's single persistent
// card, which does its own prior-halves walk — see buildThirdTimeThroughNote
// in api/callout-notes.js.)

// At-bat-mode stepping (ADR-0016): the entries index marking the end of the
// NEXT step from `fromCount` — every leading event note (a mound visit, a
// sub) up to and including the next plate-appearance card, so one tap reads
// as "reveal the next batter" rather than "reveal the next note." Returns
// entries.length when no at-bat card remains after fromCount (trailing
// notes with nobody left to bat, e.g. a closing ejection).
export function nextStepBoundary(entries, fromCount) {
  for (let i = fromCount; i < entries.length; i++) {
    if (entries[i].kind === 'atbat') return i + 1
  }
  return entries.length
}

// Ordered feed for one half-inning: plate-appearance cards interleaved with
// mound-visit / pitching-change notes, first-at-bat first. `battingSide` is
// 'away' | 'home' (top bats away, bottom bats home — same convention as the
// rest of InningViewer).
// `stepCap` (ADR-0016, at-bat stepping): when not null, caps how many entries
// are considered "visible" so far. A play's effect on any card OTHER than its
// own — a later out on the bases, an advance that lets an earlier runner
// score — must not be written onto that earlier, already-revealed card until
// the play that causes it is itself within the visible window; otherwise a
// batter's diamond would show his eventual fate (e.g. scoring on a hit two
// batters later) the moment his own at-bat is revealed, before that later
// play has been shown. A play's own card/notes always push onto `entries`
// regardless of stepCap — visibility only gates what OTHER, already-pushed
// cards get retroactively annotated with.
export function computeHalfInningFeed(feed, inningNum, half, battingSide, stepCap = null) {
  const plays = (feed?.liveData?.plays?.allPlays ?? []).filter(
    (p) => p?.about?.inning === inningNum && p?.about?.halfInning === half,
  )

  const entries = []
  // batterId -> index of his CURRENT (most recent) atbat card. A batter who
  // bats around comes up more than once in the half; this always points at
  // his latest trip, never a stale earlier one.
  const originIndex = new Map()
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

  // Advancement tracking, per batter. A batter can only lead off a second
  // plate appearance in the same half (the lineup batting around) once his
  // first trip on the bases is fully resolved — scored or put out, since he
  // can't simultaneously be a live baserunner and the man due up — so these
  // maps hold at most one LIVE trip per batter id at a time. `finalizeTrip`
  // snapshots the current trip onto its card; called both when a repeat
  // batter's new card bumps out the old trip, and once at the end for every
  // batter's final (or only) trip.
  const progress = new Map() // batterId -> furthest base of his current trip (1-3, 4 = run)
  const legs = new Map() // batterId -> { baseNum: { code, slot } } for his current trip
  const finalizeTrip = (batterId) => {
    const cardIndex = originIndex.get(batterId)
    if (cardIndex == null) return
    const base = progress.get(batterId) ?? 0
    entries[cardIndex].scored = base === 4
    entries[cardIndex].reached = base
    entries[cardIndex].legNotations = legs.get(batterId) ?? {}
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
    // A pinch runner's strike-through-and-pencil-in on the ORIGIN card (the
    // batter he's running for) is exactly the kind of retroactive annotation
    // the `visible` gate below exists for — it must not appear on that
    // earlier, already-revealed card until the pinch-running notification
    // itself is within the visible step window (ADR-0016), so stepping
    // through "he walked" doesn't silently show who ran for him before that
    // notification card has actually been reached. Collected here, applied
    // after `visible` is known for this play, same pattern as baserunningNotes.
    const pendingPinchRunnerCards = []
    for (const e of play.playEvents ?? []) {
      if (e.isPitch) continue
      const et = e.details?.eventType
      if (STOPPAGE_EVENTS.has(et)) {
        const text = sentenceCaseEventText(e.details.description)
        entries.push({
          kind: 'event',
          eventType: et,
          text,
          playerId: e.player?.id ?? null,
          position:
            et === 'defensive_substitution' || et === 'defensive_switch'
              ? e.position?.abbreviation ?? ''
              : undefined,
          segments: linkifyNames(text, nameIndex),
        })
      } else if (et === 'offensive_substitution' && e.position?.abbreviation === 'PR') {
        // A pinch runner entering mid-flow — its own notification at the
        // moment it happens (see pinchRunningPlayers), separate from the
        // strike-through this same swap leaves on the replaced runner's card.
        // text/segments are a fallback only (EventNote), for the vanishingly
        // unlikely case the incoming runner isn't in gameData.players.
        const text = sentenceCaseEventText(e.details?.description ?? '')
        entries.push({
          kind: 'event',
          eventType: 'pinch_running',
          pinchId: e.player?.id ?? null,
          replacedId: e.replacedPlayer?.id ?? null,
          base: e.base ?? null,
          text,
          segments: linkifyNames(text, nameIndex),
        })
        // Alias right here, at the moment the swap happens, so a batter who
        // bats around later (and gets a fresh card + originIndex entry)
        // doesn't retroactively steal a pinch-runner note that belonged to
        // his earlier trip — this bookkeeping must stay immediate regardless
        // of stepCap, or later baserunning on this same pinch runner couldn't
        // resolve back to the right origin card. The actual card annotation
        // (pendingPinchRunnerCards) is deferred to the `visible` check below.
        const pinchId = e.player?.id
        const replacedId = e.replacedPlayer?.id
        if (pinchId != null && replacedId != null) {
          prAlias.set(pinchId, replacedId)
          const cardIndex = originIndex.get(rootRunner(replacedId))
          if (cardIndex != null) {
            const person = feed?.gameData?.players?.[`ID${pinchId}`] ?? {}
            pendingPinchRunnerCards.push({
              cardIndex,
              id: pinchId,
              ...personNameParts(person),
              base: e.base ?? null,
            })
          }
        }
      } else if (NON_PA_EVENT_TYPES.has(et) && e.details?.description) {
        // `e.player.id` on a baserunning playEvent is the runner it's about (the
        // stealer / picked-off man) — verified against a live steal — so a
        // leader call-out on a steal can key on the RUNNER, not the batter.
        baserunningNotes.push({
          eventType: et,
          runnerId: e.player?.id ?? null,
          segments: linkifyNames(e.details.description, nameIndex),
        })
      }
    }

    const batterId = play.matchup?.batter?.id
    // `result.type === 'atBat'` is required, not just a truthy eventType — mid-
    // inning stoppages (pitching changes, defensive subs) can transiently surface
    // as their OWN top-level play before the feed folds them into the next real
    // PA's playEvents (see the header comment above); such a play carries the
    // PREVIOUS batter's stale matchup.batter with a substitution's prose as its
    // description, which would otherwise be mistaken for that batter's own card.
    // The pregame/mid-game "Game Advisory" placeholder (GAME_ADVISORY_EVENT_TYPE)
    // is excluded the same way — it carries the NEXT batter's matchup instead of
    // a stale one, but is just as much not a real plate appearance. Same guard
    // `pitchers.js` uses for batters-faced counts.
    const isRealPA =
      play.result?.type === 'atBat' &&
      batterId != null &&
      !NON_PA_EVENT_TYPES.has(play.result?.eventType) &&
      play.result?.eventType !== GAME_ADVISORY_EVENT_TYPE
    const runners = play.runners ?? []

    if (isRealPA) {
      const batter = resolveBatter(feed, battingSide, batterId)
      const pitchEvents = (play.playEvents ?? []).filter((e) => e.isPitch)
      const pitches = pitchEvents.map(pitchCallCode)
      // Per-pitch detail for the strike-zone diagram: plate-crossing location
      // (pX/pZ) against the batter's own zone (strikeZoneTop/Bottom), plus velo
      // and pitch type for the sequence list. All Statcast-ish, so every field
      // is null-guarded — at MiLB parks with no tracking pX/pZ are simply
      // absent and StrikeZone renders nothing (same degrade as derive.js).
      const pitchDetails = pitchEvents.map((e, i) => {
        const code = pitchCallCode(e)
        const pd = e.pitchData ?? {}
        const co = pd.coordinates ?? {}
        return {
          no: e.pitchNumber ?? i + 1,
          code,
          cat: pitchDotCategory(code),
          px: typeof co.pX === 'number' ? co.pX : null,
          pz: typeof co.pZ === 'number' ? co.pZ : null,
          szTop: typeof pd.strikeZoneTop === 'number' ? pd.strikeZoneTop : null,
          szBottom: typeof pd.strikeZoneBottom === 'number' ? pd.strikeZoneBottom : null,
          mph: typeof pd.startSpeed === 'number' ? pd.startSpeed : null,
          type: e.details?.type?.description ?? '',
          callDesc: e.details?.call?.description ?? '',
        }
      })

      // The pitcher this PA faced (for the strike-zone panel's "vs" header) —
      // his name parts off gameData, same shape as the batter. `hand`
      // ('L'/'R', bio fact not a result) feeds the platoon-split call-out (see
      // api/callout-notes.js), same field pitchers.js already reads.
      const pitcherId = play.matchup?.pitcher?.id
      const pitcherPerson = pitcherId != null ? feed?.gameData?.players?.[`ID${pitcherId}`] ?? {} : {}
      const pitcher =
        pitcherId != null
          ? { id: pitcherId, ...personNameParts(pitcherPerson), hand: pitcherPerson.pitchHand?.code ?? '' }
          : null

      const cardIndex = entries.length
      const batterRunner = runners.find((r) => r.details?.runner?.id === batterId)
      const card = {
        kind: 'atbat',
        batterId,
        // The play's own identity + result event, for the leader/scoring-first
        // call-outs (see api/callouts.js): the batter's PA result eventType
        // (home_run, walk, strikeout…) drives which leader note can fire, and
        // atBatIndex lets the caller mark the play that scored the game's first
        // run. Spoiler-free to READ here — this whole module is reveal-only.
        atBatIndex: play.about?.atBatIndex ?? null,
        eventType: play.result?.eventType ?? null,
        // The terminal pitch's playId — matches a video highlight clip's guid
        // 1:1 (see api/highlights.js). Verified against both batted-ball and
        // strikeout-ending plays; null when the PA has no pitch events on
        // record (shouldn't happen for a real PA, but null-guard anyway).
        playId: pitchEvents.at(-1)?.playId ?? null,
        batter,
        pitcher,
        pitches,
        pitchDetails,
        // The side this PA was actually batted from ('L'/'R') — read off the
        // play's own matchup rather than the player's default batSide, since a
        // switch hitter's real side varies by at-bat. Feeds the pitch-zone
        // panel's batter-box silhouette; spoiler-free (bio fact, not a result).
        batSide: play.matchup?.batSide?.code ?? '',
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
        // by the advancement bookkeeping below, which follows him as a
        // baserunner across the rest of his trip.
        reached: 0,
        scored: false,
      }
      entries.push(card)
      // A repeat plate appearance — the lineup batting around — bumps out
      // whatever's tracked under this batter id. His prior trip is already
      // fully resolved (out or scored) by now, so bank it on his earlier
      // card before resetting for this new trip.
      if (originIndex.has(batterId)) {
        finalizeTrip(batterId)
        progress.delete(batterId)
        legs.delete(batterId)
      }
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
        entries.push({
          kind: 'event',
          eventType: n.eventType,
          playerId: n.runnerId,
          segments: n.segments,
        })
      }
    }

    // This play's own card/notes (if any) just pushed above — whether ITS
    // effect on other, already-carded runners may be applied yet depends on
    // whether the play itself is within the visible step window.
    const visible = stepCap == null || entries.length <= stepCap

    // See pendingPinchRunnerCards above — only pencil the incoming runner
    // onto the origin card once the pinch-running notification that
    // announces him is itself within the visible step window.
    if (visible) {
      for (const p of pendingPinchRunnerCards) {
        const card = entries[p.cardIndex]
        card.pinchRunners = card.pinchRunners ?? []
        card.pinchRunners.push({ id: p.id, last: p.last, first: p.first, base: p.base })
      }
    }

    // A runner other than this play's batter can also be put out here — a
    // force, a caught stealing, the back half of a double play. That runner
    // already has their own card from when they batted (walked, singled...),
    // several cards back. This later out only adds their sequence number to
    // that card; it doesn't replace how they got on base with a description
    // of the play that ended it.
    if (visible) {
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

    // Advancement bookkeeping for this same play, folded into this same
    // per-play pass (rather than a separate walk over `plays`) so a repeat
    // batter's finalize-and-reset above lands strictly between his two
    // trips, instead of conflating them under one cumulative "furthest base
    // reached." Record the furthest base each runner reached this play (and
    // whether he scored) into `progress`/`legs`, so his diamond can shade the
    // bases he legged out — filled solid when he came around to score. Also
    // record, per base, HOW he got there (BB, GO, 2B…), for the notations
    // drawn along the base paths — with the lineup slot of the hitter who
    // drove him over — but for the BATTER's own trip only the base BEYOND
    // what his own reach code already implies gets a notation (see
    // NATURAL_BASE below) — a double's "2B" up top already explains 2nd; it's
    // only a further, same-play bonus base (a single plus a fielding error
    // that lets him take an extra 90 feet) that needs its own leg label. Only
    // a plate appearance credits a hitter; steals/wild pitches advance a
    // runner on their own, so those carry no slot. An out on the bases
    // doesn't advance him.
    const batterSlot = isRealPA ? battingSlot(feed, battingSide, batterId) : null
    // The feed can split one runner's multi-base move on a single play into
    // separate legs (2nd→3rd, 3rd→home). Keep only the furthest destination
    // per runner per play, so a two-base advance is labeled once, at its end.
    // How he advanced is read from the runner's OWN movement event, not the
    // play's batting result: a steal / wild pitch / passed ball / balk during
    // another batter's PA is recorded on the runner (details.eventType), so it
    // must be tagged SB/WP/PB/BK rather than the batter's BB/K/GO. Such a
    // self-advance credits no hitter (slot null); an advance driven by the
    // batter's plate appearance credits his lineup slot.
    if (visible) {
      const endBase = new Map() // runnerId -> { base, code, slot } furthest this play
      for (const r of runners) {
        const rid = r.details?.runner?.id
        if (rid == null || r.movement?.isOut) continue
        const base = BASE_NUM[r.movement?.end] ?? 0
        if (base === 0) continue
        // Credit a pinch runner's advance to the batter whose card he inherited.
        const canon = rootRunner(rid)
        if (base <= (endBase.get(canon)?.base ?? 0)) continue
        const rEt = r.details?.eventType
        const code = legAdvanceCode(play, r)
        const slot = rEt && NON_PA_EVENT_TYPES.has(rEt) ? null : batterSlot
        endBase.set(canon, { base, code, slot })
      }
      // The batter's own natural reach base (his top-of-diamond code already
      // explains it) — a further base on this same play only gets a leg
      // notation once he's past it.
      const naturalBase = NATURAL_BASE[play.result?.eventType] ?? 1
      for (const [rid, info] of endBase) {
        if (info.base > (progress.get(rid) ?? 0)) progress.set(rid, info.base)
        if (rid !== batterId) {
          const m = legs.get(rid) ?? {}
          m[info.base] = { code: info.code, slot: info.slot }
          legs.set(rid, m)
        } else if (info.base > naturalBase) {
          // A bonus base on the batter's own trip — attribute it to this
          // play's error (the fielder who's actually charged, even if the
          // feed's own error credit landed on a different runner's leg —
          // see playErrorCredit) when there is one, else fall back to the
          // same code his fellow baserunners would get for this play. No
          // slot superscript here — that notes which TEAMMATE's at-bat
          // drove a runner over, and a batter can't drive himself.
          const m = legs.get(rid) ?? {}
          m[info.base] = { code: playErrorCredit(play) ?? info.code, slot: null }
          legs.set(rid, m)
        }
      }
    }
  }

  // Bank every batter's final (or only) trip.
  for (const batterId of originIndex.keys()) finalizeTrip(batterId)

  return entries
}
