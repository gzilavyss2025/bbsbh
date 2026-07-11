# Player rankings blend WPA with context-neutral points; play of the game is winner-weighted

The three stars (`computeThreeStars`, `src/api/boxscore.js`), the slate Top
Performers boards, and the past-day Winners/Losers split
(`src/api/topPerformers.js`) originally ranked players by summed
win-probability added alone. WPA is the right backbone — it *is* the game's
story — but it has a known blind spot: once a game is decided there is no win
probability left to move, so dominance in a blowout scores near zero. The
real case that exposed it: 2026-07-08, Dylan Cease carried a no-hitter into
the 9th (8 IP, 1 H, 0 ER, 11 K) of a 10-0 game and ranked 13th on the day's
pitcher board, behind five middle relievers who had protected one-run leads.

The fix is the standard sabermetric answer rather than a bespoke metric: keep
WPA (context) and add a context-neutral half, both expressed in the same unit
(percentage points of one win, ~10 points ≈ one run), summed with equal
weight in `src/api/performanceScore.js`:

- **Pitchers**: Bill James Game Score − 50 (centered on an average start).
  Already the repo's dominance yardstick in `dayHighlights.js`, now shared
  from one module. Centering keeps a 1-inning reliever near zero, which is
  deliberate — a reliever's value is his leverage, and the WPA half already
  measures exactly that.
- **Batters**: standard linear weights over the game line (0.47/0.78/1.04/1.40
  for 1B/2B/3B/HR, 0.33 BB+HBP, 0.20 SB, −0.40 CS, −0.27 per out), × 10.

Equal weighting was validated empirically against the full 2026-07-08 and
07-10 MLB slates: Cease rises to #2 (behind Jared Jones's six no-hit innings
in a 3-0 game — WPA and stat line both elite), while high-leverage relievers
still chart instead of being swept away; batter boards keep genuine
hero-of-the-night ordering. Don't retune one half's scale without re-checking
those slates.

`computePlayOfTheGame` had the sibling problem in the other direction: it
ranked by MLB's `captivatingIndex` first, which loves fireworks regardless of
consequence — for NYY@WSH 2026-07-10 it picked the losing team's 7th-inning
go-ahead homer (CI 75) over the winner's 9th-inning two-run comeback shot
(CI 65, a 64-point WPA swing). It now scores each play `|WPA| + 0.5 × CI`,
and a play that moved the game toward the eventual LOSER keeps only 40% of
its score — the loser's biggest moment is by definition the one the winner
overcame, so it should headline only when it truly dwarfs everything else
(a historic individual feat in a losing effort still can). At MiLB parks
where captivatingIndex is absent/zero the WPA half still ranks alone, which
also replaces the old all-or-nothing CI/WPA fallback.
