// Mound-visit accounting plus the card-field builders for every mid-inning
// notification card (a pitching change, a defensive sub, a pinch runner/
// hitter) and the sentence-casing helper their prose text runs through. See
// ../playbyplay.js's header for the module's overall spoiler footing. Split
// (ADR-0038, check-file-size.mjs) out of src/api/playbyplay.js.

import { personNameParts } from '../select.js'

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
