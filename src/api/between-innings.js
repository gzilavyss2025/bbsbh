// Between Innings — focus mode's post-half hold. Up to CARD_MAX score-free
// facts, ranked by the shared worthiness score, filtered through a hard kind
// allowlist. `inning`/`half` is the half that just closed; the four
// reveal-gated families below are computed for the NEXT half, same footing
// prehalf-callouts.js uses (postHalf implies viewIdx <= revealedThrough, so
// halfIndex(next) <= revealedThrough + 1 holds with equality).
//
// leadAfterLive/tiedAfterLive/bothScoreless/scorelessThrough are excluded on
// purpose — they restate tonight's already-revealed score, and this surface
// holds a stricter bar than ADR-0014's general pre-half clearance.
//
// marginNotes flows in whole, index 0 included — this is the same pool
// MarginNotes.jsx digests in full under the Arms tab, where every note past
// index 0 already appears twice (Arms tab + this card set). Index 0 used to
// be dropped here so it would not repeat inside the console band, which also
// promoted it as a standalone one-liner under HalfTally's grid; now that the
// grid IS the card's resting state and the one-liner is gone
// (BetweenInnings.jsx), index 0 is no longer a special case.
//
// WHAT KEEPS THAT POOL FROM SAYING THE SAME THING ALL NIGHT is `rankNotes`
// (callout-notes/shared.js): a note decays by SHOWN_DECAY for each EARLIER half
// it was already shown on, a fact that cannot change during a game (the
// weekday, the starter's team record, a bullpen already short) drops outright
// after one showing, and no two cards in one set share a kind. The unconditional
// starterRec/dayOfWeek/bullpenThin pushes below used to put three once-a-game
// facts in this card after every half of the game; they still compute here, and
// the ledger is what stops them printing seventeen times. `shownCounts` is that
// ledger's read (src/hooks/useCalloutLedger.js) and is optional — without it
// this card ranks exactly as it always did.

import { halfIndex } from './select.js'
import { matchupNotesForHalf } from './matchup/forHalf.js'
import {
  buildStarterTeamRecordNote,
  buildBullpenThinNote,
  buildInningRunDiffNote,
  buildFoulVolumeNote,
  buildStarterPitchPaceNote,
  buildThirdTimeThroughNote,
  buildTtoPitchesNote,
  buildDayOfWeekNote,
  weekdayFromDate,
  gameWeekday,
  rankNotes,
} from './callout-notes.js'

export const CARD_MAX = 5

export const BETWEEN_INNINGS_ALLOWED_KINDS = new Set([
  'starterRec', 'dayOfWeek', 'bullpenThin', 'inningRunDiff',
  'foulVolume', 'pitchPace', 'tto', 'ttoPitches',
  'laboring', 'veloVariety', 'veloDecay', 'penFatigue', 'workload', 'backToBack',
  'leverage', 'centuryClub', 'tenK', 'scorelessStreak', 'sixIp', 'homeAway',
  'cgShutout', 'recentAppearances',
  // The matchup families (api/matchup/notes.js, api/matchup/arsenal.js) —
  // season Statcast rates for a due-up hitter against the arm he will face.
  // They read no liveData at all, so they clear this surface's stricter bar
  // without a gate of their own; what IS gated is resolving WHO those two
  // players are, which rides on the same caller-gated selectors the lineup and
  // defense cards already use.
  'matchupSkill', 'matchupStyle', 'matchupArsenal',
])

// Top of inning N -> bottom of N; bottom of N -> top of N+1 (api/dueup.js
// inlines the same arithmetic).
function nextHalfOf(inning, half) {
  return half === 'top' ? { inning, half: 'bottom' } : { inning: inning + 1, half: 'top' }
}

export function buildBetweenInnings({
  feed, bundle, marginNotes = [], inning, half, revealedThrough, workload, gameDate,
  shownCounts = null, savantMatchup = null,
}) {
  if (!bundle) return []
  const { inning: nInning, half: nHalf } = nextHalfOf(inning, half)
  const pool = [...marginNotes]

  const away = feed?.gameData?.probablePitchers?.away?.id
  const home = feed?.gameData?.probablePitchers?.home?.id
  if (away != null) pool.push(buildStarterTeamRecordNote(bundle, 'away', away))
  if (home != null) pool.push(buildStarterTeamRecordNote(bundle, 'home', home))

  const dow = weekdayFromDate(gameDate) ?? gameWeekday(feed)
  for (const side of ['away', 'home']) pool.push(buildDayOfWeekNote(bundle, side, dow))
  for (const side of ['away', 'home']) pool.push(buildBullpenThinNote(bundle, side, workload, gameDate))
  for (const side of ['away', 'home']) pool.push(buildInningRunDiffNote(bundle, side, nInning))

  if (halfIndex(nInning, nHalf) <= revealedThrough + 1) {
    pool.push(buildFoulVolumeNote(feed, bundle, nInning, nHalf))
    pool.push(buildStarterPitchPaceNote(feed, bundle, nInning, nHalf))
    pool.push(buildThirdTimeThroughNote(feed, bundle, nInning, nHalf))
    pool.push(buildTtoPitchesNote(feed, bundle, nInning, nHalf))
  }

  // The hitters due up next half against the arm waiting for them. Pushed
  // unconditionally: these notes read no liveData, and the reveal gate that
  // matters — WHO those two players are — is enforced inside the selectors
  // matchupNotesForHalf goes through, not here (ADR-0003/0010).
  pool.push(...matchupNotesForHalf({
    feed, data: savantMatchup, inning: nInning, half: nHalf, revealedThrough,
  }))

  // The hard allowlist — a structural filter, not implicit trust in the callers above.
  const allowed = pool.filter((n) => n && BETWEEN_INNINGS_ALLOWED_KINDS.has(n.kind))

  const byKey = new Map()
  const ordered = []
  for (const note of allowed) {
    const key = note.dedupeKey ?? note.text
    const at = byKey.get(key)
    if (at != null) {
      ordered[at] = note
      continue
    }
    byKey.set(key, ordered.length)
    ordered.push(note)
  }

  // min(CARD_MAX, pool.length) — a sub-5 pool tracks data completeness
  // (pre-game data, MiLB gaps), never how eventful the half was.
  return rankNotes(ordered, { shownCounts, maxPerKind: 1, limit: CARD_MAX })
}
