// The box-score roll-up's result-aware "Held" counterparts to checkpoints.js's
// entering-tense checkpoint notes — split out of ../callout-notes.js. These
// fold tonight's already-decided result in ("moved to 18-2", "just the 2nd
// loss in 7 games…"), so they are FINAL-ONLY and exist only for
// computeGameCalloutNotes (rollup.js), where the whole game already sits
// behind the box score's one seal. See ../callout-notes.js's header for the
// two-tenses rule (ADR-0014).

import {
  cumulativeInnings,
  leaderAfterInnings,
  LEAD_CHECKPOINTS,
  TIED_CHECKPOINTS,
  scorelessLopsided,
  scorelessWhen,
  bothScorelessWhen,
  gameWeekday,
  DOW_MIN_GAMES,
  DOW_LOPSIDED,
  dowWhen,
} from './checkpoints.js'
import { ordinal, isNum, clampScore, skew, SCORE_BASE, otherSide, foldedRecordText, parseRecord } from './shared.js'

// The winner's mirror image of the reversal above: led after checkpoint N and
// closed it out, so the record moves. "The Brewers moved to 18-2 when leading
// after the 8th." Result-aware, so FINAL-ONLY (see gameResult) — the box
// score's roll-up is the only caller. Latest checkpoint wins, same rule as
// the reversal; reads the ungated `leadAfterFull` tallies so the note fires
// however the record reads (18-2 or 10-9 — post-game, the moved-to fact is
// the point, not a lopsidedness hunt).
export function buildLeadHeldNote(feed, bundle, result) {
  if (!bundle || !result?.final) return null
  const winnerSide = result.winnerSide
  const leaderAt = leaderAfterInnings(feed)
  for (const n of LEAD_CHECKPOINTS) {
    if (leaderAt[n] !== winnerSide) continue
    const rec = bundle.teamRecords?.[winnerSide]?.leadAfterFull?.[n]
    const teamName = bundle[winnerSide]?.name
    if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) continue
    return {
      text: `The ${teamName} moved to ${rec.w + 1}-${rec.l} when leading after the ${ordinal(n)}`,
      personId: null,
      side: winnerSide,
      kind: 'leadHeld',
      score: clampScore(SCORE_BASE.leadHeld + 40 * skew(rec.w, rec.l)),
    }
  }
  return null
}

// The tied-game companion to buildLeadHeldNote: a game decided from a tie after
// checkpoint N moves BOTH clubs' "when tied after the Nth" record — the winner
// up, the loser down — so unlike the one-sided lead-held note this returns a
// note per club, each folded with tonight's result (foldedRecordText handles
// the "moved to"/"dropped to"/"just the Nth loss" voice). Result-aware, so
// FINAL-ONLY; the box score's roll-up is the only caller. Latest checkpoint
// wins, same rule as buildLeadHeldNote; reads the ungated `tiedAfterFull`
// tallies so it fires however the record reads.
export function buildTiedAfterHeldNotes(feed, bundle, result) {
  if (!bundle || !result?.final) return []
  const leaderAt = leaderAfterInnings(feed)
  for (const n of TIED_CHECKPOINTS) {
    if (leaderAt[n] !== null) continue // not tied after n (or n never reached)
    const notes = []
    for (const side of ['away', 'home']) {
      const rec = bundle.teamRecords?.[side]?.tiedAfterFull?.[n]
      const teamName = bundle[side]?.name
      if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) continue
      notes.push({
        text: foldedRecordText(rec.w, rec.l, side === result.winnerSide, teamName, `when tied after the ${ordinal(n)}`),
        personId: null,
        side,
        kind: 'tiedAfter',
        dedupeKey: `tiedAfter-${side}-${n}`,
        score: clampScore(SCORE_BASE.tiedAfter + 40 * skew(rec.w, rec.l)),
      })
    }
    return notes
  }
  return []
}

// Checkpoint lists for the scoreless-through roll-up, LATEST first (a club shut
// out through the 6th was also through the 5th — only the deepest, most
// dramatic checkpoint earns the note). Mirror gen-callouts.mjs's
// SCORELESS_CHECKPOINTS / BOTH_SCORELESS_CHECKPOINTS.
const SCORELESS_CHECKPOINTS = [6, 5, 4, 3, 2, 1]
const BOTH_SCORELESS_CHECKPOINTS = [7, 6, 5, 4, 3, 2]

// The box-score sibling of buildScorelessThroughNote: a club that was shut out
// through checkpoint N tonight, its record when that happens folded with the
// result ("Just the 2nd win in 14 games when scoreless through 6…"). One note
// per club that was scoreless that deep, deepest checkpoint only, gated on the
// same one-sidedness as the live note. Result-aware, so entering-tense until
// the game is decided.
export function buildScorelessHeldNotes(feed, bundle, result) {
  if (!bundle) return []
  const rows = cumulativeInnings(feed)
  const notes = []
  for (const side of ['away', 'home']) {
    const n = SCORELESS_CHECKPOINTS.find((c) => {
      const row = rows.find((r) => r.inning === c)
      return row && (side === 'away' ? row.cumAway : row.cumHome) === 0
    })
    if (n == null) continue
    const rec = bundle.teamRecords?.[side]?.scorelessThroughFull?.[n]
    const teamName = bundle[side]?.name
    if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) continue
    if (!scorelessLopsided(rec.w, rec.l)) continue
    const when = scorelessWhen(n)
    notes.push({
      text: result?.final
        ? foldedRecordText(rec.w, rec.l, side === result.winnerSide, teamName, when)
        : `The ${teamName} are ${rec.w}-${rec.l} ${when}`,
      personId: null,
      side,
      oppSide: otherSide(side),
      kind: 'scorelessThrough',
      dedupeKey: `scorelessThrough-${side}`,
      score: clampScore(SCORE_BASE.scorelessThrough + 40 * skew(rec.w, rec.l)),
    })
  }
  return notes
}

// The box-score sibling of buildBothScorelessNote: the game was still 0-0 after
// checkpoint N tonight, both clubs' record in such games folded with the result
// (deepest 0-0 checkpoint only, both clubs — mirrors buildTiedAfterHeldNotes).
export function buildBothScorelessHeldNotes(feed, bundle, result) {
  if (!bundle) return []
  const rows = cumulativeInnings(feed)
  for (const n of BOTH_SCORELESS_CHECKPOINTS) {
    const row = rows.find((r) => r.inning === n)
    if (!row || row.cumAway !== 0 || row.cumHome !== 0) continue
    const notes = []
    for (const side of ['away', 'home']) {
      const rec = bundle.teamRecords?.[side]?.bothScorelessThroughFull?.[n]
      const teamName = bundle[side]?.name
      if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) continue
      const when = bothScorelessWhen(n)
      notes.push({
        text: result?.final
          ? foldedRecordText(rec.w, rec.l, side === result.winnerSide, teamName, when)
          : `The ${teamName} are ${rec.w}-${rec.l} ${when}`,
        personId: null,
        side,
        oppSide: otherSide(side),
        kind: 'bothScoreless',
        dedupeKey: `bothScoreless-${side}`,
        score: clampScore(SCORE_BASE.bothScoreless + 40 * skew(rec.w, rec.l)),
      })
    }
    return notes
  }
  return []
}

// The box-score sibling of buildDayOfWeekNote: tonight's weekday record for
// both clubs, folded with the result. A pure calendar fact — no reveal gate.
export function buildDayOfWeekNotes(feed, bundle, result) {
  if (!bundle) return []
  const dow = gameWeekday(feed)
  if (dow == null) return []
  const notes = []
  for (const side of ['away', 'home']) {
    const rec = bundle.teamRecords?.[side]?.dayOfWeek?.[dow]
    const teamName = bundle[side]?.name
    if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) continue
    const total = rec.w + rec.l
    if (total < DOW_MIN_GAMES) continue
    const p = total > 0 ? rec.w / total : 0
    if (!(p >= DOW_LOPSIDED || p <= 1 - DOW_LOPSIDED)) continue
    const when = dowWhen(dow)
    notes.push({
      text: result?.final
        ? foldedRecordText(rec.w, rec.l, side === result.winnerSide, teamName, when)
        : `The ${teamName} are ${rec.w}-${rec.l} ${when} this season`,
      personId: null,
      side,
      oppSide: otherSide(side),
      kind: 'dayOfWeek',
      dedupeKey: `dayOfWeek-${side}`,
      score: clampScore(SCORE_BASE.dayOfWeek + 40 * skew(rec.w, rec.l)),
    })
  }
  return notes
}

// These three thresholds/checkpoint lists must match gen-callouts.mjs's
// RUN_SCORED_BUCKETS / RUNS_ALLOWED_THRESHOLD+RUNS_ALLOWED_CHECKPOINTS /
// COMEBACK_DEFICIT — the record was precomputed against those exact numbers,
// so tonight's check has to agree with them (same duplication as
// LEAD_CHECKPOINTS above, which mirrors gen-callouts.mjs for the same reason).
const RUN_SCORED_BUCKETS = [8, 6, 4] // highest first — show the most impressive bucket cleared
const RUNS_ALLOWED_THRESHOLD = 4
const RUNS_ALLOWED_CHECKPOINTS = [8, 7, 6, 5] // latest first, same "most dramatic" rule as LEAD_CHECKPOINTS
const COMEBACK_DEFICIT = 3

// "The Dodgers moved to 33-4 when scoring 8+ runs" — the highest bucket each
// side's own final score actually clears, with tonight folded in when the
// game is decided (entering-tense otherwise — an in-progress box score view).
// No lopsidedness floor at the data layer — the record itself, however it
// reads, is the point.
export function buildRunsScoredNote(feed, bundle, result) {
  if (!bundle) return null
  const finals = {
    away: feed?.liveData?.linescore?.teams?.away?.runs,
    home: feed?.liveData?.linescore?.teams?.home?.runs,
  }
  for (const side of ['away', 'home']) {
    const final = finals[side]
    if (typeof final !== 'number') continue
    for (const n of RUN_SCORED_BUCKETS) {
      if (final < n) continue
      const rec = parseRecord(bundle.teamRecords?.[side]?.runsScored?.[n])
      const teamName = bundle[side]?.name
      if (!rec || !teamName) continue
      const text = result?.final
        ? foldedRecordText(rec.w, rec.l, side === result.winnerSide, teamName, `when scoring ${n}+ runs`)
        : `The ${teamName} are ${rec.w}-${rec.l} when scoring ${n}+ runs`
      return {
        text,
        personId: null,
        side,
        oppSide: otherSide(side),
        kind: 'runsScored',
        score: clampScore(SCORE_BASE.runsScored + 40 * skew(rec.w, rec.l)),
      }
    }
  }
  return null
}

// "The Cubs dropped to 3-20 when allowing 4+ runs by the 7th" — symmetric to
// the lead notes but for runs ALLOWED rather than a lead. Checked LATEST
// checkpoint first, same reasoning as LEAD_CHECKPOINTS: a team that blew up
// early AND late only needs the one, more dramatic, note.
export function buildRunsAllowedNote(feed, bundle, result) {
  if (!bundle) return null
  const rows = cumulativeInnings(feed)
  for (const n of RUNS_ALLOWED_CHECKPOINTS) {
    const row = rows.find((r) => r.inning === n)
    if (!row) continue
    for (const side of ['away', 'home']) {
      const allowed = side === 'away' ? row.cumHome : row.cumAway
      if (allowed < RUNS_ALLOWED_THRESHOLD) continue
      const rec = parseRecord(bundle.teamRecords?.[side]?.runsAllowedByInning?.[n])
      const teamName = bundle[side]?.name
      if (!rec || !teamName) continue
      const when = `when allowing ${RUNS_ALLOWED_THRESHOLD}+ runs by the ${ordinal(n)}`
      const text = result?.final
        ? foldedRecordText(rec.w, rec.l, side === result.winnerSide, teamName, when)
        : `The ${teamName} are ${rec.w}-${rec.l} ${when}`
      return {
        text,
        personId: null,
        side,
        oppSide: otherSide(side),
        kind: 'runsAllowed',
        score: clampScore(SCORE_BASE.runsAllowed + 40 * skew(rec.w, rec.l)),
      }
    }
  }
  return null
}

// "The Twins moved to 15-23 in games they've trailed by 3+" — fires for
// whichever side actually fell behind by COMEBACK_DEFICIT+ at some point
// tonight, folded with the result when decided. Scored by resilience (the
// win% itself) rather than lopsidedness — losing most games you trail big in
// is just baseball; winning them is the story.
export function buildComebackNote(feed, bundle, result) {
  if (!bundle) return null
  let deficitSide = null
  for (const row of cumulativeInnings(feed)) {
    if (row.cumHome - row.cumAway >= COMEBACK_DEFICIT) deficitSide = 'away'
    else if (row.cumAway - row.cumHome >= COMEBACK_DEFICIT) deficitSide = 'home'
    if (deficitSide) break
  }
  if (!deficitSide) return null
  const rec = parseRecord(bundle.teamRecords?.[deficitSide]?.comeback)
  const teamName = bundle[deficitSide]?.name
  if (!rec || !teamName) return null
  const when = `in games they've trailed by ${COMEBACK_DEFICIT}+`
  const text = result?.final
    ? foldedRecordText(rec.w, rec.l, deficitSide === result.winnerSide, teamName, when)
    : `The ${teamName} are ${rec.w}-${rec.l} ${when}`
  return {
    text,
    personId: null,
    side: deficitSide,
    oppSide: otherSide(deficitSide),
    kind: 'comeback',
    score: clampScore(SCORE_BASE.comeback + 60 * (rec.pct ?? 0)),
  }
}

// --- close-game records (one-run / extra-inning) ---------------------------------
// "Just the 4th loss in 19 one-run games for the Brewers (now 15-4)" — the
// standings splitRecords (one-run and extra-inning W-L) folded with tonight's
// result, fired only when tonight actually WAS that kind of game. Roll-up
// only and Final-only, like the other result-aware families: whether the game
// ended one-run or went to extras is itself the outcome. MLB-only data (the
// precompute reads MLB standings), so MiLB bundles simply never fire these.
export function buildCloseGameNotes(feed, bundle, result) {
  if (!bundle || !result?.final) return []
  const a = feed?.liveData?.linescore?.teams?.away?.runs
  const h = feed?.liveData?.linescore?.teams?.home?.runs
  if (typeof a !== 'number' || typeof h !== 'number') return []
  const oneRun = Math.abs(a - h) === 1
  const scheduled = feed?.liveData?.linescore?.scheduledInnings ?? 9
  const extras = (feed?.liveData?.linescore?.innings?.length ?? 0) > scheduled
  const notes = []
  for (const side of ['away', 'home']) {
    const teamName = bundle[side]?.name
    if (!teamName) continue
    const won = side === result.winnerSide
    if (oneRun) {
      const rec = parseRecord(bundle.teamRecords?.[side]?.oneRun)
      if (rec) {
        notes.push({
          text: foldedRecordText(rec.w, rec.l, won, teamName, 'in one-run games'),
          personId: null,
          side,
          oppSide: otherSide(side),
          kind: 'oneRun',
          dedupeKey: `oneRun-${side}`,
          score: clampScore(SCORE_BASE.oneRun + 40 * skew(rec.w, rec.l)),
        })
      }
    }
    if (extras) {
      const rec = parseRecord(bundle.teamRecords?.[side]?.extraInning)
      if (rec) {
        notes.push({
          text: foldedRecordText(rec.w, rec.l, won, teamName, 'in extra innings'),
          personId: null,
          side,
          oppSide: otherSide(side),
          kind: 'extraInnings',
          dedupeKey: `extraInnings-${side}`,
          score: clampScore(SCORE_BASE.extraInnings + 40 * skew(rec.w, rec.l)),
        })
      }
    }
  }
  return notes
}
