// Entering-tense, checkpoint-based season-record notes (lead/tied/scoreless
// after inning N, day-of-week) — split out of ../callout-notes.js. These are
// the pre-half strip's (prehalf-callouts.js) caller-gated builders: reading
// WHO leads or that the game is tied is score-revealing, so the caller only
// invokes these once every inning through N-1 is at or under the reveal mark.
// See ../callout-notes.js's header for the two-tenses rule (ADR-0014); the
// box-score roll-up's result-aware "Held" counterparts live in heldNotes.js.

import { dayWord } from '../select.js'
import { ordinal, isNum, clampScore, skew, SCORE_BASE, parseRecord } from './shared.js'

// Cumulative runs each side has scored through each inning, stopping at the
// first inning whose bottom half never completed (a walk-off, or a
// truncated/suspended game) — "through inning N" isn't well-defined past
// that point. A trailing home team's skipped bottom half is genuinely absent
// from the linescore (caught by the missing-value check below), but a
// walk-off's bottom half is NOT — statsapi reports the runs actually scored
// in that partial frame, so it must be detected from the play data instead:
// the game's last play, in the bottom half, with fewer than 3 outs recorded.
// Shared by every whole-game, checkpoint-based note below, and by the
// pre-half strip's "leading after the 8th" note (prehalf-callouts.js), whose
// caller-gating contract is what keeps THAT read spoiler-safe.
export function cumulativeInnings(feed) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const lastPlay = plays[plays.length - 1]
  const walkoffInning =
    lastPlay?.about?.halfInning === 'bottom' && lastPlay.count?.outs < 3 ? lastPlay.about.inning : null

  let cumAway = 0
  let cumHome = 0
  const rows = [] // { inning, cumAway, cumHome }
  for (const inn of feed?.liveData?.linescore?.innings ?? []) {
    const aR = inn.away?.runs
    const hR = inn.home?.runs
    if (typeof aR !== 'number' || typeof hR !== 'number' || inn.num === walkoffInning) break
    cumAway += aR
    cumHome += hR
    rows.push({ inning: inn.num, cumAway, cumHome })
  }
  return rows
}

// ---------------------------------------------------------------------------
// The checkpoint innings and thresholds every season-record note is built on.
// ONE definition, imported by both halves: the note builders here and in
// heldNotes.js, and scripts/gen-callouts.mjs, which tallies the records
// against these exact numbers. Two copies that drift would leave a note
// phrased against a checkpoint the precompute never counted — a record that
// silently reads for the wrong inning.
// ---------------------------------------------------------------------------

// Checkpoints to look for a blown/held lead at, LATEST first — a team that led
// after both the 7th and the 8th only gets the more dramatic (later) note, not
// both.
//
// NO 9TH, and this is a rule of baseball, not a display choice: a club that
// leads after nine completed innings has won the game. The record can only
// ever read N-0, no reversal of it can exist, and "moved to 22-0 when leading
// after the 9th" states that a team that was ahead at the end won — which was
// the note every road win got, since a home winner's ninth is never completed.
// The 8th is the last inning at which leading is still a question.
export const LEAD_CHECKPOINTS = [8, 7, 6]
// The tied-game checkpoints, latest first for the same "most dramatic wins"
// rule — a game tied after both the 7th and the 8th gets only the 8th's note.
// No 9th here either: a tie after the 9th is extra innings, which never
// surfaces up front (ADR-0008).
export const TIED_CHECKPOINTS = [8, 7, 6]
// Final-score buckets for the "when scoring N+ runs" record, highest first —
// show the most impressive bucket the club actually cleared.
export const RUN_SCORED_BUCKETS = [8, 6, 4]
// "Allowed N+ runs by the end of inning M": one run threshold across every
// checkpoint inning (an early blowup and a late one are both "4+ allowed",
// just at a different point), checked latest first like the lead notes.
export const RUNS_ALLOWED_THRESHOLD = 4
export const RUNS_ALLOWED_CHECKPOINTS = [8, 7, 6, 5]
// How far behind a club must have fallen for the game to count toward its
// comeback record.
export const COMEBACK_DEFICIT = 3

// Which side led after each completed inning — 'away' | 'home' | null (tied),
// keyed by inning number. Shared by the reversal + lead-held notes below.
export function leaderAfterInnings(feed) {
  const leaderAt = {}
  for (const row of cumulativeInnings(feed)) {
    leaderAt[row.inning] = row.cumAway > row.cumHome ? 'away' : row.cumHome > row.cumAway ? 'home' : null
  }
  return leaderAt
}

// "The Orioles were 43-0 when leading after the 8th — until tonight" — a
// club's season-long record when leading after a given inning is normally
// lopsided toward winning (see gen-callouts.mjs's leadAfterRecord), so THIS
// game reversing one of those checkpoints — led after inning N, lost anyway —
// is worth flagging on its own, distinct from every per-play note above.
// Retroactive by nature: it can only be known once the whole game (in
// particular its final score) is in hand, so — like the rest of this box
// score's Insights card — it's safe to compute inside the reveal because the
// SealBox has already exposed the final score by then. Reads the lopsided-only
// `leadAfter` strings (the precompute's floor IS this note's gate).
export function buildLeadReversalNote(feed, bundle) {
  if (!bundle) return null
  const finalAway = feed?.liveData?.linescore?.teams?.away?.runs
  const finalHome = feed?.liveData?.linescore?.teams?.home?.runs
  if (typeof finalAway !== 'number' || typeof finalHome !== 'number' || finalAway === finalHome) {
    return null
  }
  const winnerSide = finalAway > finalHome ? 'away' : 'home'
  const leaderAt = leaderAfterInnings(feed)

  for (const n of LEAD_CHECKPOINTS) {
    const leadingSide = leaderAt[n]
    if (!leadingSide || leadingSide === winnerSide) continue // led and won — not a reversal
    const recStr = bundle.teamRecords?.[leadingSide]?.leadAfter?.[n]
    const rec = parseRecord(recStr)
    const teamName = bundle[leadingSide]?.name
    if (!rec || !teamName) continue
    return {
      text: `The ${teamName} were ${rec.w}-${rec.l} when leading after the ${ordinal(n)} — until ${dayWord(feed)}`,
      personId: null,
      side: leadingSide,
      oppSide: winnerSide,
      kind: 'leadReversal',
      score: clampScore(SCORE_BASE.leadReversal + 20 * skew(rec.w, rec.l)),
    }
  }
  return null
}

// "The Brewers are 17-2 this season when leading after the 8th" — the
// entering-tense companion to buildLeadHeldNote below, built for the pre-half
// strip once the reader has revealed through inning N and is looking at the
// top of N+1. WHO leads tonight is the caller's job (prehalf-callouts.js,
// which owns the revealedThrough gate that makes reading tonight's score
// safe); this builder just phrases the season record for the side it's told.
export function buildLeadingAfterNote(bundle, side, inning) {
  const rec = bundle?.teamRecords?.[side]?.leadAfterFull?.[inning]
  const teamName = bundle?.[side]?.name
  if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) return null
  return {
    text: `The ${teamName} are ${rec.w}-${rec.l} this season when leading after the ${ordinal(inning)}`,
    personId: null,
    side,
    kind: 'leadAfterLive',
    dedupeKey: `leadAfterLive-${side}-${inning}`,
    score: clampScore(SCORE_BASE.leadHeld + 40 * skew(rec.w, rec.l)),
  }
}

// "The Brewers are 12-9 this season when tied after the 7th" — the tied-game
// sibling of buildLeadingAfterNote, for the pre-half strip once the reader has
// revealed through inning N and both clubs sat level. Unlike the leading-after
// note there's no single leader to phrase, so the caller fires this for BOTH
// clubs; each carries its own record. Same caller-gate: prehalf-callouts.js
// only invokes it once inning N is revealed, since knowing the game was tied
// there restates already-seen material. The bundle only carries keys 6–8
// (TIED_CHECKPOINTS), so any other inning returns null.
export function buildTiedAfterNote(bundle, side, inning) {
  const rec = bundle?.teamRecords?.[side]?.tiedAfterFull?.[inning]
  const teamName = bundle?.[side]?.name
  if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) return null
  return {
    text: `The ${teamName} are ${rec.w}-${rec.l} this season when tied after the ${ordinal(inning)}`,
    personId: null,
    side,
    kind: 'tiedAfterLive',
    dedupeKey: `tiedAfterLive-${side}-${inning}`,
    score: clampScore(SCORE_BASE.tiedAfter + 40 * skew(rec.w, rec.l)),
  }
}

// --- scoreless-through / day-of-week ------------------------------------------
// "The Brewers are 2-15 when scoreless through 6 innings" — a club still shut
// out entering the next half, and its season record when that happens (see
// gen-callouts.mjs's scorelessThroughFull). Numbers-only in the bundle, so the
// box-score sibling below can fold tonight in; here it stays entering-tense.
// CALLER-GATED like buildTiedAfterNote: knowing a club is scoreless through N
// restates tonight's already-revealed score, so prehalf-callouts.js only fires
// it once inning N is revealed. A run drought skews hard toward losing, so it
// only earns a card once the record is genuinely one-sided — SCORELESS_LOPSIDED
// keeps an ordinary early-inning ~.500 record (scoreless through the 1st means
// little) quiet, in either direction (a club that wins anyway is just as much a
// story). Shared with the roll-up below.
const SCORELESS_LOPSIDED = 0.68
export function scorelessLopsided(w, l) {
  const total = w + l
  if (total <= 0) return false
  const p = w / total
  return p >= SCORELESS_LOPSIDED || p <= 1 - SCORELESS_LOPSIDED
}
export const scorelessWhen = (inning) => `when scoreless through ${inning} ${inning === 1 ? 'inning' : 'innings'}`

export function buildScorelessThroughNote(bundle, side, inning) {
  const rec = bundle?.teamRecords?.[side]?.scorelessThroughFull?.[inning]
  const teamName = bundle?.[side]?.name
  if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) return null
  if (!scorelessLopsided(rec.w, rec.l)) return null
  return {
    text: `The ${teamName} are ${rec.w}-${rec.l} ${scorelessWhen(inning)}`,
    personId: null,
    side,
    kind: 'scorelessThrough',
    dedupeKey: `scorelessThroughLive-${side}-${inning}`,
    score: clampScore(SCORE_BASE.scorelessThrough + 40 * skew(rec.w, rec.l)),
  }
}

// "The Brewers are 5-3 in games still 0-0 after the 7th" — the pitchers'-duel
// sibling, fired for BOTH clubs when the game itself is scoreless entering the
// next half (bothScorelessThroughFull; a rare-situation record, so no
// lopsidedness floor — the record itself is the point, like tiedAfter). Same
// caller-gate as the scoreless-through note above.
export const bothScorelessWhen = (inning) => `in games still 0-0 after the ${ordinal(inning)}`

export function buildBothScorelessNote(bundle, side, inning) {
  const rec = bundle?.teamRecords?.[side]?.bothScorelessThroughFull?.[inning]
  const teamName = bundle?.[side]?.name
  if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) return null
  return {
    text: `The ${teamName} are ${rec.w}-${rec.l} ${bothScorelessWhen(inning)}`,
    personId: null,
    side,
    kind: 'bothScoreless',
    dedupeKey: `bothScorelessLive-${side}-${inning}`,
    score: clampScore(SCORE_BASE.bothScoreless + 40 * skew(rec.w, rec.l)),
  }
}

// "The Brewers are 10-4 on Sundays this season" — a pure calendar fact (no
// score-revealing content at all), so it rides the first-inning strip and the
// box-score roll-up without a reveal gate. gen-callouts.mjs keeps every day the
// club played (dayOfWeek, keyed 0=Sun…6=Sat); the gate is here — a real sample
// and a genuinely one-sided split, or an ordinary weekday reads as noise.
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DOW_MIN_GAMES = 6
export const DOW_LOPSIDED = 0.66
export const dowWhen = (dow) => `on ${WEEKDAYS[dow]}s`

// The day of week (0=Sun…6=Sat) of the game's official date, at UTC noon so the
// date string never slips a day — matching gen-callouts.mjs's DOW_OF. Returns
// null when the feed carries no date.
export function gameWeekday(feed) {
  const date = feed?.gameData?.datetime?.officialDate ?? feed?.gameData?.datetime?.originalDate
  return weekdayFromDate(date)
}
export function weekdayFromDate(date) {
  if (!date) return null
  const d = new Date(`${date}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d.getUTCDay()
}

export function buildDayOfWeekNote(bundle, side, dow) {
  if (dow == null || !WEEKDAYS[dow]) return null
  const rec = bundle?.teamRecords?.[side]?.dayOfWeek?.[dow]
  const teamName = bundle?.[side]?.name
  if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) return null
  const total = rec.w + rec.l
  if (total < DOW_MIN_GAMES) return null
  const p = total > 0 ? rec.w / total : 0
  if (!(p >= DOW_LOPSIDED || p <= 1 - DOW_LOPSIDED)) return null
  return {
    text: `The ${teamName} are ${rec.w}-${rec.l} ${dowWhen(dow)} this season`,
    personId: null,
    side,
    kind: 'dayOfWeek',
    dedupeKey: `dayOfWeek-${side}-${dow}`,
    score: clampScore(SCORE_BASE.dayOfWeek + 40 * skew(rec.w, rec.l)),
  }
}
