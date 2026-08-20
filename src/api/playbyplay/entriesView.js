// Readers over computeHalfInningFeed's `entries[]` output — at-bat-mode
// stepping boundaries and the cap-respecting live-state snapshot for the
// scorebug HUD. None of these re-walk the raw feed; they all fold over the
// same entries array (or a cap-clamped slice of it) the caller already has.
// See ../playbyplay.js's header for the module's overall spoiler footing.
// Split (ADR-0038, check-file-size.mjs) out of src/api/playbyplay.js.
//
// THE TRAP EVERY READER HERE MUST CLEAR. `entries` is NOT a revealed prefix.
// computeHalfInningFeed pushes a card for every play in the half regardless of
// `stepCap` (see its own header) — the cap only gates what OTHER, already-
// pushed cards get retroactively annotated with. So a field READ OFF THE CARD
// ITSELF (`eventType`, `code`, `batter`) describes plays the reader has not
// stepped into yet, while a field WRITTEN BY the advancement bookkeeping
// (`scored`, `reached`, `outNumber`) is already cap-clamped. Anything folding
// over `entries` must slice to the cap first, or it silently reports the whole
// half. That is not hypothetical: an in-progress HIT count built on the
// unclamped array put the half's final H on the running line's totals column
// from the first "Next at-bat" tap — six hits announced on the leadoff batter
// of a big inning. `stepTotals` below is the one place that arithmetic lives
// now, precisely so the slice cannot be forgotten at a call site again.

import { HIT_EVENT_TYPES } from './eventTypes.js'

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

// MAY A STAGED HALF BE PROMOTED TO A FULL COMMIT? (ADR-0016's `onStepComplete`,
// amended by ADR-0055.) The commit is one-directional and persisted, so it must
// only ever mean "this reader has now seen the whole half" — and three separate
// things have to hold for that sentence to be true.
//
//   • The cap has reached the end of `entries`. Every card is on screen.
//   • At least one of them is an `atbat`. A live half's first fetched content
//     can be a leading event note with no plate appearance behind it yet —
//     extras' automatic placed-runner note is the standing case — and a cap
//     that has "caught up" to a lone note has caught up to no baseball at all.
//   • THE HALF IS OVER. This is ADR-0055's addition and the one that is easy to
//     miss, because on a finished half the first two conditions already imply
//     it. On the half being played they do not: `entries` is the half SO FAR, a
//     reader scoring along with the game reaches its end within a tap or two of
//     arriving, and committing there hands them every plate appearance that
//     lands afterwards already revealed — permanently, and on every device they
//     own. The at-bat-by-at-bat reveal would end, silently, at the exact moment
//     the reader caught up to the game they are watching.
//
// A half still in play reports `atHalfEdge` instead (PlayByPlay), and the
// commit lands on the tap that reveals the third out, once the half is real.
export function stepCommitReady(entries, cap, halfInProgress) {
  if (halfInProgress) return false
  if (!Array.isArray(entries) || entries.length === 0) return false
  if (!Number.isInteger(cap) || cap < entries.length) return false
  return entries.some((e) => e?.kind === 'atbat')
}

// Focus mode's display windows — one per revealed AT-BAT, NOT one per reveal
// tap. The two used to be the same walk (this function iterated
// nextStepBoundary and the caller counted the boundaries at or under the cap),
// and that identity snapped the reader's view backwards all game long.
//
// THE DEFECT, WHICH WAS NOT RARE. A stoppage is nested at the head of the play
// that FOLLOWS it (nextStepBoundary's own header has the count: 655 of 678),
// so a mound visit or a pitching change announced after an out reaches the
// feed the moment the NEXT batter steps in — after the tap that revealed the
// out, and with the cap already stored. Under the old walk that entry grew the
// last boundary past the stored cap, the `bounds.filter(b => b <= cap)` count
// dropped by one, and the reader — following the newest window — was moved
// back an at-bat while a card they had already charted reappeared. Replayed
// against a real feed (gamePk 823263, MIL @ SD, 11 innings) that fired on 14 of
// 89 taps; on one of them the count fell to zero and the windowed view dropped
// out from under the reader entirely. The same disqualified window is why a
// tier-1 notice (ADR-0017) could never cross the screen: it was filed into a
// window the count had just discarded.
//
// So the anchor is the at-bat, and the count of windows is the count of
// at-bats at or under the cap — which only ever grows, because an at-bat's own
// index cannot move. Window i covers (anchor[i-1], anchor[i]]: the leading
// notices plus the plate appearance they stage. A notice arriving after the
// tap that revealed the previous at-bat is simply not revealed yet, and lands
// at the head of the next window when it is.
//
// WHY THE LAST WINDOW DOES NOT SWALLOW WHAT TRAILS IT. An earlier draft of
// this ran the last window out to the cap, so a notice already inside the cap
// showed at once. It also showed AGAIN at the head of the next window as soon
// as that at-bat was revealed — the same mound visit drawn twice in
// consecutive taps, 25 times in the game above. A card belongs to exactly one
// window. The one exception is a note NO at-bat will ever follow (a closing
// ejection, a walk-off's aftermath): `entries` holds the whole half, so a look
// past the cap can tell "not revealed yet" from "nobody left to bat" without
// reading anything the cap does not already permit — the count of at-bats
// ahead is not a score.
//
// The reveal CAP is untouched: nextStepBoundary above still bundles a tap as
// "the next at-bat plus what the managers did after it" (see its own doc) —
// this is only WHERE the revealed entries display, never how many are
// revealed.
//
// Returns { start, end } pairs (entries[start..end)), one per revealed at-bat,
// oldest first. A cap holding only leading notices (the live edge of a half
// whose first plate appearance hasn't resolved, where an extras placement is
// often the only card there is) yields one window holding them, since the
// alternative is a tap that answers with a blank stage.
export function focusWindows(entries, cap) {
  const limit = cap == null ? entries.length : Math.min(Math.max(0, cap), entries.length)
  const wins = []
  let start = 0
  let more = false
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].kind !== 'atbat') continue
    if (i >= limit) {
      // An at-bat past the cap: it will own the trailing notices when it is
      // revealed, so they must not be drawn twice by showing them now.
      more = true
      break
    }
    wins.push({ start, end: i + 1 })
    start = i + 1
  }
  if (wins.length === 0) return limit > 0 ? [{ start: 0, end: limit }] : []
  // Nobody left to bat — the notes after the last at-bat have no other window
  // to go to, so the last one runs out to the cap.
  if (!more) wins[wins.length - 1].end = Math.max(wins[wins.length - 1].end, limit)
  return wins
}

// The half's runs and hits SO FAR — over the first `cap` entries only, which
// is the entire point of this function existing (read the module header). The
// caller reports these up so RollingLine's own cell and its R/H totals column
// build up one "Next at-bat" tap at a time instead of sitting blank until the
// half's 3rd out.
//
// The two are counted from different kinds of field on purpose, and only one
// of them would survive being read off the unclamped array:
//
//  • RUNS fold `scored`, which the advancement bookkeeping writes behind
//    computeHalfInningFeed's own `visible` gate — so it is already cap-clamped
//    at the source. Each scoring runner is marked on HIS OWN at-bat card (the
//    trip he reached base on, not the play that drove him in), so summing every
//    entry's flag correctly totals a multi-run play: a grand slam scores the
//    batter's own card plus the three baserunners' earlier ones. The extra-
//    innings placed runner counts too, on his own 'placed' card — before he had
//    a card at all his run was dropped, and every extra half he scored in built
//    a linescore cell one short (verified against gamePk 777747's bottom 10: a
//    walk-off grand slam totalled 3).
//  • HITS fold `eventType`, which is stamped at PUSH time and describes plays
//    well past the cap. The slice is the only thing standing between this
//    count and the half's final H. Same HIT_EVENT_TYPES set boxscore.js's
//    computeBatterLine uses for its own revealedThrough-gated total, so a play
//    can never be a hit on one surface and not the other.
//
// `cap` null means "no stepping, the whole half is committed" — the caller
// only reports while stepping, but the null case keeps this honest standalone.
export function stepTotals(entries, cap) {
  const shown = cap == null ? entries : entries.slice(0, cap)
  let runs = 0
  let hits = 0
  for (const e of shown) {
    if ((e.kind === 'atbat' || e.kind === 'placed') && e.scored) runs += 1
    if (e.kind === 'atbat' && HIT_EVENT_TYPES.has(e.eventType)) hits += 1
  }
  return { runs, hits }
}

// The `atBatIndex` (matches `play.about.atBatIndex`, same field the
// /winProbability array's own entries carry — see api/winprob.js's
// `stepHalfIndex`/`throughAtBatIndex`) of the last COMPLETED at-bat entry
// within the first `cap` entries — null before any at-bat card is visible.
// Walks backward from the cap rather than forward from 0 since a step can end
// on a trailing 'event'/'placed' entry (a sub notice, the extra-innings
// placed runner) that carries no atBatIndex of its own; this is what lets the
// win-probability chart grow one point per at-bat step (ADR-0016) instead of
// jumping a whole half at once.
export function lastVisibleAtBatIndex(entries, cap) {
  const limit = cap == null ? entries.length : Math.min(cap, entries.length)
  for (let i = limit - 1; i >= 0; i--) {
    if (entries[i].kind === 'atbat' && entries[i].atBatIndex != null) return entries[i].atBatIndex
  }
  return null
}

// Cap-respecting live-state snapshot for the persistent scorebug HUD: base
// occupancy, outs, how many pitches the pitcher CURRENTLY of record has
// thrown, and which batter's card is the most recently visible one — folded
// over the SAME cap-clamped `entries` array PlayByPlay.jsx already builds
// (its own `visibleEntries`, i.e. `entries.slice(0, cap)` when stepping,
// `entries` whole when a half is fully committed and `cap` is passed as
// `entries.length`), never re-walking `feed.liveData.plays` a third time.
//
// Every field here only ever reflects entries strictly before `cap` — that's
// the whole reason a caller can report this at ANY reveal state (a half being
// stepped through one at-bat at a time, or fully committed at once) without
// opening a second spoiler boundary of its own: it's exactly as safe as
// PlayByPlay's own render, because it reads the same slice.
//
// Base occupancy: an `atbat`/`placed` entry's own `reached`/`scored`/
// `outNumber` fields are already the runner's FINAL position as of `cap` (see
// computeHalfInningFeed's `finalizeTrip` — every later play's effect on an
// EARLIER runner's card, an advance or an out on the bases, is folded onto
// that runner's own origin card, gated by the same `visible` check that
// produces `entries` in the first place). So a runner is currently ON a base
// exactly when his own card says he reached it, was never put out, and never
// scored — no second walk of `runners[]` needed, and no risk of double-
// counting: the feed enforces at most one runner per base, so at most one
// visible card ever claims a given base.
//
// Pitches: reset to 0 at the last visible `pitching_substitution` note (a
// mid-half change), so `pitchesSoFar` always means "by the pitcher currently
// on the mound, within this half" — a caller who wants his FULL mound tally
// adds `enteringPitches` (the half he entered with) only when there was NO
// mid-half change (`midHalfPitcherId` is null); a reliever who just entered
// starts counting from 0 in this half, a deliberate simplification (his own
// carried-over game total from an earlier stint isn't tracked here).
//
// Current batter: the batter/runner named on the LAST visible `atbat`/
// `placed` entry, plus `batterDone` — whether THAT entry's plate appearance
// actually finished (false only for an `interrupted` entry — a stoppage
// mid-count, where the same batter is still up). This is deliberately NOT
// "peek at the next play's `matchup.batter`" — the same "never name a
// substitute ahead of his own notice card" discipline HalfInning.jsx
// documents for pitchers — it only reports the LAST resolved card's own
// identity. It's the caller's job (HalfInning.jsx's composeLive, which has
// the lineup/rotation data this module doesn't) to advance past a `batter`
// whose `batterDone` is true to whoever's actually due up next.
export function deriveLiveState(entries, cap) {
  const visible = cap == null ? entries : entries.slice(0, Math.max(0, cap))
  const bases = { first: false, second: false, third: false }
  const BASE_KEY = { 1: 'first', 2: 'second', 3: 'third' }
  let outs = 0
  let pitchesSoFar = 0
  let midHalfPitcherId = null
  let batter = null
  let batterDone = false
  for (const e of visible) {
    if (e.kind === 'event' && e.eventType === 'pitching_substitution') {
      midHalfPitcherId = e.playerId ?? null
      pitchesSoFar = 0
      continue
    }
    if (e.kind !== 'atbat' && e.kind !== 'placed') continue
    if (Array.isArray(e.pitches)) pitchesSoFar += e.pitches.length
    if (e.outNumber != null && e.outNumber > outs) outs = e.outNumber
    batter =
      e.kind === 'placed'
        ? { id: e.runnerId, last: e.runner?.last ?? '', first: e.runner?.first ?? '' }
        : { id: e.batterId, last: e.batter?.last ?? '', first: e.batter?.first ?? '' }
    batterDone = !e.interrupted
    const key = BASE_KEY[e.reached]
    if (key && e.outNumber == null && !e.scored) bases[key] = true
  }
  return { bases, outs, pitchesSoFar, midHalfPitcherId, batter, batterDone }
}

// The at-bat trail's chip data (AtBatTrail.jsx), one chip per focusWindows
// window — a mapping over data already computed for rendering, not a new
// spoiler surface: every window this covers is already clamped to the reveal
// cap, i.e. already a full card on screen this render (see PlayByPlay's
// onFocusInfo effect).
//
// `notices` is the walk-back cue ADR-0017's tier 1-3 cards were missing in
// focus mode: the shorthand of every notice riding in the window (P, MV,
// SB, ...), so a chip whose window carries a pitching change SAYS so instead
// of leaving the reader to remember which batter it followed.
//
// `eventCodeFor` is PlayByPlay's own EVENT_CODES lookup, passed in rather
// than duplicated here — this stays a pure function over caller-owned data.
export function buildTrailItems(entries, wins, eventCodeFor) {
  if (!wins) return []
  return wins.map(({ start, end }) => {
    const windowEntries = entries.slice(start, end)
    const notices = windowEntries
      .filter((e) => e.kind === 'event')
      .map((e) => noticeLabel(e, eventCodeFor))
    const atbat = windowEntries.find((e) => e.kind === 'atbat')
    // The currently live, still-in-progress plate appearance (see `live` on
    // the card, halfInningFeed.js) has no code to show yet at all — its own
    // count so far reads truer than the empty-code '···' placeholder, which
    // otherwise looked identical to a genuine notice step with nothing to
    // report. `kind: 'pending'`, not `'live'` — reference.css's "live cell"
    // already names the CURSOR's own position (`[aria-current]`), a different
    // fact that can hold independently of this one.
    if (atbat?.live) {
      return { name: atbat.batter.last, code: `${atbat.live.balls}-${atbat.live.strikes}`, kind: 'pending', notices }
    }
    // A called third strike (scorebookCode.js) carries no `.code` of its own —
    // the main card draws its backward "K" as a dedicated glyph
    // (.pbp__klooking), not plain code text. The trail chip has no room for
    // that glyph, so it falls back to the same "K" a swinging strikeout's
    // code already is, rather than the empty-code '···' placeholder a real
    // strikeout should never show.
    if (atbat) {
      return { name: atbat.batter.last, code: atbat.code || (atbat.calledLooking ? 'K' : ''), kind: atbat.codeKind, notices }
    }
    // The extra-innings automatic runner, when he is ALONE in his window. He
    // normally isn't — focusWindows anchors on at-bats, so a placement rides
    // at the head of the leadoff plate appearance's window and the branch
    // above claims the chip and names the batter. The exception is the live
    // edge of an extra half, where the placement is posted before the leadoff
    // PA has resolved and is genuinely the only card there is; without this it
    // fell through to the notice branch, which reads no `eventType` off a
    // placed card and printed a chip labelled "···  •".
    //
    // Named after whoever currently occupies the base: the last pinch runner
    // in the chain when a manager swapped him out before the first pitch (a
    // real case — gamePk 823263 top 11, Bae for the placed Contreras), else
    // the placed man himself. He has a mark of his own (`AR`) either way.
    const placed = windowEntries.find((e) => e.kind === 'placed')
    if (placed) {
      const pr = placed.pinchRunners?.[placed.pinchRunners.length - 1]
      return { name: pr?.last ?? placed.runner?.last ?? '', code: placed.code || 'AR', kind: 'placed', notices }
    }
    // Notices with no at-bat of their own yet — the live edge of a half whose
    // first plate appearance hasn't resolved.
    return { name: noticeLabel(windowEntries[0], eventCodeFor), code: '', kind: 'note', notices: [] }
  })
}

// A short label for a notice step (no plate appearance of its own) —
// EVENT_CODES' real shorthand where one exists, else a short tag matching
// the notice card family the step actually renders as in PlayByPlay.jsx.
function noticeLabel(entry, eventCodeFor) {
  if (!entry) return '•'
  const code = eventCodeFor(entry.eventType)
  if (code) return code
  switch (entry.eventType) {
    case 'pitching_substitution':
      return 'P'
    case 'defensive_substitution':
    case 'defensive_switch':
      return 'D'
    case 'pinch_running':
      return 'PR'
    case 'pinch_hitting':
      return 'PH'
    case 'mound_visit':
      return 'MV'
    case 'ejection':
      return 'EJ'
    default:
      return '•'
  }
}
