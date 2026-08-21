// Mound-visit accounting plus the card-field builders for every mid-inning
// notification card (a pitching change, a defensive sub, a pinch runner/
// hitter) and the sentence-casing helper their prose text runs through. See
// ../playbyplay.js's header for the module's overall spoiler footing. Split
// (ADR-0038, check-file-size.mjs) out of src/api/playbyplay.js.

import { personNameParts } from '../select.js'
import { linkifyNames } from './shared.js'

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

// The incoming pinch hitter's card fields for a mid-inning "now batting" note
// (see BatterNotice) — same "Last, First" + jersey shape as
// pitchingChangePitcher/defensiveChangeFielder, no hand/position since
// BatterNotice shows neither.
export function pinchHittingBatter(feed, playerId) {
  if (playerId == null) return null
  const person = feed?.gameData?.players?.[`ID${playerId}`] ?? {}
  const { last, first, useName } = personNameParts(person)
  const name = last
    ? `${last}${first ? `, ${useName || first}` : ''}`
    : person.fullName ?? ''
  return { id: playerId, name, jersey: person.primaryNumber ?? '' }
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

// ---------------------------------------------------------------------------
// WHICH DELAY ADVISORIES ARE WORTH A CARD.
//
// eventTypes.js's isDelayAdvisory answers "is this an in-game stoppage or the feed's own
// lifecycle bookkeeping". It does NOT answer "did anything come of it", and
// most of the time nothing did. Two independent sweeps — 41 Final MLB games
// (2026-08-16..18) and 53 more (2026-08-12..15) — carried 48 and 53 delay
// advisories, about 1.1 per game, and 81% / 85% of them were a sub-minute
// "Injury Delay." or "On-field Delay." with no substitution after it and
// nothing else to report.
//
// An empty one does not merely take up room, it MISLEADS. The card lands next
// to whichever plate appearance the stoppage interrupted, so it reads as being
// about that batter — and the advisory's own `player` field says the same
// thing, because that field is the man in the box, not the subject:
//   gamePk 824319, bottom 7 — "Injury Delay." names Jake McCarthy (batting)
//     when the injured man is the CATCHER, Hunter Feduccia, replaced one event
//     later.
//   gamePk 823670, top 8 — names Alec Bohm (batting) when the man who left is
//     the left fielder, Austin Martin.
//   gamePk 824398, top 5 — names Christian Koss (batting) when the man who
//     left is the home plate UMPIRE.
// Only one of the sampled advisories named its real subject (gamePk 824642,
// bottom 3, where the batter himself was the one replaced).
//
// So a delay earns a card on one of two grounds, and is dropped otherwise: it
// PRODUCED something (a personnel change before the next pitch), or it stopped
// play long enough to be worth a mark on its own. ADR-0060.
// ---------------------------------------------------------------------------

// Non-pitch events that count as a delay having produced something — the four
// that let the card say something no neighbouring card already says.
//
// Three are a man LEAVING, and the card that follows each of them announces
// only the man coming IN ("Ben Rortvedt now catching"), never why his
// predecessor went out. That "why" is the delay card's whole contribution.
// The fourth, `umpire_substitution`, is absent from eventTypes.js's
// STOPPAGE_EVENTS and so has no card at all — without the delay card an umpire leaving mid-inning
// would appear nowhere in the app.
//
// Three plausible neighbours are deliberately absent. A mound visit is a
// stoppage in its own right, with its own card and its own accounting, not a
// consequence of this one. An ejection and a bare defensive switch do each get
// a card, and each card already carries the whole account — so a delay card
// stacked above one would only repeat it, which is the noise this rule exists
// to remove.
const DELAY_CONSEQUENCE_EVENTS = new Set([
  'pitching_substitution',
  'defensive_substitution',
  'offensive_substitution',
  'umpire_substitution',
])

// How long a stoppage has to run to earn a card with no personnel change after
// it — the weather delays, essentially. The measured durations split cleanly
// either side of this: of the 39 measurable stoppages in the first sweep, 34
// ran 0-2 minutes and two more ran 3 and 4; the next shortest was 11 (an
// umpire crew change), then 24, 86, 152 and 183, every one of them weather.
const MIN_STANDALONE_DELAY_MINUTES = 5

// What a delay advisory produced, or null when it produced nothing.
//
// Scans forward from the advisory's own index to the next PITCH of the same
// play. The feed puts a stoppage and the change it caused side by side inside
// the playEvents of the plate appearance the stoppage interrupted, and never
// leaves a pitch between the two — verified across both sweeps, where all 101
// delay advisories had a later pitch in their own play, so this window never
// runs off the end of one.
//
// `replacedId` is the man who LEFT, which is the subject the card wants and
// the advisory's own `player` is not. The feed puts him on `replacedPlayer`
// for a defensive or offensive substitution (3 of 3 in the sweep) but never
// for a pitching change (0 of 5), whose departing arm is named only in the
// prose — so `description` rides along for the caller to resolve that one
// against the name index it has already built.
function delayConsequence(playEvents, index) {
  for (let i = index + 1; i < (playEvents ?? []).length; i++) {
    const e = playEvents[i]
    if (e?.isPitch) return null
    const eventType = e?.details?.eventType
    if (!DELAY_CONSEQUENCE_EVENTS.has(eventType)) continue
    return {
      eventType,
      replacedId: e?.replacedPlayer?.id ?? null,
      enteringId: e?.player?.id ?? null,
      description: e?.details?.description ?? '',
    }
  }
  return null
}

// Whole minutes a stoppage lasted, or null while it is still going on (no
// resume yet) and for the sub-minute brackets the feed writes around a
// momentary hold. The advisory's own startTime/endTime bracket the stoppage —
// its endTime is when play resumed — so no pairing with the "In Progress"
// advisory that follows is needed. Same arithmetic, and the same one-minute
// floor, as api/select.js's selectDelays runs for the between-half DelayCard.
function delayStoppageMinutes(event) {
  const start = event?.startTime ? Date.parse(event.startTime) : NaN
  const end = event?.endTime ? Date.parse(event.endTime) : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return end - start > 60_000 ? Math.round((end - start) / 60_000) : null
}

// The delay's headline, cleaned up for a card. The feed writes four shapes and
// only the first two arrive readable:
//   "Injury Delay."                                    -> "Injury delay"
//   "On-field Delay."                                  -> "On-field delay"
//   "Status Change - Delayed: Rain"                    -> "Rain delay"
//   "Status Change - Delayed Start: Inclement Weather" -> "Inclement weather delay"
// The last two are the feed's lifecycle spelling for a weather stoppage, and
// printing them verbatim put "Status change - delayed:" on the card ahead of
// the one word a reader is actually looking for. Only the weather branch
// lowercases freely — its tail is a reason ("Rain", "Field Conditions"), never
// a person; the other branch touches nothing but the word "Delay" itself, so a
// description that names someone keeps his capitals.
export function delayHeadline(description) {
  const text = (description ?? '').trim().replace(/\.$/, '')
  const weather = /^status change\s*-\s*delayed(?:\s+start)?\s*:\s*(.+)$/i.exec(text)
  if (weather) {
    const reason = weather[1].trim().toLowerCase()
    return `${reason.charAt(0).toUpperCase()}${reason.slice(1)} delay`
  }
  return text.replace(/\bDelay\b/g, 'delay')
}

// Which club the man a delay is about belongs to, so the card can hang the
// right team's mark behind his headshot. A pitching change or a defensive
// substitution takes someone off the FIELDING side; a pinch-hitter or
// pinch-runner takes someone off the BATTING side. One key per member of
// DELAY_CONSEQUENCE_EVENTS that has a subject at all — an umpire change has
// none, and falls through to null.
const DELAY_SUBJECT_SIDE = {
  pitching_substitution: 'pitching',
  defensive_substitution: 'pitching',
  offensive_substitution: 'batting',
}

// A pitching change never carries `replacedPlayer` — 0 of 5 in the sweep, against
// 3 of 3 for the offensive/defensive substitutions — so the arm going OUT is
// named only in the prose: "Pitching Change: Javier Assad replaces Kevin
// Gausman." Read him off the same name index the card's own text is linkified
// with, as the last person named who is not the man coming in.
function departingPitcherId(consequence, nameIndex) {
  if (consequence.eventType !== 'pitching_substitution') return null
  const named = linkifyNames(consequence.description, nameIndex).filter(
    (s) => s.id != null && s.id !== consequence.enteringId,
  )
  return named.at(-1)?.id ?? null
}

// The man a delay is really about, and the sentence that says what became of
// him. Empty when he cannot be resolved at all — a thin MiLB feed that names a
// substitute the roster has never heard of — which the caller then treats as
// the delay having nothing to say.
function delaySubject(feed, consequence, nameIndex) {
  if (!consequence) return { id: null, side: null, detail: '' }
  // An umpire change is the one consequence with no card of its own —
  // `umpire_substitution` is not in eventTypes.js's STOPPAGE_EVENTS — so if
  // the delay card does not carry it, a crew change appears nowhere at all.
  if (consequence.eventType === 'umpire_substitution') {
    return { id: null, side: null, detail: 'Umpire change' }
  }
  const id = consequence.replacedId ?? departingPitcherId(consequence, nameIndex)
  const name = id == null ? '' : (feed?.gameData?.players?.[`ID${id}`]?.fullName ?? '').trim()
  if (!name) return { id: null, side: null, detail: '' }
  return {
    id,
    side: DELAY_SUBJECT_SIDE[consequence.eventType] ?? null,
    detail: `${name} leaves the game`,
  }
}

// The card fields for ONE delay advisory, or null when the delay produced
// nothing and should not be carded at all. The rule, and the two sweeps behind
// it, are directly above under "WHICH DELAY ADVISORIES ARE WORTH A CARD"
// (ADR-0060); this builds what survives it.
//
// `playerId` is deliberately NOT the advisory's own `player`. That field names
// whoever stood in the batter's box when play stopped, which is the wrong
// person in all but one of the sampled cases — it is what made these cards read
// as being about a batter who had nothing to do with the stoppage. This one is
// the man who LEFT.
export function delayNoteFields(feed, event, playEvents, index, nameIndex) {
  const consequence = delayConsequence(playEvents, index)
  const minutes = delayStoppageMinutes(event)
  const long = minutes != null && minutes >= MIN_STANDALONE_DELAY_MINUTES
  const subject = delaySubject(feed, consequence, nameIndex)
  // The rule in one line: a delay card that cannot say anything is not drawn.
  // Either it names what became of somebody, or it reports a stoppage long
  // enough to be worth a mark on its own. A consequence that resolved to no
  // name — a substitution whose departing man is missing from a thin feed —
  // falls through here exactly like a delay that produced nothing.
  if (!subject.detail && !long) return null
  return {
    title: delayHeadline(event?.details?.description ?? ''),
    detail: subject.detail,
    playerId: subject.id,
    subjectSide: subject.side,
    // Carried only when it is worth printing. Every stoppage the feed brackets
    // has SOME duration, but a card that says "play stopped for 1 min" beside a
    // substitution is noise dressed as detail.
    minutes: long ? minutes : null,
  }
}
