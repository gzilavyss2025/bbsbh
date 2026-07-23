// Per-pitcher in-progress notes — the "Margin Notes" digest (MarginNotes.jsx),
// a ranked surface fed by every pitcher who's appeared so far this game (both
// sides), same worthiness-scoring pattern as the pre-half strip
// (prehalf-callouts.js): each candidate carries a `score`, sorted highest
// first; MarginNotes.jsx caps how many render up front and reveals the rest
// on tap (the FormerTeammates/InsightsCard "Show N more" pattern), so the
// builder itself doesn't truncate. This used to be an UNSCORED plain-string
// list wedged under each pitcher's row in the always-open Pitchers table
// (see docs/callouts.md's "Pitchers table" section — it explicitly predated
// the worthiness system); it's scored now so it can rank fairly against every
// other in-progress fact instead of listing every qualifying note per pitcher
// regardless of how interesting it is.
//
// Every SEASON-AGGREGATE fact here (see gen-callouts.mjs's starterRecords) is
// as spoiler-free as the WHIP/AVG-against a leader card would show — it needs
// no SealBox. Two shapes:
//
//   - "Entering tonight" facts (home/away split, CG/shutout total, scoreless-
//     outing streak, the bullpen-workload comparison against the level's
//     average reliever, the back-to-back-days ERA split, the leverage split —
//     opponents' line with his club ahead vs trailing) describe the season
//     BEFORE tonight, so they're shown as soon as his row exists, regardless
//     of how tonight's outing goes.
//   - Live facts (the health notes below, plus the 6+ IP team record and the
//     double-digit-strikeout count) only fire once his OWN revealed line
//     tonight actually clears the threshold — computePitcherLines already
//     keeps `ip`/`k`/`pitches` gated to `revealedThrough`, and pitcherHealth.js
//     is on the same ADR-0009 footing, so nothing sealed is read here either.

import { dayWordFor } from './select.js'
import { workloadFor } from './workload.js'
import { computePitcherLines } from './pitchers.js'
import { laboringFor, computeVeloDecay } from './pitcherHealth.js'

// Worthiness bases for this family, same 0–100 scale and clamp/skew idiom as
// callout-notes.js's SCORE_BASE (kept local rather than imported — this
// family didn't exist there, and prehalf-callouts.js sets the precedent of a
// self-contained scoring table rather than reaching into that file's
// internals). Health notes (laboring, velo decay) lead — they're the most
// actionable, tonight-specific read on a pitcher, ahead of season aggregates.
// See docs/callouts.md's worthiness table for where these sit relative to
// every other family.
const SCORE_BASE = {
  laboring: 48,
  veloDecay: 46,
  penFatigue: 42, // 3rd+ consecutive day — the sharpest documented fatigue pattern
  workload: 38, // heavy recent pitch load vs the level's average reliever
  backToBack: 36, // ERA split pitching on no rest
  leverage: 34, // opponents' AVG with his club ahead vs trailing/tied
  tenK: 33,
  scorelessStreak: 32,
  sixIp: 28,
  homeAway: 30, // starts-only split — modest, since starterRec already covers this pre-half
  cgShutout: 25,
  recentAppearances: 20, // plain "Nth appearance in the last several days" fallback
}
const clampScore = (n) => Math.max(0, Math.min(100, Math.round(n)))

// Innings pitched ("6.1" = 6⅓) -> outs, so a 6.0-or-better check compares
// linearly. Self-contained copy of the same helper used elsewhere (teamLeaders.js,
// gen-callouts.mjs) — not exported from either.
function ipToOuts(ip) {
  const [whole, frac = '0'] = String(ip ?? '0').split('.')
  const w = Number(whole)
  const f = Number(frac[0])
  return (Number.isFinite(w) ? w : 0) * 3 + (Number.isFinite(f) ? f : 0)
}
const SIX_IP_OUTS = 18
const TEN_K_THRESHOLD = 10

// How far above the peer average a reliever's trailing pitch count must sit
// before the workload note leads with the comparison — a fresh arm isn't the
// story, a taxed one is. The leverage note needs a real AVG gap between the
// ahead bucket and its contrast bucket, same bar the vs-team note uses.
const WORKLOAD_RATIO = 1.5
const LEVERAGE_AVG_GAP = 0.06

// `row` is one entry from computePitcherLines' away/home array; `side` is
// which club he pitches for ('away' | 'home'), `teamName` that club's display
// name, `bundle` the game's callouts bundle (its `starterRecords` family is
// keyed by pitcherId; `bullpen` carries the level's average-reliever workload
// baseline). `extras` optionally carries { workload, gameDate } — the
// gen-workload.mjs precompute plus the game's own date (already
// freshness-gated by the caller, like TeamInfo's bullpen board) — for the
// consecutive-days note below. `isStarter` is whether HE started tonight's
// game (the first pitcher in the team's boxscore order) — `rec.homeAway` is a
// starts-only split, so a reliever who happens to also start elsewhere in the
// rotation must not get credited with "starts" he isn't making tonight.
// Returns scored note objects — { text, personId, side, kind, dedupeKey,
// score } — same shape callout-notes.js's builders return, so MarginNotes.jsx
// can render this family exactly like a prehalf card.
export function buildPitcherNotes(row, side, teamName, bundle, extras = {}, isStarter = false) {
  const rec = bundle?.starterRecords?.[row.id]
  if (!rec) return []
  const bullpen = bundle?.bullpen
  const notes = []
  const team = teamName || 'His team'
  const word = dayWordFor(bundle?.dayNight)
  const push = (kind, text, scoreBonus = 0) =>
    notes.push({
      text,
      personId: row.id,
      side,
      kind,
      dedupeKey: `${kind}-${row.id}`,
      score: clampScore(SCORE_BASE[kind] + scoreBonus),
    })

  // Consecutive-days work, from the workload precompute (completed
  // appearances only — spoiler-free): the 3-straight-days pattern is the
  // sharpest documented fatigue signal (velo down ~1.5 mph), so it leads.
  // Suppresses the plain back-to-back fallback below (the ERA-split version
  // still shows — a different fact worth keeping).
  let consecNoted = false
  const load =
    extras.workload && extras.gameDate ? workloadFor(extras.workload, row.id, extras.gameDate) : null
  if (load && load.consecDays >= 2) {
    const dayWordCount = ['', '', 'third', 'fourth', 'fifth', 'sixth'][load.consecDays] ?? `${load.consecDays + 1}th`
    const stretch =
      load.last3?.pitches > 0 ? ` — ${load.last3.pitches} pitches over his last ${load.last3.apps} appearances` : ''
    push('penFatigue', `Working a ${dayWordCount} straight day${stretch}`)
    consecNoted = true
  }

  if (isStarter && rec.homeAway) {
    const wl = rec.homeAway[side]
    if (wl) push('homeAway', `${team} are ${wl} in his ${side === 'home' ? 'home' : 'road'} starts this year`)
  }
  if (rec.cgShutout > 0) {
    push(
      'cgShutout',
      `${rec.cgShutout} complete game${rec.cgShutout === 1 ? '' : 's'}/shutout${rec.cgShutout === 1 ? '' : 's'} this season`,
    )
  }
  if (rec.scorelessStreak > 1) {
    push('scorelessStreak', `Riding a ${rec.scorelessStreak}-outing scoreless streak entering ${word}`, Math.min(15, rec.scorelessStreak - 1))
  }

  // Bullpen workload — a reliever who's been ridden hard lately, measured in
  // pitches against the level's average reliever over the same trailing
  // window (see gen-callouts.mjs's bullpen baseline). Only when he's
  // meaningfully above the peer line; otherwise the plain appearance-count
  // note below still marks a busy stretch.
  if (
    rec.reliever &&
    rec.recentAppearances > 1 &&
    bullpen?.avgPitches > 0 &&
    rec.recentPitches >= WORKLOAD_RATIO * bullpen.avgPitches
  ) {
    push(
      'workload',
      `Heavy recent workload: ${rec.recentPitches} pitches across ${rec.recentAppearances} appearances in the last ${bullpen.windowDays} days — the average reliever threw ${bullpen.avgPitches}`,
    )
  } else if (rec.recentAppearances > 1) {
    // Counting tonight's outing — the row only exists once he's pitched.
    push('recentAppearances', `This is his ${ordinal(rec.recentAppearances + 1)} appearance in the last several days`)
  }

  // Back-to-back days — he pitched on the slate's eve, so tonight's outing is
  // no-rest work; with enough of a season sample, how that's gone for him.
  if (rec.reliever && rec.pitchedYesterday) {
    if (rec.backToBack?.era != null && rec.backToBack?.restEra != null) {
      push(
        'backToBack',
        `Pitching on back-to-back days — he has a ${rec.backToBack.era.toFixed(2)} ERA on no rest this season (${rec.backToBack.restEra.toFixed(2)} otherwise)`,
      )
    } else if (!consecNoted) {
      push('backToBack', `Pitching on back-to-back days ${word}`)
    }
  }

  // Leverage — opponents' line with his club ahead vs trailing/tied, when the
  // gap is a real story in either direction (the "does he pitch better with
  // the lead?" split). Season aggregate, spoiler-free like everything here.
  const ahead = rec.leverage?.ahead
  const contrast = rec.leverage?.behind ?? rec.leverage?.tied
  if (ahead?.avg && contrast?.avg) {
    const a = Number(ahead.avg)
    const c = Number(contrast.avg)
    const label = rec.leverage.behind ? 'trailing' : 'tied'
    const gap = Math.abs(a - c)
    if (Number.isFinite(a) && Number.isFinite(c) && gap >= LEVERAGE_AVG_GAP) {
      push(
        'leverage',
        `Opponents hit ${ahead.avg} off him with the ${team} ahead this season, ${contrast.avg} with them ${label}`,
        Math.min(15, Math.round((gap - LEVERAGE_AVG_GAP) * 100)),
      )
    }
  }

  if (rec.sixIp && ipToOuts(row.ip) >= SIX_IP_OUTS) {
    push('sixIp', `${team} are ${rec.sixIp} when he goes 6+ innings`)
  }
  if (rec.tenK > 0 && Number(row.k) >= TEN_K_THRESHOLD) {
    push('tenK', `The ${ordinal(rec.tenK + 1)} time this season he's reached double-digit strikeouts`)
  }
  return notes
}

// The health notes for one pitcher row — same scored shape as buildPitcherNotes,
// so both feed the same ranked Margin Notes list. Only genuine flags return a
// note (a normal outing adds nothing); see pitcherHealth.js for the thresholds.
function healthNotes(id, side, health) {
  const notes = []
  const labor = health?.labor?.[id]
  if (labor?.laboring) {
    notes.push({
      // Was "... pitches per inning tonight —" — wrong for a day game, and
      // didn't say what the rate was measured through. `labor.ip` is this
      // row's own reveal-clamped innings pitched (see laboringFor,
      // pitcherHealth.js), so this reads correctly for any start time and
      // updates on its own as more of his outing is revealed.
      text: `Laboring: ${labor.pitchesPerInning.toFixed(1)} pitches per inning through ${labor.ip} IP — his season norm is ${labor.baseline.toFixed(1)}.`,
      personId: id,
      side,
      kind: 'laboring',
      dedupeKey: `laboring-${id}`,
      score: clampScore(SCORE_BASE.laboring + Math.min(15, Math.round((labor.ratio - 1) * 30))),
    })
  }
  const velo = health?.velo?.[id]
  if (velo?.flagged) {
    notes.push({
      text: `Fastball down ${velo.drop.toFixed(1)} mph from his early innings (${velo.anchor.toFixed(1)} → ${velo.current.toFixed(1)}).`,
      personId: id,
      side,
      kind: 'veloDecay',
      dedupeKey: `veloDecay-${id}`,
      score: clampScore(SCORE_BASE.veloDecay + Math.min(15, Math.round((velo.drop - 1.5) * 6))),
    })
  }
  return notes
}

// The Margin Notes digest: every pitcher who's appeared so far this game
// (both sides), deduped and ranked by score — the live counterpart to the
// pre-half strip. `feed`/`revealedThrough` build the reveal-clamped stat rows
// (computePitcherLines, ADR-0009) and the health reads (pitcherHealth.js,
// same footing); `bundle` is the game's callouts bundle; `teamNames` is
// `{ away, home }` display names; `extras` is the `{ workload, gameDate }`
// pair buildPitcherNotes reads for the consecutive-days note.
export function buildMarginNotes(feed, revealedThrough, bundle, teamNames, extras = {}) {
  if (!bundle) return []
  const lines = computePitcherLines(feed, revealedThrough)
  const velo = computeVeloDecay(feed, revealedThrough)

  // Dedupe by dedupeKey (falling back to the text itself), same contract
  // callout-notes.js's box-score roll-up defines: a later note with the same
  // key REPLACES the earlier one in place, so a stable sort below keeps
  // first-fired position while still showing the most-current wording.
  // `dedupeKey` already includes personId (`${kind}-${row.id}`), so today
  // this only actually collapses anything in the (currently impossible, but
  // not worth trusting blindly) case of the same pitcher/kind pair getting
  // pushed twice — cheap insurance against a future duplicate note, same as
  // why callout-notes.js keeps this pass even though most of its callers
  // rarely trigger it either.
  const byKey = new Map() // dedupeKey -> index into ordered
  const ordered = []
  const add = (note) => {
    if (!note) return
    const key = note.dedupeKey ?? note.text
    const at = byKey.get(key)
    if (at != null) {
      ordered[at] = note
      return
    }
    byKey.set(key, ordered.length)
    ordered.push(note)
  }

  for (const side of ['away', 'home']) {
    const teamName = teamNames?.[side] ?? ''
    // A side's starter is always its first entry in boxscore order (see
    // computePitcherLines) — computed once per side rather than threaded
    // through as a prop, since Margin Notes spans every pitcher on both
    // teams, not one row at a time like the old Pitchers-table call site.
    for (const [i, row] of (lines[side] ?? []).entries()) {
      const isStarter = i === 0
      for (const note of buildPitcherNotes(row, side, teamName, bundle, extras, isStarter)) add(note)
      const labor = laboringFor(row, extras.workload?.pitchers?.[row.id])
      for (const note of healthNotes(row.id, side, { labor: labor ? { [row.id]: labor } : {}, velo })) add(note)
    }
  }
  return ordered.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
