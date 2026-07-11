// Context-neutral performance points — the "how good was the stat line" half
// of the blended player-ranking score used by the three stars (boxscore.js)
// and the slate Top Performers (topPerformers.js). Pure math over a player's
// box-score game line; no fetching. The inputs are score-revealing, so every
// caller is a reveal-only module — don't wire these into a spoiler-free
// surface.
//
// WHY A BLEND (ADR-0013): WPA alone is blind to dominance in a blowout — a
// starter carrying a no-hitter into the 9th of a 10-0 game barely moves a
// win probability that's already ~100%, so pure-WPA rankings bury him under
// middle relievers who protected one-run leads. These points restore the
// context-neutral half of the story; both halves land on the same scale
// (percentage points of a win, ~10 points ≈ one run of value), so callers
// just add them to a player's summed WPA.

// The feed's "6.1" innings-pitched notation is whole innings + outs-past-the-
// dot, NOT a decimal.
export function ipToOuts(ip) {
  const [whole, part] = String(ip ?? '0.0').split('.')
  return (Number(whole) || 0) * 3 + (Number(part) || 0)
}

// Bill James Game Score from a pitching line: 40 + 2*outs + K - 2*H - 4*ER -
// 2*(R-ER) - BB. An average start lands near 50; a gem in the 80s-90s.
// (Shared with dayHighlights.js's elite-start signal so the two can't drift.)
export function gameScore(s) {
  const outs = ipToOuts(s.inningsPitched)
  const r = s.runs ?? 0
  const er = s.earnedRuns ?? 0
  return 40 + 2 * outs + (s.strikeOuts ?? 0) - 2 * (s.hits ?? 0) - 4 * er - 2 * (r - er) - (s.baseOnBalls ?? 0)
}

// A pitcher's context-neutral points: Game Score centered on the ~average-start
// 50, so a quality start earns a modest positive, a gem +30..45, a shelling
// negative. Centering also keeps short relief outings near zero (1 scoreless
// inning ≈ 48), which is right: a reliever's value IS his leverage, and the
// WPA half of the blend already measures that. Gated on having actually
// pitched — the formula's constant 40 would otherwise hand -10 to every
// pinch hitter with an empty pitching line.
export function pitcherPoints(s) {
  if (!s || (ipToOuts(s.inningsPitched) === 0 && (s.battersFaced ?? 0) === 0)) return 0
  return gameScore(s) - 50
}

// A batter's context-neutral points: standard linear weights over the game
// line (runs of value), scaled by ~10 points per run (the usual 10-runs-per-
// win exchange rate onto the WPA percentage-point scale). An 0-4 is about
// -11, a 2-4 with a homer +16, a two-homer day around +26 — the same
// magnitude a hero's WPA carries, so neither half of the blend drowns the
// other.
export function batterPoints(b) {
  if (!b) return 0
  const h = b.hits ?? 0
  const singles = h - (b.doubles ?? 0) - (b.triples ?? 0) - (b.homeRuns ?? 0)
  const runs =
    0.47 * singles +
    0.78 * (b.doubles ?? 0) +
    1.04 * (b.triples ?? 0) +
    1.4 * (b.homeRuns ?? 0) +
    0.33 * ((b.baseOnBalls ?? 0) + (b.hitByPitch ?? 0)) +
    0.2 * (b.stolenBases ?? 0) -
    0.4 * (b.caughtStealing ?? 0) -
    0.27 * ((b.atBats ?? 0) - h)
  return 10 * runs
}

// Both halves of a player's stat line in one call — a two-way game (or a
// pitcher who batted) earns both; an empty line contributes zero. `stats` is
// a box-score player's `stats` object ({ batting, pitching }).
export function contextNeutralPoints(stats) {
  return pitcherPoints(stats?.pitching) + batterPoints(stats?.batting)
}
