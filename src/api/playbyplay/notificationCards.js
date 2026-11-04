// Mound-visit accounting plus the card-field builders for every mid-inning
// notification card (a pitching change, a defensive sub, a pinch runner/
// hitter) and the sentence-casing helper their prose text runs through. See
// ../playbyplay.js's header for the module's overall spoiler footing. Split
// (ADR-0038, check-file-size.mjs) out of src/api/playbyplay.js.

import { personNameParts } from '../select.js'
import { linkifyNames } from './shared.js'

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
