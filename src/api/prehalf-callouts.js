// The pre-half callout strip — the season-context cards shown ABOVE a
// half-inning's seal, staging the half the way the pre-pitch change list and
// entering-lineup cards do (ADR-0003/0010): what a broadcast would tell you as
// the half begins, before any of its results. Four families (ADR-0014):
//
//   1. Starter team record (1st inning only) — the club's W-L in tonight's
//      starter's starts, on the half where HE takes the mound (top = the home
//      club's starter, bottom = the away club's). Season aggregate joined to
//      the PROBABLE starter (gameData.probablePitchers — staged pre-game),
//      both spoiler-free.
//   2. Record after the previous inning (top halves, 2nd inning on) — "The
//      Brewers are 17-2 this season when leading after the 8th" for whichever
//      club leads tonight, or "…12-9 when tied after the 7th" for BOTH clubs
//      when the game is level (checkpoints 6–8 only for the tied variant). WHO
//      leads / that it's tied is read off tonight's linescore, which is
//      score-revealing — so this note is CALLER-GATED the same way the
//      entering-lineup selectors are: it only computes once every inning
//      through N-1 sits at or under the reveal mark (`revealedThrough`),
//      i.e. the reader has already seen the score it restates. The gate lives
//      HERE, not in the component, so no future caller can skip it.
//   3. Inning run differential (top halves) — "The Brewers have outscored
//      opponents 38-14 in the 7th this season", for either club whose season
//      story in this inning is noteworthy (see buildInningRunDiffNote's
//      floors). Pure season aggregate, spoiler-free, shown entering the
//      inning's top half only so it doesn't repeat on the bottom.
//   4. Times through the order — "Batters see Imanaga a 3rd time this inning —
//      they're hitting .444 off him the 3rd time through this season", the
//      persistent per-half card that replaced the old per-play note. Counting
//      who has faced the pitcher how often reads PLAYS from this side's
//      previous halves — revealed material under the same caller-gate — so
//      like the leading-after note it is additionally gated here on
//      `revealedThrough` covering everything before this half.
//
// Ranked by the shared worthiness score and capped at PREHALF_MAX so the strip
// stages the half rather than burying it. Returns [] with no bundle
// (an un-generated date), like every other callout surface.

import { halfIndex } from './select.js'
import {
  cumulativeInnings,
  buildStarterTeamRecordNote,
  buildLeadingAfterNote,
  buildTiedAfterNote,
  buildInningRunDiffNote,
  buildThirdTimeThroughNote,
  buildFoulVolumeNote,
  buildBullpenThinNote,
} from './callout-notes.js'

const PREHALF_MAX = 2

export function buildPreHalfCallouts({ feed, bundle, inning, half, revealedThrough, workload, gameDate }) {
  if (!bundle) return []
  const notes = []

  // 1. The record in tonight's starter's starts — first inning only, pinned to
  // the half where that starter is the one pitching. The same half also
  // carries that club's bullpen-thin note when its pen enters the night
  // short-handed (api/callout-notes.js's buildBullpenThinNote — spoiler-free
  // completed-appearance data, self-gated to a slate-current game).
  if (inning === 1) {
    const side = half === 'top' ? 'home' : 'away'
    const pid = feed?.gameData?.probablePitchers?.[side]?.id
    const note = pid != null ? buildStarterTeamRecordNote(bundle, side, pid) : null
    if (note) notes.push(note)
    const pen = buildBullpenThinNote(bundle, side, workload, gameDate)
    if (pen) notes.push(pen)
  }

  // 2. Tonight's record entering this inning at that checkpoint — the leader's
  // "when leading after the Nth" if one club is ahead, or BOTH clubs' "when
  // tied after the Nth" if they're level (a tie has no single leader to phrase,
  // so each club gets its own note). Only for a top half (the checkpoint is
  // "after a full inning"), and only once the whole previous inning is revealed
  // — the defense-in-depth gate this module exists to own, since knowing who
  // leads / that it's tied restates tonight's already-seen score.
  if (half === 'top' && inning >= 2 && halfIndex(inning - 1, 'bottom') <= revealedThrough) {
    const row = cumulativeInnings(feed).find((r) => r.inning === inning - 1)
    if (row && row.cumAway !== row.cumHome) {
      const side = row.cumAway > row.cumHome ? 'away' : 'home'
      const note = buildLeadingAfterNote(bundle, side, inning - 1)
      if (note) notes.push(note)
    } else if (row) {
      for (const side of ['away', 'home']) {
        const note = buildTiedAfterNote(bundle, side, inning - 1)
        if (note) notes.push(note)
      }
    }
  }

  // 3. Either club's season run-differential story for the inning being entered.
  if (half === 'top') {
    for (const side of ['away', 'home']) {
      const note = buildInningRunDiffNote(bundle, side, inning)
      if (note) notes.push(note)
    }
  }

  // 3b. The batting side is making the opposing starter fight — their foul
  // count off him tonight vs the league norm. Reads strictly-previous halves'
  // plays (revealed material), so it shares the times-through gate below.
  if (inning >= 3 && halfIndex(inning, half) <= revealedThrough + 1) {
    const note = buildFoulVolumeNote(feed, bundle, inning, half)
    if (note) notes.push(note)
  }

  // 4. The order turning over a 3rd (or later) time on the pitcher — reads
  // this side's previous halves' plays, so it only computes once everything
  // before this half sits at or under the reveal mark (the strip's outer
  // reached-half gate implies it, this defense-in-depth gate guarantees it).
  if (halfIndex(inning, half) <= revealedThrough + 1) {
    const note = buildThirdTimeThroughNote(feed, bundle, inning, half)
    if (note) notes.push(note)
  }

  return notes.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, PREHALF_MAX)
}
