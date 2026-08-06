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
