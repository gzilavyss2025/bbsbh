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

import { halfIndex } from './select.js'
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
} from './callout-notes.js'

export const CARD_MAX = 5

export const BETWEEN_INNINGS_ALLOWED_KINDS = new Set([
  'starterRec', 'dayOfWeek', 'bullpenThin', 'inningRunDiff',
  'foulVolume', 'pitchPace', 'tto', 'ttoPitches',
  'laboring', 'veloVariety', 'veloDecay', 'penFatigue', 'workload', 'backToBack',
  'leverage', 'centuryClub', 'tenK', 'scorelessStreak', 'sixIp', 'homeAway',
  'cgShutout', 'recentAppearances',
])

// Top of inning N -> bottom of N; bottom of N -> top of N+1 (api/dueup.js
// inlines the same arithmetic).
function nextHalfOf(inning, half) {
  return half === 'top' ? { inning, half: 'bottom' } : { inning: inning + 1, half: 'top' }
}

export function buildBetweenInnings({
  feed, bundle, marginNotes = [], inning, half, revealedThrough, workload, gameDate,
}) {
  if (!bundle) return []
  const { inning: nInning, half: nHalf } = nextHalfOf(inning, half)
  // Excluded below so the ConsoleBand one-liner (marginNotes[0]) never repeats as card 1.
  const topNoteKey = marginNotes[0]?.dedupeKey ?? marginNotes[0]?.text ?? null
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

  // The hard allowlist — a structural filter, not implicit trust in the callers above.
  const allowed = pool.filter(
    (n) => n && BETWEEN_INNINGS_ALLOWED_KINDS.has(n.kind) && (n.dedupeKey ?? n.text) !== topNoteKey,
  )

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
  return ordered.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, CARD_MAX)
}
