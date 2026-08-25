// Pre-half strip builders for inning-run differential, the starter's team
// record, foul volume, pitch pace, and bullpen health — split out of
// ../callout-notes.js. Entering-tense (prehalf-callouts.js is the caller);
// see ../callout-notes.js's header for the two-tenses rule (ADR-0014).

import { pitchCallCode, FOUL_CODES } from '../playbyplay.js'
import { personNameParts, dayWordFor, halfIndex } from '../select.js'
import { availabilityFor } from '../workload.js'
import { otherSide, ordinal, isNum, clampScore, skewBonus, magnitudeOf, SCORE_BASE } from './shared.js'

// --- run differential by inning --------------------------------------------------
// "The Brewers have outscored opponents 38-14 in the 7th this season" — from
// the precompute's per-inning runs-for/against tallies (`inningRuns`). Shared
// by the pre-half strip (entering the inning; prehalf-callouts.js) and the
// box-score roll-up (tonight's half-inning runs folded in via extraF/extraA).
// Noteworthy only past a real sample, a real margin, AND a dominance ratio —
// an 88-80 grind or a 9-2 April blip is neither.
export const INNING_DIFF_MIN_GAMES = 15
const INNING_DIFF_MIN_MARGIN = 12
const INNING_DIFF_RATIO = 2
export function buildInningRunDiffNote(bundle, side, inning, extraF = 0, extraA = 0, word = 'tonight') {
  const ir = bundle?.teamRecords?.[side]?.inningRuns?.[inning]
  const teamName = bundle?.[side]?.name
  if (!ir || !teamName || !isNum(ir.f) || !isNum(ir.a) || !(ir.g >= INNING_DIFF_MIN_GAMES)) return null
  const f = ir.f + extraF
  const a = ir.a + extraA
  const margin = Math.abs(f - a)
  if (margin < INNING_DIFF_MIN_MARGIN) return null
  if (Math.max(f, a) < INNING_DIFF_RATIO * Math.max(1, Math.min(f, a))) return null
  const folded = extraF > 0 || extraA > 0 ? `, ${word} included` : ''
  const text =
    f > a
      ? `The ${teamName} have outscored opponents ${f}-${a} in the ${ordinal(inning)} this season${folded}`
      : `The ${teamName} have been outscored ${a}-${f} in the ${ordinal(inning)} this season${folded}`
  return {
    text,
    personId: null,
    side,
    kind: 'inningRunDiff',
    dedupeKey: `inningRunDiff-${side}-${inning}`,
    score: clampScore(SCORE_BASE.inningRunDiff + magnitudeOf(margin / 2, 20)),
    margin,
  }
}

// --- starter team record -----------------------------------------------------------
// "The Brewers are 12-5 in his starts this season" — the CLUB's result in a
// pitcher's starts (see gen-callouts.mjs's teamStarts), independent of his
// personal W-L. Entering-tense: the pre-half strip's first-inning card
// (prehalf-callouts.js). The roll-up builds its own folded version below.
export function buildStarterTeamRecordNote(bundle, side, pitcherId) {
  const rec = bundle?.starterRecords?.[pitcherId]?.teamStarts
  const teamName = bundle?.[side]?.name
  if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) return null
  return {
    text: `The ${teamName} are ${rec.w}-${rec.l} in his starts this season`,
    personId: pitcherId,
    side,
    kind: 'starterRec',
    dedupeKey: `starterRec-${pitcherId}`,
    score: clampScore(SCORE_BASE.starterRec + skewBonus(rec.w, rec.l)),
  }
}

// --- pre-half: the batting side is making the starter fight -----------------
// Entering a half: how many of the opposing STARTER's pitches this side has
// fouled off so far tonight, when that count is genuinely above the league
// norm (bundle.foulRate, from the nightly foul sweep — absent on MiLB
// bundles, which silently disables the family). Reads only halves strictly
// BEFORE the one being staged — revealed material under the caller's gate
// (prehalf-callouts.js), same footing as the times-through-the-order card.
const FOUL_VOLUME_MIN_PITCHES = 50
const FOUL_VOLUME_MIN_FOULS = 12
const FOUL_VOLUME_RATIO = 1.35

export function buildFoulVolumeNote(feed, bundle, inning, half) {
  const rate = bundle?.foulRate?.perPitch
  if (!rate) return null
  const battingHalf = half === 'top' ? 'top' : 'bottom'
  const battingSide = half === 'top' ? 'away' : 'home'
  const cutoff = halfIndex(inning, half)

  const pitcherIds = new Set()
  let pitches = 0
  let fouls = 0
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const inn = play?.about?.inning
    const h = play?.about?.halfInning
    if (!inn || h !== battingHalf) continue
    if (halfIndex(inn, h) >= cutoff) continue // strictly before this half
    const pid = play.matchup?.pitcher?.id
    if (pid != null) pitcherIds.add(pid)
    for (const e of play.playEvents ?? []) {
      if (!e.isPitch) continue
      pitches += 1
      const code = pitchCallCode(e)
      if (code && FOUL_CODES.has(code)) fouls += 1
    }
  }
  // One pitcher seen = the starter is still in; more = the story has moved on.
  if (pitcherIds.size !== 1) return null
  const expected = Math.round(rate * pitches)
  if (pitches < FOUL_VOLUME_MIN_PITCHES) return null
  if (fouls < FOUL_VOLUME_MIN_FOULS || fouls < FOUL_VOLUME_RATIO * rate * pitches) return null

  const pitcherId = [...pitcherIds][0]
  const { last } = personNameParts(feed?.gameData?.players?.[`ID${pitcherId}`] ?? {})
  const team = bundle[battingSide]?.name
  if (!last || !team) return null
  return {
    text: `The ${team} have fouled off ${fouls} of ${last}'s ${pitches} pitches — league average is about ${expected}`,
    personId: pitcherId,
    side: battingSide,
    kind: 'foulVolume',
    dedupeKey: `foulvolume-${battingSide}-${inning}`,
    score: clampScore(SCORE_BASE.foulVolume + magnitudeOf(fouls - expected, 15)),
  }
}

// --- pre-half: how hard the starter is having to work ------------------------
// "Through 3 tonight, Peralta is at 62 pitches — he averages 48 through three
// this season" — entering the half right after the starter completes his Nth
// inning, his pitch count tonight through N vs his season pace (the bundle's
// playLog-derived starterRecords[pid].pitchPace; see gen-callouts.mjs). Reads
// tonight's pitches from the pitcher's STRICTLY-PREVIOUS halves — revealed
// material — so it shares the times-through card's caller-gate
// (prehalf-callouts.js restricts it to halfIndex(inning, half) <=
// revealedThrough + 1). Fires only while that side's starter is the lone
// pitcher it has seen (a reliever's "through N" pace is meaningless), and only
// when tonight's count is a notable distance from the norm.
const PACE_MIN_DIFF = 12
export function buildStarterPitchPaceNote(feed, bundle, inning, half) {
  const battingSide = half === 'top' ? 'away' : 'home'
  const pitchingSide = otherSide(battingSide)

  // The pitcher who has worked this side's previous halves, and his pitch count
  // over them. Same-half type, strictly before the staged inning.
  const pitcherIds = new Set()
  let pitches = 0
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const inn = play?.about?.inning
    const h = play?.about?.halfInning
    if (!inn || h !== half || !(inn < inning)) continue
    const pid = play.matchup?.pitcher?.id
    if (pid != null) pitcherIds.add(pid)
    for (const e of play.playEvents ?? []) if (e.isPitch) pitches += 1
  }
  if (pitcherIds.size !== 1) return null // starter's gone — the pace note doesn't apply
  const pitcherId = [...pitcherIds][0]

  const pace = bundle?.starterRecords?.[pitcherId]?.pitchPace
  // The pace is "through N innings"; only fire entering the half right after
  // his Nth (a starter in since the 1st has completed inning - 1 innings).
  if (!pace || !isNum(pace.avg) || pace.n == null || inning !== pace.n + 1) return null
  const diff = pitches - pace.avg
  if (Math.abs(diff) < PACE_MIN_DIFF) return null

  const { last } = personNameParts(feed?.gameData?.players?.[`ID${pitcherId}`] ?? {})
  const who = last || 'the starter'
  const word = dayWordFor(bundle.dayNight)
  return {
    text: `Through ${pace.n} ${word}, ${who} is at ${pitches} pitches — he averages ${pace.avg} through ${pace.n} this season`,
    personId: pitcherId,
    side: pitchingSide,
    kind: 'pitchPace',
    dedupeKey: `pitchPace-${pitchingSide}-${inning}`,
    score: clampScore(SCORE_BASE.pitchPace + magnitudeOf(Math.abs(diff) / 2, 15)),
  }
}

// --- pre-half: the defending club's bullpen is running on fumes --------------
// First inning only, on the half where that club takes the field: how many of
// its relievers enter tonight likely unavailable under the workload rules
// (api/workload.js's availabilityFor — 3 straight days, 25+ yesterday, 35+
// over three days). Backward-looking completed appearances only, so it's
// spoiler-free; gated to a slate-current game (the workload file describes
// "now") the same way TeamInfo's bullpen board is.
// "A and B" / "A, B and C" — a read-aloud list, since these are names a
// reader scans rather than a machine-joined array.
const andList = (xs) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

const BULLPEN_THIN_MIN_DOWN = 2
const WORKLOAD_FRESH_DAYS = 3

export function buildBullpenThinNote(bundle, side, workload, gameDate) {
  const teamId = bundle?.[side]?.teamId
  const team = bundle?.[side]?.name
  const asOf = workload?.asOf
  if (teamId == null || !team || !workload?.pitchers || !gameDate || !asOf) return null
  const drift = Math.abs(new Date(`${gameDate}T00:00:00Z`) - new Date(`${asOf}T00:00:00Z`))
  if (!(drift <= WORKLOAD_FRESH_DAYS * 86400000)) return null

  const down = []
  for (const [pid, entry] of Object.entries(workload.pitchers)) {
    if (entry.teamId !== teamId || entry.role !== 'RP') continue
    const avail = availabilityFor(workload, pid, gameDate)
    if (avail?.status === 'down') down.push(entry.name)
  }
  if (down.length < BULLPEN_THIN_MIN_DOWN) return null
  return {
    // No "Bullpen watch:" label, and the names lead. The count was doing
    // nothing the list did not already do, and naming the verdict before the
    // evidence is the habit this voice does not have. "likely" stays — it is
    // honest uncertainty about an inference, not a hedge standing in for a
    // number we hold.
    text: `${andList(down)} are likely down for the ${team} after heavy recent work`,
    personId: null,
    side,
    kind: 'bullpenThin',
    dedupeKey: `bullpenthin-${side}`,
    score: clampScore(SCORE_BASE.bullpenThin + magnitudeOf(down.length - BULLPEN_THIN_MIN_DOWN, 2)),
  }
}
