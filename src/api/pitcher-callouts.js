// Per-pitcher season-context notes for the always-open Pitchers table (see
// api/callout-notes.js for the analogous per-play/per-game family — this is the
// same idea, applied to computePitcherLines' rows instead of an at-bat card).
// Every fact here is a SEASON AGGREGATE (see gen-callouts.mjs's starterRecords),
// so — like the rest of the callouts bundle — it needs no SealBox; it's exactly
// as spoiler-free as the WHIP/AVG-against a leader card would show. Two shapes:
//
//   - "Entering tonight" facts (home/away split, CG/shutout total, scoreless-
//     outing streak, recent-appearance count) describe the season BEFORE
//     tonight, so they're shown as soon as his row exists, regardless of how
//     tonight's outing goes.
//   - Live milestones (the 6+ IP team record, the double-digit-strikeout
//     count) only fire once his OWN revealed line tonight actually clears the
//     threshold — computePitcherLines already keeps `ip`/`k` gated to
//     `revealedThrough`, so nothing sealed is read here either.

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

// `row` is one entry from computePitcherLines' away/home array; `side` is
// which club he pitches for ('away' | 'home'), `teamName` that club's display
// name, `starterRecords` the bundle family keyed by pitcherId. Returns a
// plain string[] — this table has no headshot/logo card to attach identity
// to, unlike the play-by-play/box-score note families.
export function buildPitcherNotes(row, side, teamName, starterRecords) {
  const rec = starterRecords?.[row.id]
  if (!rec) return []
  const notes = []
  const team = teamName || 'His team'

  if (rec.homeAway) {
    const wl = rec.homeAway[side]
    if (wl) notes.push(`${team} are ${wl} in his ${side === 'home' ? 'home' : 'road'} starts this year`)
  }
  if (rec.cgShutout > 0) {
    notes.push(`${rec.cgShutout} complete game${rec.cgShutout === 1 ? '' : 's'}/shutout${rec.cgShutout === 1 ? '' : 's'} this season`)
  }
  if (rec.scorelessStreak > 1) {
    notes.push(`Riding a ${rec.scorelessStreak}-outing scoreless streak entering tonight`)
  }
  if (rec.recentAppearances > 1) {
    notes.push(`This is his ${ordinal(rec.recentAppearances)} appearance in the last several days`)
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
