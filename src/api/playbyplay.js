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

import { personNameParts, startingPositionAbbr } from './select.js'
import { defenseEntering } from './defense.js'
import { challengeForPlay } from './challenges.js'

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

// Two more local-only, NON_PA_EVENT_TYPES-adjacent classifications — kept out
// of the shared set above (also used for PA/BF counting in this file and in
// pitchers.js/derive.js, where neither belongs) but named here rather than
// spelled out inline at each call site, so the two lists below can't drift
// apart from each other without a reader noticing why they differ.
//
// BASERUNNING_NOTE_EVENT_TYPES: playEvents[].details.eventType values with no
// plate appearance of their own that still deserve a baserunning sub-line
// when they carry a description — every NON_PA_EVENT_TYPES code, plus
// `runner_placed` (the automatic extra-innings runner, placed on 2nd to begin
// the half) and `defensive_indiff`. Verified against gamePk 777747's bottom
// of the 10th (Joey Ortiz's placement, Brice Turang's defensive-indifference
// advance) — without this, both fell through with no card and no baserunning
// sub-line, leaving no trace of how a runner got to base.
//
// NO_SLOT_CREDIT_EVENT_TYPES: runners[].details.eventType values that are
// self-driven and credit no batter's plate appearance / lineup slot — every
// NON_PA_EVENT_TYPES code, plus `defensive_indiff` only. `runner_placed` is
// deliberately NOT here, and this is not an oversight: verified against the
// same gamePk 777747, a placed runner's own runners[] movement (when he moves
// at all) always carries the enclosing play's real result eventType (e.g.
// 'single'), never 'runner_placed' itself — there is nothing for this list to
// exclude for that event type.
export const BASERUNNING_NOTE_EVENT_TYPES = new Set([...NON_PA_EVENT_TYPES, 'runner_placed', 'defensive_indiff'])
const NO_SLOT_CREDIT_EVENT_TYPES = new Set([...NON_PA_EVENT_TYPES, 'defensive_indiff'])

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
// defensive-substitution notice. DH is here even though a DH never takes the
// field: a defensive SWITCH routinely moves a fielder INTO the DH slot (8 of
// them in a three-day MLB sweep), and the card has to name the slot he moved
// into or it renders "Now playing for the Orioles" with the position missing.
// Kept in step with select.js's own copy for the pre-pitch staged card.
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
  DH: 'designated hitter',
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
// the club fielding THIS half (the opposite of battingSide), returns one entry
// per mound visit IN this half, in order — the running "visits remaining"
// after it, or null for a trip that wasn't charged. One entry per visit either
// way: the caller (PlayByPlay) walks its mound-visit cards positionally.
// Remaining never goes negative.
//
// THE TRIP THAT REMOVES THE PITCHER ISN'T A VISIT. MLB's rule is explicit —
// "a manager or coach who visits the mound and removes the pitcher is not
// charged with a visit" — but statsapi logs that trip as a `mound_visit`
// playEvent all the same, sitting immediately ahead of the
// `pitching_substitution` it produced. In a three-day sweep of the MLB slate
// 66 of 214 mound-visit events (31%) were that trip. Charging them isn't
// slightly high, it's impossible: four club-games in that sweep reached SIX
// against an allowance of five, so the pip row was showing clubs out of visits
// they still had (gamePk 823843's home club read 6 used where the rule-correct
// figure is 2).
//
// A visit is the removal trip when a pitching change follows it before the
// club's next pitch — he never threw again, so the manager came for the ball.
// Tracked as a pending visit rather than a peek at the next playEvent because
// the feed nests a change at the head of the plate appearance AFTER the one
// the visit closed; every case in the sweep was same-play, but the rule
// doesn't promise that and neither does the feed.
//
// A trip left pending at the END of one of this club's earlier defensive
// halves (no isPitch/pitching_substitution before the half's last play) must
// settle there, not ride forward — the club's NEXT defensive half is one or
// more entire opposite-side halves later (a team only fields every other
// half), and those plays are skipped below without touching `pending`. Left
// unflushed, that stale trip would be resolved by the first pitch or change
// of a LATER half — a trip that has nothing to do with it — silently
// shifting `used` for every half after. So a half boundary for THIS side
// forces the settle itself, same as a genuine pitch or substitution would.
export function moundVisitRemainings(feed, inning, half, battingSide) {
  const defenseSide = battingSide === 'away' ? 'home' : 'away'
  const allowed = moundVisitsAllowed(inning)
  const targetIdx = half === 'bottom' ? inning * 2 : inning * 2 - 1 // 1-based half order
  let used = 0
  const inHalf = []
  // The visit whose trip hasn't resolved yet — charged once he throws another
  // pitch, uncharged if a pitching change lands first. `inHalf` is its slot,
  // reserved in order at the moment the visit happens and filled on settle, so
  // a visit that resolves during a later play still reports in the right place.
  let pending = null // { playIdx, slot }
  const settle = (charged) => {
    if (!pending) return
    if (charged) used += 1
    if (pending.slot != null) inHalf[pending.slot] = charged ? Math.max(0, allowed - used) : null
    pending = null
  }
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const pi = p.about?.inning
    const ph = p.about?.halfInning // 'top' | 'bottom'
    if (pi == null || ph == null) continue
    const playIdx = ph === 'bottom' ? pi * 2 : pi * 2 - 1
    if (playIdx > targetIdx) break
    if ((ph === 'top' ? 'home' : 'away') !== defenseSide) continue
    // A new half for this side arrived with the previous one's trip still
    // open — nothing more is coming to resolve it, so it stands as charged.
    if (pending && pending.playIdx !== playIdx) settle(true)
    for (const e of p.playEvents ?? []) {
      if (e.isPitch) {
        settle(true) // he stayed in and threw — that trip was a real visit
        continue
      }
      const et = e.details?.eventType
      if (et === 'pitching_substitution') {
        settle(false) // the manager came for the ball; not charged
      } else if (et === 'mound_visit') {
        settle(true) // two trips with no pitch between: the earlier one stands
        pending = { playIdx, slot: playIdx === targetIdx ? inHalf.push(null) - 1 : null }
      }
    }
  }
  settle(true) // a trip still open at the target half had no change after it
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

// The surname to use when a baserunning note has to NAME the runner it's
// about. Exported because the box-score roll-up builds the same note shape
// from the raw feed (api/callout-notes.js's buildGameCallouts) and the two
// must not drift — a call-out that reads correctly on the at-bat card and
// anonymously in the roll-up is the same bug in the other direction.
export function runnerLastName(feed, id) {
  if (id == null) return ''
  const person = feed?.gameData?.players?.[`ID${id}`] ?? {}
  return personNameParts(person).last || person.fullName || ''
}

// Swinging strike, swinging strike (blocked). Shared with derive.js.
export const WHIFF_CODES = new Set(['S', 'W'])
// Foul, foul bunt, foul tip. Shared with derive.js's per-half foul counters
// and scripts/gen-fouls.mjs (the season foul sweep) so the code set never
// drifts between the live and precomputed foul tallies.
export const FOUL_CODES = new Set(['F', 'L', 'T'])
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

// `positionEntering`: his fielding position as of entering the half this card
// belongs to (see computeHalfInningFeed's own defenseEntering call), when
// known. Falls back to his own boxscore starting position (startingPositionAbbr)
// for a player defenseEntering has no fielding assignment for yet — a fresh
// pinch-hitter's own at-bat card, before he's ever taken the field, or a
// pitcher (defenseEntering excludes 'P', which has its own table). Using
// `positionEntering` rather than a flat game-wide constant matters both ways:
// it must not show a not-yet-revealed FUTURE switch (confirmed against gamePk
// 823035's José Fermín, LF->3B->2B — his early cards must read LF, not his
// eventual 2B), and it must not get STUCK on his original entry role once a
// switch HAS already been revealed elsewhere on the same page (confirmed
// against gamePk 823035's Jackson Chourio, a pinch-hitter who becomes the
// left fielder — his cards from the half after that switch is revealed must
// read LF, not his one-time-only 'PH' entry role, which a flat
// startingPositionAbbr(box) read would otherwise show forever).
function resolveBatter(feed, side, id, positionEntering) {
  const person = feed?.gameData?.players?.[`ID${id}`] ?? {}
  const box = feed?.liveData?.boxscore?.teams?.[side]?.players?.[`ID${id}`] ?? {}
  return {
    id,
    fullName: (person.fullName ?? '').trim(),
    ...personNameParts(person),
    pos: positionEntering ?? startingPositionAbbr(box),
  }
}

// Strips the batter's own name off the front of an MLB description sentence
// (they're already named on the card) — descriptions are templated and
// consistently lead with the exact full name, except for a replay-challenge
// prefix ("Rockies challenged (play at 1st), call on the field was upheld:
// Tyler Soderstrom singles...", verified against gamePk 778442), where the
// name sits after a "...: " clause instead of at the very start. Handle that
// case too — the challenge language stays visible, only the duplicated name
// is removed — and fall back to the untrimmed sentence rather than mangling
// it if neither pattern matches.
function trimLeadingName(description, fullName) {
  if (!description) return ''
  if (!fullName) return description
  if (description.startsWith(fullName)) {
    const rest = description.slice(fullName.length).trim()
    if (rest) return rest.charAt(0).toUpperCase() + rest.slice(1)
  }
  const marker = `: ${fullName}`
  const at = description.indexOf(marker)
  if (at !== -1) {
    const before = description.slice(0, at + 1)
    const after = description.slice(at + marker.length).trim()
    if (after) return `${before} ${after}`
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
  // A force out retires a PRECEDING runner while the batter reaches 1st
  // safely by rule (a batter also put out on the play is a double play, its
  // own eventType — see DOUBLE_PLAY_EVENTS below) — the batter's own
  // scorebook mark is "FC", same as a true fielder's choice. Verified
  // against gamePk 823035 ("Grounds into a force out… to 1st"): eventType
  // `force_out`, batter's own runner entry `end: '1B'`, no `isOut`. Without
  // this entry scorebookCode fell to the generic out-fallback, and since the
  // batter himself carries no putout/assist credits there, it silently
  // returned an empty code — a blank diamond with no label at all.
  force_out: 'FC',
  catcher_interf: 'CI',
}

const HIT_EVENTS = new Set(['single', 'double', 'triple', 'home_run'])

// Sacrifices — a plate appearance that is not an at-bat, each with its own
// scorebook mark. The `_double_play` variants are a sacrifice on which a second
// runner was also retired; the batter's own mark is still the sacrifice.
const SAC_FLY_EVENTS = new Set(['sac_fly', 'sac_fly_double_play'])
const SAC_BUNT_EVENTS = new Set(['sac_bunt', 'sac_bunt_double_play'])

// The FULL fielding chain for a ground-ball double/triple play, walked across
// EVERY runner retired on the play (in the order they were put out) rather
// than just the batter's own assist+putout pair — his own credits alone read
// "6-3" for a 4-6-3 double play, silently dropping the second baseman who
// started it (verified against a live 4-6-3: the front runner's own entry
// carries assist-6/putout-4, the batter's carries assist-4/putout-3 — the
// relay fielder shows up as BOTH the front runner's putout and the batter's
// assist, so consecutive duplicates collapse to one mention: 6, 4, 4, 3 →
// "6-4-3"). Runners are ordered by their own `movement.outNumber`, the same
// half-inning out sequence number runnerOutCode reads.
function fullChain(play) {
  const outRunners = (play.runners ?? [])
    .filter((r) => r.movement?.isOut && (r.credits ?? []).some((c) => /putout|assist/.test(c.credit ?? '')))
    .sort((a, b) => (a.movement?.outNumber ?? 0) - (b.movement?.outNumber ?? 0))
  const codes = []
  for (const r of outRunners) {
    for (const c of r.credits ?? []) {
      if (!/putout|assist/.test(c.credit ?? '')) continue
      const code = c.position?.code ?? ''
      if (code && codes[codes.length - 1] !== code) codes.push(code)
    }
  }
  return codes.join('-')
}

// The fielders who actually RETIRED somebody on this runner's leg, in feed
// order — his putout and assist credits, and nothing else. Everything else the
// feed hangs on `credits` records no out at all: `f_fielding_error` when the
// fielder booted it, `f_fielded_ball` when he picked the ball up and made no
// play. Letting those into the fielding chain invents a putout nobody made —
// a sacrifice bunt the third baseman threw away came out "SAC 5U", which reads
// as an unassisted putout BY that third baseman on a play where every runner
// was safe (verified against gamePk 818035's bottom 8th; the no-error twin is
// gamePk 824087's bottom 9th, an f_fielded_ball-only bunt that read "SAC 2U").
// Exact-matched rather than a substring test on "assist" for the same reason
// runnerOutCode is: an outfielder's throw carries `f_assist_of` alongside his
// `f_assist` and would double him up in the chain.
function outChain(runner) {
  return (runner?.credits ?? [])
    .filter((c) => c.credit === 'f_putout' || c.credit === 'f_assist')
    .map((c) => c.position?.code ?? '')
}

// "E5" for whichever fielder was charged with an error on this runner's own
// leg; '' when none was.
function errorCodeFor(runner) {
  const errCred = (runner?.credits ?? []).find((c) => /error/.test(c.credit ?? ''))
  return errCred ? `E${errCred.position?.code ?? ''}` : ''
}

// The mark for a SACRIFICE the batter was not retired on. He still gets the
// sacrifice — the rule credits one when a runner advances on a bunt or fly the
// batter would have been put out on but for the misplay — but there is no
// putout to pencil, so the tag carries how he REACHED instead: the charged
// error ("SAC E5"), or "FC" when the defense simply never played him (no out,
// no error). Same shape as the reached-on-a-strikeout mark ("K E2", "K WP")
// and, like it, a REACH kind: an out code is centered inside the diamond, and
// centering one here contradicted a diamond already showing the batter safe at
// first.
function sacReachCode(tag, batterRunner) {
  const err = errorCodeFor(batterRunner)
  return { code: `${tag} ${err || 'FC'}`, codeKind: err ? 'error' : 'reach' }
}

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
  const chain = outChain(batterRunner)

  if (et === 'field_error') {
    return { code: errorCodeFor(batterRunner) || 'E', codeKind: 'error' }
  }
  // Every strikeout is a K — swinging, on a foul tip, on a foul bunt, a checked
  // swing — keyed off the eventType, not one description phrasing (a foul-tip K
  // reads "strikes out on a foul tip", not "…swinging", and used to fall through
  // to the catcher's putout "2"). The customary backwards "looking" K is drawn
  // only for a called third strike.
  if (et === 'strikeout' || et === 'strikeout_double_play') {
    // An uncaught/dropped third strike (or a strike three that got away on a
    // wild pitch / passed ball) still counts as a strikeout and an at-bat, but
    // the batter is NOT out — he reached first. Render it as a REACH (a top
    // code over a diamond that shows him aboard), annotated with how he got on,
    // rather than an out code penciled in the diamond center. Without this the
    // card showed a lone "K" over a diamond that already had him safe at first.
    const reachedSafe = batterRunner && !batterRunner.movement?.isOut && !!batterRunner.movement?.end
    if (reachedSafe) {
      // How he got on: a wild pitch or passed ball when the description names
      // one, else the charged error (E{pos}) when the feed carries an error
      // credit. When none is present, don't fabricate a catcher error — leave
      // it a bare "K" reach (the diamond still shows him aboard), since an
      // uncaught third strike can be scored with no error charged at all.
      let how = ''
      if (/wild pitch/i.test(desc)) how = 'WP'
      else if (/passed ball/i.test(desc)) how = 'PB'
      else how = errorCodeFor(batterRunner)
      return { code: how ? `K ${how}` : 'K', codeKind: 'reach' }
    }
    if (/called out on strikes/i.test(desc)) return { calledLooking: true, codeKind: 'out' }
    return { code: 'K', codeKind: 'out' }
  }
  // A sacrifice fly reads "SF" with the fielder who made the catch (SF8); a sac
  // bunt "SAC" with its fielding chain (SAC 1-3). Keyed off the eventType (with
  // a description fallback) BEFORE the generic fly/ground branches below —
  // without it a sac fly's "hits a sacrifice fly to center fielder…" missed the
  // /flies (out|into)/ test and fell through to the unassisted-putout branch,
  // coming out as a bogus infield "8U".
  // Either can also come back with the batter SAFE — a sacrifice is credited
  // on a misplay that would otherwise have retired him — so both check that
  // before writing an out (see sacReachCode). Same test the strikeout branch
  // above uses.
  const reachedOnSac = batterRunner && !batterRunner.movement?.isOut && !!batterRunner.movement?.end
  if (SAC_FLY_EVENTS.has(et) || /sacrifice fly/i.test(desc)) {
    if (reachedOnSac) return sacReachCode('SF', batterRunner)
    return { code: `SF${chain[chain.length - 1] ?? ''}`, codeKind: 'out' }
  }
  if (SAC_BUNT_EVENTS.has(et) || /sacrifice (bunt|hit)/i.test(desc)) {
    if (reachedOnSac) return sacReachCode('SAC', batterRunner)
    const c = chain.length === 1 ? `${chain[0]}U` : chain.join('-')
    return { code: c ? `SAC ${c}` : 'SAC', codeKind: 'out' }
  }
  // A double/triple play the batter hit into gets the play tag on his OWN card
  // too (the erased runner's card already gets one via runnerOutCode) — a bare
  // "6-4-3" doesn't say it turned two.
  const dpTag =
    et === 'grounded_into_double_play' || /into a double play/i.test(desc)
      ? 'DP '
      : et === 'triple_play' || et === 'grounded_into_triple_play' || /into a triple play/i.test(desc)
        ? 'TP '
        : ''
  // A ball caught for the out in FOUL territory gets an "F" penciled in front
  // of its normal code (a foul pop out to 1st is FP3, a foul fly to left is
  // FF7) — MLB's description names it explicitly ("… in foul territory").
  const foul = /in foul territory/i.test(desc) ? 'F' : ''
  if (/lines? (out|into)/i.test(desc)) return { code: `${dpTag}${foul}L${chain[chain.length - 1] ?? ''}`, codeKind: 'out' }
  // A pop out (P) is its own scorebook code, distinct from a fly out (F) —
  // both come back from MLB as "pops out"/"flies out" in the description.
  if (/pops? (out|into)/i.test(desc)) return { code: `${dpTag}${foul}P${chain[chain.length - 1] ?? ''}`, codeKind: 'out' }
  if (/flies? (out|into)/i.test(desc)) return { code: `${dpTag}${foul}F${chain[chain.length - 1] ?? ''}`, codeKind: 'out' }
  // A single-fielder chain (no throw — he fielded it and recorded the putout
  // himself) is the scorebook's "unassisted" play: 3U, 6U, etc, not a bare
  // position number.
  const code = chain.length === 1 ? `${chain[0]}U` : chain.join('-')
  // A batter grounding into a double/triple play gets the FULL relay chain
  // (fullChain, above) rather than just his own assist+putout pair — and the
  // double-play case reads "GIDP" over the chain, on its own line, the way a
  // scorer pencils "GIDP" above the fielding numbers rather than running them
  // together as one cramped "DP 6-3".
  if (dpTag === 'DP ') return { code: `GIDP\n${fullChain(play) || code}`, codeKind: 'out' }
  if (dpTag === 'TP ') return { code: `${dpTag}${fullChain(play) || code}`, codeKind: 'out' }
  return { code: `${dpTag}${code}`, codeKind: 'out' }
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
  // A bases-loaded balk — the one that forces a run in — is its own
  // runner-level eventType, NOT the plain `balk` above (found in a July 2026
  // sweep of the MLB slate). It's a balk on the scoresheet either way; without
  // this key the leg fell through to advanceCode's ground-out "GO".
  forced_balk: 'BK',
  field_error: 'E', error: 'E', fielders_choice: 'FC', fielders_choice_out: 'FC',
  // Verified against gamePk 777747's bottom of the 10th (Brice Turang
  // 1B->2B during Jackson Chourio's walk): without this entry,
  // legAdvanceCode fell back to the enclosing play's own result type
  // ('walk'), mislabeling the advance "BB" as if Chourio's own plate
  // appearance had driven it.
  defensive_indiff: 'DI',
  // Same REACH_CODES entry (scorebookCode) already uses for the batter's
  // OWN reach-on-CI — without this, a runner forced up by someone else's
  // catcher's-interference call fell all the way through advanceCode's
  // fallback to the generic ground-out "GO", mislabeling the leg (verified
  // live: Michael Harris II to 2nd on Mauricio Dubón's catcher interference
  // showed "GO5" — a ground-out code for a play that was neither a ground
  // ball nor an out).
  catcher_interf: 'CI',
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

// The scorer's mark penciled above an INTERRUPTED at-bat's diamond: the
// shorthand for the baserunning event that ended the half plus the
// carry-over arrow ("CS →", "PK →") — the paper-scorebook convention of
// pointing at the next inning's column, where this batter's at-bat restarts
// from scratch. Tags mirror runnerOutCode's (CS/PK/…) so the interrupted
// card and the caught runner's own out notation can't drift apart.
export function interruptedCode(eventType) {
  const et = eventType ?? ''
  let tag = ''
  if (et.startsWith('caught_stealing')) tag = 'CS'
  else if (et.startsWith('pickoff')) tag = 'PK' // includes pickoff_caught_stealing
  else if (et.startsWith('stolen_base')) tag = 'SB'
  else if (et === 'wild_pitch') tag = 'WP'
  else if (et === 'passed_ball') tag = 'PB'
  else if (et === 'balk') tag = 'BK'
  return tag ? `${tag} →` : '→'
}

// The pitch-sequence fields an at-bat card renders, shared by a real plate
// appearance's card and an INTERRUPTED at-bat's card (a top-level baserunning
// play that carries the pitches thrown to whoever was mid-count when the half
// ended on the bases — see the main loop). Per-pitch detail feeds the
// strike-zone diagram: plate-crossing location (pX/pZ) against the batter's
// own zone (strikeZoneTop/Bottom), plus velo and pitch type for the sequence
// list. All Statcast-ish, so every field is null-guarded — at MiLB parks with
// no tracking pX/pZ are simply absent and StrikeZone renders nothing (same
// degrade as derive.js).
// `feed` is only needed for challengeForPlay's team-id lookup (challenges.js)
// — everything else here reads straight off `play`.
function pitchCardInfo(feed, play) {
  const pitchEvents = (play.playEvents ?? []).filter((e) => e.isPitch)
  const pitches = pitchEvents.map(pitchCallCode)
  // At most one challenge per play (challengeForPlay's own contract) — pinned
  // to a pitchNumber, matched against each pitch's own `no` below so only
  // that one pitch's row carries it.
  const challenge = challengeForPlay(feed, play)
  const pitchDetails = pitchEvents.map((e, i) => {
    const code = pitchCallCode(e)
    const pd = e.pitchData ?? {}
    const co = pd.coordinates ?? {}
    const no = e.pitchNumber ?? i + 1
    return {
      no,
      code,
      cat: pitchDotCategory(code),
      px: typeof co.pX === 'number' ? co.pX : null,
      pz: typeof co.pZ === 'number' ? co.pZ : null,
      szTop: typeof pd.strikeZoneTop === 'number' ? pd.strikeZoneTop : null,
      szBottom: typeof pd.strikeZoneBottom === 'number' ? pd.strikeZoneBottom : null,
      mph: typeof pd.startSpeed === 'number' ? pd.startSpeed : null,
      type: e.details?.type?.description ?? '',
      callDesc: e.details?.call?.description ?? '',
      challenge: challenge?.pitchNumber === no ? challenge : null,
    }
  })
  return { pitchEvents, pitches, pitchDetails }
}

// The pitcher a plate appearance faced (for the strike-zone panel's "vs"
// header) — his name parts off gameData, same shape as the batter. `hand`
// ('L'/'R', bio fact not a result) feeds the platoon-split call-out (see
// api/callout-notes.js), same field pitchers.js already reads.
function matchupPitcher(feed, play) {
  const pitcherId = play.matchup?.pitcher?.id
  if (pitcherId == null) return null
  const person = feed?.gameData?.players?.[`ID${pitcherId}`] ?? {}
  return { id: pitcherId, ...personNameParts(person), hand: person.pitchHand?.code ?? '' }
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
  force_out: 1,
}

// The fielder charged with an error anywhere on this play (Error position,
// scorebook-style E-code) — used to attribute a BATTER's own bonus base to
// the same misplay even when the feed's error credit landed on a different
// runner's movement entry than his (see gamePk 823036: the CF's fielding
// error credit sits on the trailing runner's leg, not the batter's own
// 1st->2nd leg, even though the same misplay is what let the batter move up
// too). Prefers whichever error is charged to the SAME fielder who fielded
// the batted ball (`f_fielded_ball`, recorded on the batter's own leg) —
// that's the fielder whose misplay actually let the batter advance — so a
// play with two DISTINCT errors (one enabling the batter's own extra base,
// a separate one advancing an unrelated runner) doesn't misattribute the
// batter's leg to whichever error happens to appear first in the feed. Falls
// back to the first error found when there's no fielded-ball credit to
// match against. Null when the play carries no error at all — its usual case.
function playErrorCredit(play) {
  let fielderCode = null
  const errorCodes = []
  for (const r of play.runners ?? []) {
    for (const c of r.credits ?? []) {
      if (c.credit === 'f_fielded_ball' && fielderCode == null) fielderCode = c.position?.code ?? ''
      if (/error/.test(c.credit ?? '')) errorCodes.push(c.position?.code ?? '')
    }
  }
  if (!errorCodes.length) return null
  const matched = fielderCode != null ? errorCodes.find((code) => code === fielderCode) : undefined
  return `E${matched ?? errorCodes[0]}`
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
  // Exact-matched, not a substring test: the feed also tags an outfielder's
  // assist with a SECOND credit, `f_assist_of` (for outfield-assist totals),
  // on the very same throw as his `f_assist` — a substring match on "assist"
  // catches both and doubles that fielder up in the chain (verified against
  // gamePk 817477's bottom 2nd, Cameron Sisneros out at 2nd on the throw:
  // right fielder 9 credited f_assist AND f_assist_of for the one throw to
  // short, which rendered "9-9-6" instead of "9-6").
  const chain = (runnerEntry.credits ?? [])
    .filter((c) => c.credit === 'f_putout' || c.credit === 'f_assist')
    .map((c) => c.position?.code ?? '')
    .join('-')
  let tag = ''
  if (et.startsWith('caught_stealing')) tag = 'CS'
  else if (et.startsWith('pickoff')) tag = 'PK' // includes pickoff_caught_stealing
  else if (DOUBLE_PLAY_EVENTS.has(et)) tag = 'DP'
  // Verified against gamePk 778442's top of the 2nd (Jacob Wilson grounds
  // into a 5-4-3 triple play): each of the two runners retired beyond the
  // batter carries this eventType on their own runners[] entry.
  else if (et === 'triple_play') tag = 'TP'
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

// atBatIndex of each batter's FIRST plate appearance with a runner actually
// on 2nd or 3rd as he stepped in — the RISP call-out (api/callout-notes.js)
// describes a season rate, but firing it on a batter's literal first PA
// regardless of who's on base (as firstPAIndexByBatter does for the streak/
// platoon/birthday notes) reads as a non sequitur when he leads off an inning
// with the bases empty. A plain re-walk of `runners[]` per play, base
// occupancy reset at each half-inning boundary — same idiom as
// umpireFavor.js's `bases`/`BASE_NUM` walk, just at play (not pitch)
// granularity. Reveal-only, like the rest of this module.
export function firstRispPAIndexByBatter(feed) {
  const first = new Map()
  const bases = [null, null, null]
  let curHalfKey = null
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const inning = p.about?.inning
    const half = p.about?.halfInning
    if (inning == null || half == null) continue
    const halfKey = `${inning}-${half}`
    if (halfKey !== curHalfKey) {
      bases[0] = bases[1] = bases[2] = null
      curHalfKey = halfKey
    }

    const bid = p.matchup?.batter?.id
    const isRealPA =
      bid != null &&
      !NON_PA_EVENT_TYPES.has(p.result?.eventType) &&
      p.result?.eventType !== GAME_ADVISORY_EVENT_TYPE
    if (isRealPA && (bases[1] || bases[2]) && !first.has(bid)) {
      first.set(bid, p.about?.atBatIndex ?? null)
    }

    for (const r of p.runners ?? []) {
      const startBase = BASE_NUM[r.movement?.start]
      const endBase = BASE_NUM[r.movement?.end]
      if (startBase && startBase <= 3) bases[startBase - 1] = null
      if (!r.movement?.isOut && endBase && endBase <= 3) bases[endBase - 1] = r.details?.runner?.id ?? null
    }
  }
  return first
}

// (Times-through-the-order counting used to live here as a per-PA map; the
// per-play note it fed was replaced by the pre-half strip's single persistent
// card, which does its own prior-halves walk — see buildThirdTimeThroughNote
// in api/callout-notes.js.)

// At-bat-mode stepping (ADR-0016): the entries index marking the end of the
// NEXT step from `fromCount` — everything up to and including the next
// plate-appearance card, PLUS the announcements that follow it, so one tap
// reads as "reveal the next batter, and whatever the managers did after him."
// Returns entries.length when no at-bat card remains after fromCount (trailing
// notes with nobody left to bat, e.g. a closing ejection).
//
// Trailing, not leading, is the whole point. The feed nests a stoppage at the
// head of the plate appearance that FOLLOWS it — in a three-day sweep of the
// MLB slate, 655 of 678 substitution/mound-visit playEvents sat before their
// own play's first pitch and NONE trailed after its last — so the notes
// sitting between two at-bat cards are the announcements made once the earlier
// batter was retired. Ending a step just before them stranded the change with
// the new pitcher's first batter: you tapped, and got the substitution and
// what it produced in the same breath, which is not the order a scorer works
// in (finish the batter, pencil the change, then see the next batter).
//
// The exception is an `event` marked `midAtBat` — a stoppage that landed
// BETWEEN pitches of the following plate appearance (a mound visit during an
// at-bat, the other 23 of those 678). That one genuinely belongs to the at-bat
// it interrupted, so it stops the trailing sweep and leads the next step
// instead, exactly as every note used to.
export function nextStepBoundary(entries, fromCount) {
  for (let i = fromCount; i < entries.length; i++) {
    if (entries[i].kind !== 'atbat') continue
    let end = i + 1
    while (end < entries.length && entries[end].kind === 'event' && !entries[end].midAtBat) end += 1
    return end
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

  // Each batting-side player's own fielding position as of entering THIS
  // half (see resolveBatter's doc) — a player on this side can only gain a
  // NEW fielding assignment during a half they're on DEFENSE, i.e. strictly
  // between halves from this function's point of view, never mid-way through
  // the batting half being rendered here, so one snapshot per call suffices.
  // `Infinity` for revealedThrough is safe on the same footing as BoxScore's
  // own whole-game read (defense.js's doc): this function is reveal-only and
  // only ever runs inside (inningNum, half)'s own SealBox reveal render, and
  // defenseEntering itself never looks past that half's first pitch.
  const positionEntering = new Map()
  for (const spot of defenseEntering(feed, battingSide, inningNum, half, Infinity) ?? []) {
    const cur = spot.entries[spot.entries.length - 1]
    if (cur?.id != null) positionEntering.set(cur.id, spot.position)
  }

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
  const earnedByBatter = new Map() // batterId -> whether his run was EARNED (only set when he scored)
  const finalizeTrip = (batterId) => {
    const cardIndex = originIndex.get(batterId)
    if (cardIndex == null) return
    const base = progress.get(batterId) ?? 0
    entries[cardIndex].scored = base === 4
    entries[cardIndex].reached = base
    entries[cardIndex].legNotations = legs.get(batterId) ?? {}
    // A run that scored UNEARNED (reached/advanced on an error or passed ball)
    // is circled on the diamond, the scorer's convention; default earned when
    // the feed doesn't say so, so a missing flag never mis-circles a clean run.
    entries[cardIndex].earned = earnedByBatter.has(batterId) ? earnedByBatter.get(batterId) : true
  }

  // Whether any real pitch has been thrown yet this half — used below to
  // recognize the half's very first pitching change (announced before its
  // first pitch) as the one selectHalfStartingPitcher already reports via
  // HalfInning's persistent "Now Pitching" card, so this feed doesn't push a
  // second, duplicate card for it.
  let anyPitchInHalf = false
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
    // batter he's running for) is a retroactive annotation, so it must not
    // appear on that earlier, already-revealed card until the pinch-running
    // notification itself is within the visible step window (ADR-0016) —
    // stepping through "he walked" must not silently show who ran for him
    // before that notification card has been reached. Each entry carries the
    // index of its own notification, NOT the enclosing play's visibility:
    // since nextStepBoundary sweeps trailing notes into the previous at-bat's
    // step, a step routinely ends MID-play, after this notice and before the
    // card of the play it leads. Gating on the play would then show "Peraza
    // runs for Schanuel" a full step before Schanuel's own card was struck
    // through — the two halves of one substitution, split across two taps.
    const pendingPinchRunnerCards = []
    // Whether a pitch has been thrown in THIS play yet — a stoppage after one
    // interrupted the at-bat in progress rather than following the previous
    // one, which is what decides the step it belongs to (see nextStepBoundary).
    let pitchInPlay = false
    for (const e of play.playEvents ?? []) {
      if (e.isPitch) {
        anyPitchInHalf = true
        pitchInPlay = true
        continue
      }
      const et = e.details?.eventType
      if (et === 'pitching_substitution' && !anyPitchInHalf) {
        // The half's very FIRST pitching change, before its first pitch, is
        // the same identity selectHalfStartingPitcher already reads (the
        // half's first play's matchup.pitcher) and HalfInning renders as its
        // persistent "Now Pitching" card for as long as the half is
        // reachable — before AND after reveal, unlike the staged pre-pitch
        // list this mirrors (see HalfInning's PrePitchChanges, which excludes
        // a pre-pitch pitching change for the same reason). Pushing it here
        // too would duplicate that header card once this half is revealed/
        // stepped into. A genuine MID-half change (anyPitchInHalf already
        // true) still gets its own card below, same as ever.
        continue
      }
      if (STOPPAGE_EVENTS.has(et)) {
        const text = sentenceCaseEventText(e.details.description)
        entries.push({
          kind: 'event',
          eventType: et,
          midAtBat: pitchInPlay,
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
        const noteIndex = entries.length
        entries.push({
          kind: 'event',
          eventType: 'pinch_running',
          midAtBat: pitchInPlay,
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
        // (pendingPinchRunnerCards) is deferred to the step check below.
        const pinchId = e.player?.id
        const replacedId = e.replacedPlayer?.id
        if (pinchId != null && replacedId != null) {
          prAlias.set(pinchId, replacedId)
          const cardIndex = originIndex.get(rootRunner(replacedId))
          if (cardIndex != null) {
            const person = feed?.gameData?.players?.[`ID${pinchId}`] ?? {}
            pendingPinchRunnerCards.push({
              cardIndex,
              noteIndex,
              id: pinchId,
              ...personNameParts(person),
              base: e.base ?? null,
            })
          }
        }
      } else if (et === 'runner_placed' && e.player?.id != null) {
        // The extra-innings automatic runner, placed on 2nd to begin the half.
        // He takes no plate appearance — no pitches, no result, no RBI — but
        // he is a live baserunner from the first pitch on, so he gets a CARD
        // rather than the sub-line under the leadoff batter he used to get.
        // That card is the whole point: registering him in `originIndex` is
        // what gives the advancement bookkeeping below somewhere to write his
        // legs, his out on the bases, and his run. Without one, every bit of
        // his trip was computed and then dropped on the floor for want of an
        // origin card — no diamond, no run in the stepped tally, and a pinch
        // runner FOR him resolving to nothing (see rootRunner/prAlias).
        //
        // `kind: 'placed'`, deliberately a THIRD kind rather than an at-bat
        // card carrying a flag. Two guards elsewhere key on `kind === 'atbat'`
        // and are correct as written only if a placement doesn't answer to it:
        // nextStepBoundary (a placement is not a step of its own — it bundles
        // forward with the leadoff plate appearance, exactly as today's event
        // note does, so no already-stored step count changes meaning) and
        // PlayByPlay's `hasAtBat` (a live half whose only fetched content is
        // the placement must not read as a whole revealed half).
        //
        // Field paths verified live against gamePk 777747's 10th, both halves:
        // `player.id` is the runner, `base` the base he's given (2), the event
        // is a non-pitch `action` nested at the head of the half's first plate
        // appearance. `runner_placed` stays in BASERUNNING_NOTE_EVENT_TYPES —
        // callout-notes.js reads that same exported set — so the duplicate
        // sub-line is suppressed by taking this branch first, not by narrowing
        // the set out from under that caller.
        const runnerId = e.player.id
        const runner = resolveBatter(feed, battingSide, runnerId, positionEntering.get(runnerId))
        const base = e.base ?? 2
        const cardIndex = entries.length
        entries.push({
          kind: 'placed',
          runnerId,
          runner,
          base,
          // The scorer's mark for the automatic runner, in the slot a batting
          // result would occupy. Books differ (AR / XIR / GR); AR is the most
          // widely used, and the card's own sentence explains it besides.
          code: 'AR',
          descSegments: linkifyNames(
            trimLeadingName(e.details?.description, runner.fullName),
            nameIndex,
          ),
          outNumber: null,
          outAt: null,
          outCode: '',
          // Seeded to the base he's GIVEN, not 0 — that's what makes his first
          // real leg (2nd → 3rd) register as a leg at 3 instead of being
          // discarded as "not past where he already stands". The two legs
          // below it are never notated: he didn't run them, and the diamond
          // draws them as the dotted ghost path instead (PlayDiamond's
          // `placedAt`).
          reached: base,
          scored: false,
          earned: true,
          legNotations: {},
        })
        originIndex.set(runnerId, cardIndex)
        progress.set(runnerId, base)
      } else if (BASERUNNING_NOTE_EVENT_TYPES.has(et) && e.details?.description) {
        // `e.player.id` on a baserunning playEvent is the runner it's about (the
        // stealer / picked-off man) — verified against a live steal — so a
        // leader call-out on a steal can key on the RUNNER, not the batter.
        // `runnerLast` rides along for the same reason the call-out keys on
        // him: these notes hang on the card of whoever was BATTING, so a
        // call-out about the runner has to name him or it reads as the
        // batter's (see api/callout-notes.js's steal families).
        const rid = e.player?.id ?? null
        baserunningNotes.push({
          eventType: et,
          runnerId: rid,
          runnerLast: runnerLastName(feed, rid),
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
      const batter = resolveBatter(feed, battingSide, batterId, positionEntering.get(batterId))
      const { pitchEvents, pitches, pitchDetails } = pitchCardInfo(feed, play)
      const pitcher = matchupPitcher(feed, play)

      const cardIndex = entries.length
      // A batter who reaches safely and is then thrown out stretching for an
      // extra base (singled, out at 2nd on the throw) gets TWO runners[]
      // entries on this SAME play: his own plate-appearance result
      // (`movement.start` null — he started this leg from home) and a later,
      // separate leg for the extra-base attempt (`movement.start` set — he
      // was already standing on a base when THAT leg happened). Prefer the
      // start-null entry here so scorebookCode reads his own hit, not the
      // out that came after it (see `stretchOut` below, which reads the
      // other one). Verified against gamePk 817477's bottom 2nd (Cameron
      // Sisneros singles, out at 2nd on the throw): two entries, same
      // playIndex, reach-then-out in that order — falling back to the bare
      // `.find()` keeps this a no-op for the common one-entry case.
      const batterRunner =
        runners.find((r) => r.details?.runner?.id === batterId && r.movement?.start == null) ??
        runners.find((r) => r.details?.runner?.id === batterId)
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
        earned: true,
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
        earnedByBatter.delete(batterId)
      }
      originIndex.set(batterId, cardIndex)

      if (batterRunner?.movement?.isOut) {
        card.outNumber = batterRunner.movement.outNumber
      }
      // The stretching-out leg itself (see batterRunner's doc above) — drawn
      // on his own diamond the same way any other runner's caught-advancing
      // out is (a capped path + the fielding chain, by the base he was
      // retired at); his own hit is already covered by scorebookCode above.
      const stretchOut = runners.find(
        (r) => r.details?.runner?.id === batterId && r.movement?.isOut && r.movement?.start != null,
      )
      if (stretchOut) {
        card.outNumber = stretchOut.movement.outNumber
        card.outAt = BASE_NUM[stretchOut.movement.outBase] ?? null
        card.outCode = runnerOutCode(play, stretchOut)
      }
    } else {
      // A top-level baserunning play with no plate appearance of its own — an
      // inning-ending caught stealing or pickoff, or a walk-off steal / wild
      // pitch — closes out whoever was mid-count at the plate. Two accounts
      // ride this play and would otherwise vanish:
      //
      //  1. The prose. Unlike a MID-PA baserunning event (a nested playEvent
      //     with its own description, collected into baserunningNotes above),
      //     a top-level play's account lives only in its result.description
      //     (verified against gamePk 823764, bottom 7: "Cooper Pratt caught
      //     stealing 2nd base…" appears in no playEvent). Fold it in as a note
      //     unless a nested note already told the same story.
      //  2. The interrupted at-bat itself. The play's pitch events are the
      //     pitches thrown to the batter who was up — they are NOT re-listed
      //     when his at-bat restarts from scratch next inning (same feed fact
      //     derive.js/pitchers.js lean on to count these pitches; see
      //     NON_PA_EVENT_TYPES' doc). Verified against the same game: Luis
      //     Lara saw 4 pitches (1-2) on the caught_stealing_2b play, then led
      //     off the 8th with a fresh count. Without a card those pitches
      //     appear in the half's PITCHES total but nowhere in the feed.
      //
      // So: with pitches on record, emit an INTERRUPTED at-bat card for the
      // batter — pitch ladder and zone detail as usual, but no scorebook code,
      // no out badge, an empty diamond, and the prose notes attached — else
      // fall back to standalone event notes. The batter deliberately does NOT
      // enter originIndex: he never reached base, and any runner attribution
      // must keep resolving to real cards (his own earlier trip this half, if
      // the lineup batted around).
      const isBaserunningPlay =
        play.result?.type === 'atBat' && NON_PA_EVENT_TYPES.has(play.result?.eventType)
      const notes = [...baserunningNotes]
      if (
        isBaserunningPlay &&
        play.result?.description &&
        !notes.some((n) => n.eventType === play.result?.eventType)
      ) {
        const outRunner = runners.find((r) => r.movement?.isOut) ?? runners[0]
        const rid = outRunner?.details?.runner?.id ?? null
        notes.push({
          eventType: play.result.eventType,
          runnerId: rid,
          runnerLast: runnerLastName(feed, rid),
          segments: linkifyNames(play.result.description, nameIndex),
        })
      }
      const { pitchEvents, pitches, pitchDetails } =
        isBaserunningPlay && batterId != null ? pitchCardInfo(feed, play) : { pitchEvents: [] }
      if (pitchEvents.length > 0) {
        // The interruption sentence is the card's own description (there is no
        // batting result to describe); the count at the stoppage is a real
        // scorer's note — on an inning-ending play it does NOT carry over
        // (the batter restarts at 0-0), so it exists nowhere else.
        const { balls, strikes } = play.count ?? {}
        const countTail =
          balls != null && strikes != null ? ` with the count ${balls}-${strikes}` : ''
        entries.push({
          kind: 'atbat',
          interrupted: true,
          batterId,
          atBatIndex: play.about?.atBatIndex ?? null,
          eventType: play.result?.eventType ?? null,
          playId: pitchEvents.at(-1)?.playId ?? null,
          batter: resolveBatter(feed, battingSide, batterId, positionEntering.get(batterId)),
          pitcher: matchupPitcher(feed, play),
          pitches,
          pitchDetails,
          batSide: play.matchup?.batSide?.code ?? '',
          rbi: play.result?.rbi ?? 0,
          descSegments: [
            { text: `At-bat not completed — the inning ended on the bases${countTail}.` },
          ],
          code: interruptedCode(play.result?.eventType),
          codeKind: 'interrupted',
          baserunningNotes: notes,
          outNumber: null,
          reached: 0,
          scored: false,
          earned: true,
          legNotations: {},
        })
      } else {
        for (const n of notes) {
          entries.push({
            kind: 'event',
            eventType: n.eventType,
            // No pitch was thrown in this play at all — that's why there's no
            // card to hang the prose on — so it interrupted no at-bat and
            // steps with the one before it (see nextStepBoundary).
            midAtBat: false,
            playerId: n.runnerId,
            segments: n.segments,
          })
        }
      }
    }

    // This play's own card/notes (if any) just pushed above — whether ITS
    // effect on other, already-carded runners may be applied yet depends on
    // whether the play itself is within the visible step window.
    const visible = stepCap == null || entries.length <= stepCap

    // See pendingPinchRunnerCards above — only pencil the incoming runner
    // onto the origin card once the pinch-running notification that announces
    // him is itself within the visible step window. Keyed on that NOTICE's
    // own index rather than the enclosing play's `visible`: a step ends after
    // the notes trailing an at-bat and before the card of the play they lead
    // (nextStepBoundary), so `visible` is false for that play precisely when
    // the notice IS on screen — which would show the swap announced and the
    // struck-through name a whole tap apart.
    for (const p of pendingPinchRunnerCards) {
      if (stepCap != null && p.noteIndex >= stepCap) continue
      const card = entries[p.cardIndex]
      card.pinchRunners = card.pinchRunners ?? []
      card.pinchRunners.push({ id: p.id, last: p.last, first: p.first, base: p.base })
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
    // The feed can split one runner's multi-base move into separate legs, and
    // NOT only across separate plays: when a wild pitch / steal happens mid-
    // count during the FOLLOWING batter's plate appearance, that batter's own
    // play carries the earlier runner's whole rest-of-the-way chain in its
    // OWN runners[] array — one entry per leg, each with its own eventType,
    // in chronological order (verified against gamePk 818039's bottom 5th:
    // Yerlin Confidan's single-play `runners[]` holds Alfredo Duno's 1B→2B
    // wild-pitch leg, then his 2B→3B steal leg, then his 3B→score leg off
    // the single itself — three entries, one runner, one play). A single
    // play can also stretch a steal into a further base on a throwing error
    // the same way (gamePk 817477's top 2nd: Ben McLaughlin's 1B→2B steal
    // leg, then a separate 2B→3B error leg on the same play). So: give EVERY
    // entry its own notation — comparing each leg's base against how far
    // this runner has progressed SO FAR (across earlier plays and any
    // earlier leg already processed this same play) rather than collapsing a
    // play down to one "furthest" leg, which used to silently drop every
    // intermediate leg's own code (a runner who WP'd to 2nd then stole 3rd
    // used to show only his eventual "reached home" notation, with no trace
    // of the WP or the SB). How he advanced is read from the runner's OWN
    // movement event, not the play's batting result: a steal / wild pitch /
    // passed ball / balk during another batter's PA is recorded on the
    // runner (details.eventType), so it must be tagged SB/WP/PB/BK rather
    // than the batter's BB/K/GO. Such a self-advance credits no hitter (slot
    // null); an advance driven by the batter's plate appearance credits his
    // lineup slot.
    if (visible) {
      // The batter's own natural reach base (his top-of-diamond code already
      // explains it) — a further base on this same play only gets a leg
      // notation once he's past it.
      const naturalBase = NATURAL_BASE[play.result?.eventType] ?? 1
      for (const r of runners) {
        const rid = r.details?.runner?.id
        if (rid == null || r.movement?.isOut) continue
        const base = BASE_NUM[r.movement?.end] ?? 0
        if (base === 0) continue
        // Credit a pinch runner's advance to the batter whose card he inherited.
        const canon = rootRunner(rid)
        // Not a genuine leg — this entry doesn't move him past where he
        // already stands, whether from an earlier play or an earlier leg
        // within THIS same play (processed in feed order above).
        if (base <= (progress.get(canon) ?? 0)) continue
        const rEt = r.details?.eventType
        const code = legAdvanceCode(play, r)
        const slot = rEt && NO_SLOT_CREDIT_EVENT_TYPES.has(rEt) ? null : batterSlot
        progress.set(canon, base)
        // A run (base 4) records whether it was earned — false only when the
        // feed explicitly says so, so a clean run is never mistakenly circled.
        if (base === 4) earnedByBatter.set(canon, r.details?.earned !== false)
        if (canon !== batterId) {
          const m = legs.get(canon) ?? {}
          m[base] = { code, slot }
          legs.set(canon, m)
        } else if (base > naturalBase) {
          // A bonus base on the batter's own trip — attribute it to this
          // play's error (the fielder who's actually charged, even if the
          // feed's own error credit landed on a different runner's leg —
          // see playErrorCredit) when there is one, else fall back to the
          // same code his fellow baserunners would get for this play. No
          // slot superscript here — that notes which TEAMMATE's at-bat
          // drove a runner over, and a batter can't drive himself.
          const m = legs.get(canon) ?? {}
          m[base] = { code: playErrorCredit(play) ?? code, slot: null }
          legs.set(canon, m)
        }
      }
    }
  }

  // Bank every batter's final (or only) trip.
  for (const batterId of originIndex.keys()) finalizeTrip(batterId)

  return entries
}
