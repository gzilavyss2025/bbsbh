// Per-pitcher season-context notes for the always-open Pitchers table (see
// api/callout-notes.js for the analogous per-play/per-game family — this is the
// same idea, applied to computePitcherLines' rows instead of an at-bat card).
// Every fact here is a SEASON AGGREGATE (see gen-callouts.mjs's starterRecords),
// so — like the rest of the callouts bundle — it needs no SealBox; it's exactly
// as spoiler-free as the WHIP/AVG-against a leader card would show. Two shapes:
//
//   - "Entering tonight" facts (home/away split, CG/shutout total, scoreless-
//     outing streak, the bullpen-workload comparison against the level's
//     average reliever, the back-to-back-days ERA split, the leverage split —
//     opponents' line with his club ahead vs trailing) describe the season
//     BEFORE tonight, so they're shown as soon as his row exists, regardless
//     of how tonight's outing goes.
//   - Live milestones (the 6+ IP team record, the double-digit-strikeout
//     count) only fire once his OWN revealed line tonight actually clears the
//     threshold — computePitcherLines already keeps `ip`/`k` gated to
//     `revealedThrough`, so nothing sealed is read here either.

import { dayWordFor } from './select.js'

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
// baseline). Returns a plain string[] — this table has no headshot/logo card
// to attach identity to, unlike the play-by-play/box-score note families.
export function buildPitcherNotes(row, side, teamName, bundle) {
  const rec = bundle?.starterRecords?.[row.id]
  if (!rec) return []
  const bullpen = bundle?.bullpen
  const notes = []
  const team = teamName || 'His team'
  const word = dayWordFor(bundle?.dayNight)

  if (rec.homeAway) {
    const wl = rec.homeAway[side]
    if (wl) notes.push(`${team} are ${wl} in his ${side === 'home' ? 'home' : 'road'} starts this year`)
  }
  if (rec.cgShutout > 0) {
    notes.push(`${rec.cgShutout} complete game${rec.cgShutout === 1 ? '' : 's'}/shutout${rec.cgShutout === 1 ? '' : 's'} this season`)
  }
  if (rec.scorelessStreak > 1) {
    notes.push(`Riding a ${rec.scorelessStreak}-outing scoreless streak entering ${word}`)
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
    notes.push(
      `Heavy recent workload: ${rec.recentPitches} pitches across ${rec.recentAppearances} appearances in the last ${bullpen.windowDays} days — the average reliever threw ${bullpen.avgPitches}`,
    )
  } else if (rec.recentAppearances > 1) {
    // Counting tonight's outing — the row only exists once he's pitched.
    notes.push(`This is his ${ordinal(rec.recentAppearances + 1)} appearance in the last several days`)
  }

  // Back-to-back days — he pitched on the slate's eve, so tonight's outing is
  // no-rest work; with enough of a season sample, how that's gone for him.
  if (rec.reliever && rec.pitchedYesterday) {
    if (rec.backToBack?.era != null && rec.backToBack?.restEra != null) {
      notes.push(
        `Pitching on back-to-back days — he has a ${rec.backToBack.era.toFixed(2)} ERA on no rest this season (${rec.backToBack.restEra.toFixed(2)} otherwise)`,
      )
    } else {
      notes.push(`Pitching on back-to-back days ${word}`)
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
    if (Number.isFinite(a) && Number.isFinite(c) && Math.abs(a - c) >= LEVERAGE_AVG_GAP) {
      notes.push(
        `Opponents hit ${ahead.avg} off him with the ${team} ahead this season, ${contrast.avg} with them ${label}`,
      )
    }
  }

  if (rec.sixIp && ipToOuts(row.ip) >= SIX_IP_OUTS) {
    notes.push(`${team} are ${rec.sixIp} when he goes 6+ innings`)
  }
  if (rec.tenK > 0 && Number(row.k) >= TEN_K_THRESHOLD) {
    notes.push(`The ${ordinal(rec.tenK + 1)} time this season he's reached double-digit strikeouts`)
  }
  return notes
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
