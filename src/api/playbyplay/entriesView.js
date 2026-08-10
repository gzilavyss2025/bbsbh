// Readers over computeHalfInningFeed's `entries[]` output — at-bat-mode
// stepping boundaries and the cap-respecting live-state snapshot for the
// scorebug HUD. None of these re-walk the raw feed; they all fold over the
// same entries array (or a cap-clamped slice of it) the caller already has.
// See ../playbyplay.js's header for the module's overall spoiler footing.
// Split (ADR-0038, check-file-size.mjs) out of src/api/playbyplay.js.

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

// Every step boundary in a half, as end-indices: walking nextStepBoundary from
// 0 until it stops moving. `bounds[k]` is the exclusive end of step k, so step
// k covers entries[bounds[k - 1] ?? 0 .. bounds[k]) — the same bundling one
// "Next at-bat" tap produces (a plate appearance plus the announcements
// trailing it), just enumerated up front instead of one tap at a time.
//
// Focus mode (InningViewer) uses this to show ONE step at a time and to let
// the reader page back and forward through the steps already revealed. It
// reads only entries the caller already holds, so it inherits their cap and
// can never describe a step past it — the caller still clamps by its own
// effectiveCap before showing a window (see PlayByPlay.jsx).
export function stepBounds(entries) {
  const bounds = []
  let cap = 0
  while (cap < entries.length) {
    const next = nextStepBoundary(entries, cap)
    // nextStepBoundary returns entries.length when no at-bat card remains, so
    // this both terminates and folds any trailing notes into the last step.
    if (next <= cap) break
    bounds.push(next)
    cap = next
  }
  return bounds
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

// The at-bat trail's chip data (AtBatTrail.jsx), built from stepBounds' own
// boundaries and PlayByPlay's revealedSteps count — a mapping over data
// already computed for rendering, not a new spoiler surface: every step this
// covers is already <= effectiveCap, i.e. already a full card on screen this
// render (see PlayByPlay's onFocusInfo effect).
//
// `eventCodeFor` is PlayByPlay's own EVENT_CODES lookup, passed in rather
// than duplicated here — this stays a pure function over caller-owned data.
export function buildTrailItems(entries, bounds, revealedSteps, eventCodeFor) {
  if (!bounds) return []
  return bounds.slice(0, revealedSteps).map((end, i) => {
    const windowEntries = entries.slice(i === 0 ? 0 : bounds[i - 1], end)
    const atbat = windowEntries.find((e) => e.kind !== 'event' && e.kind !== 'placed')
    if (atbat) return { name: atbat.batter.last, code: atbat.code || '', kind: atbat.codeKind }
    return { name: noticeLabel(windowEntries[0], eventCodeFor), code: '', kind: 'note' }
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
