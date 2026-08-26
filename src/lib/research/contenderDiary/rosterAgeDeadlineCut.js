// Diary entry — cutting the trade deadline out of the roster-age measure.
// Full method: docs/team-success-roster-age-deadline-cut.md.
export const rosterAgeDeadlineCutEntry = {
  id: 'roster-age-deadline-cut-v1',
  date: '2026-08-26',
  source: 'Spike #8, follow-up to #1',
  doc: 'docs/team-success-roster-age-deadline-cut.md',
  title: 'Half the batting-age story was the trade deadline. The pitching-age story mostly was not.',
  verdict: 'holds',
  question:
    'The first roster-age entry on this page had one big worry attached. A team gets counted as "old" partly because it went out and rented a veteran at the trade deadline, and that only happens because the team was already good. What is left of the age story if you throw those rentals out and count a team only by who was already there before the deadline?',
  headline:
    'A lot changes, and it changes differently for hitters than for pitchers. Cut every trade-deadline pickup out and measure a team only through the end of July, and the pitching-age story barely budges — teams with older pitching staffs still go deeper, almost as strongly as before. But the batting-age story loses about half its strength. A good chunk of "older lineups win more" turns out to really be "winning teams buy an older bat in July," not something already true back in April. And the one place this really bites: World Series winners used to have a hitters-are-older gap that looked real. Cut the deadline pickups out, and that gap gets small enough that it might just be luck, at only twenty-five champions to look at. The pitching side of that same comparison does not move.',
  sections: [
    {
      id: 'the-cut',
      heading: 'What changed when the July 31 additions came out',
      prose: [
        'The first entry on this page measured a team by its entire season, mistakes and midsummer shopping trips included. This one measures the same teams using only what happened through July 31, before most trades. A player picked up at the deadline now counts for nothing toward his new team\'s age, because he never played an inning for them before the cutoff.',
      ],
      table: {
        caption: 'How much of the original age-to-outcome story survives the cut',
        columns: ['Measure', 'Kept after cutting the deadline'],
        rows: [
          ['Hitters’ age', 'About half'],
          ['Pitchers’ age', 'About three-quarters'],
          ['Both combined', 'About two-thirds'],
        ],
      },
      proseAfter: [
        'That gap between the two sides is the headline. Pitching age was mostly not a trade-deadline mirage. Batting age, roughly half of it was.',
      ],
    },
    {
      id: 'ws-winners',
      heading: 'The one comparison that got shaky',
      prose: [
        'Champions used to have a clear edge in hitters’ age over everyone else. Cut the July additions out, and that edge shrinks to the point where it could plausibly be chance. There have only been twenty-five World Series winners across the whole stretch of seasons studied here. This was always the thinnest slice of the data, and this is the first time it actually broke under a stress test.',
        'The pitching side of the exact same comparison did not move. Champions still run noticeably older on the mound, deadline pickups or not.',
      ],
    },
    {
      id: 'not-a-duplicate',
      heading: 'How this differs from the "who actually played in October" check',
      prose: [
        'A later entry on this page already asked a related question: does the age story hold up once you count only the players who actually took the field in October? It found the age number barely moved, and said so plainly. That check and this one are not the same thing, and they do not disagree.',
        'That earlier check still gives a deadline pickup full credit for his age if he plays in October. This check gives him none at all, no matter what he does later, because he was not there yet in July. Both are true at once. A team\'s deadline additions really do play meaningful October innings, and leaving their stat line out of the age count still measurably weakens the age story, mostly on the hitting side. The first roster-age entry had guessed this second question was already answered by the first check. Having actually run it, that guess was wrong. This is a real, separate result.',
      ],
    },
  ],
  caveats: [
    'The World Series-winner comparison sits at only twenty-five champions across the whole window studied, one per year, with no way to add more from this data source. Treat its flip from a real-looking result to a shaky one as a caution about how few champions there are to look at, not as proof that batting age never matters for a champion.',
    'This does not prove the surviving age effect is caused by age itself. Everything the original roster-age entry already said still applies. There is no way to check payroll here. A team may simply already have good, established players who happen to be older, for reasons that have nothing to do with age helping them win.',
    'This spike only shows how much of the original finding was a trade-deadline story. It cannot say the leftover, smaller effect is the true one and the rest was fake. Both halves of a team\'s season are real baseball; this just separates what happened before the trade deadline from what happened after it.',
    'A second check, leaving one whole team out of the data thirty different times, was run by an independent reviewer rather than being part of the original work. It passed cleanly on both sides of the roster. It should be folded into the main analysis going forward instead of living as a one-off check.',
  ],
  open: [
    'Folding this correction into the original roster-age entry’s own "what would move this next" note, which had wrongly guessed this exact idea was already answered by a different check.',
    'Registering this spike’s data panel in the shared research database, since it was built with a direct file join while that shared system was busy with other work.',
    'Everything else on the factor catalog in docs/team-success-research.md this program has not reached yet.',
  ],
  technical: [
    'Pre-deadline age computed via GET /api/v1/stats?stats=byDateRange bounded March 1-July 31 of each season, PA-weighted (hitters) / IP-weighted (pitchers), joined against the existing season-level age cache from roster-age.json by personId+season+group; 0 of 38,519 pulled stints failed to match. Relative fields subtract that season\'s own pre-deadline league-weighted mean, matching spike #1\'s whole-season convention.',
    '750 team-seasons (2000-2025, 2020 excluded). Spearman rho vs. the 0-5 ladder, pre-deadline vs. whole-season: batting 0.106 vs. 0.205 (52% retained, p=0.0046 pre-deadline); pitching 0.208 vs. 0.282 (74% retained, p<0.0001); roster (mean of both) 0.190 vs. 0.289 (66% retained, p<0.0001).',
    'Season-level block-bootstrap (2,000 resamples) on the gap between whole-season and pre-deadline rho, 95% CI: batting +0.099 [0.081, 0.116]; pitching +0.074 [0.052, 0.097]; roster +0.099 [0.077, 0.124] — all exclude zero, confirming the shrinkage is a real effect rather than an artifact of computing two correlations off the same 750 rows.',
    'Band comparisons, pre-deadline age relative to that season\'s own pre-deadline league average (whole-season spike #1 figures in parens): made postseason (n=234 vs 516) batting +0.29yr (was +0.55yr) p=0.0038, pitching +0.63yr (was +0.83yr) p<0.0001; LCS-or-better (n=100 vs 650) batting +0.50yr (was +0.72yr) p=0.0004, pitching +0.83yr (was +0.99yr) p<0.0001; World Series winner (n=25 vs 725) batting +0.48yr (was +0.71yr) p=0.08 (was p=0.0058), pitching +1.20yr (was +1.31yr) p<0.0001 both ways.',
    'Division winners (n=150) vs. wild card (n=84) among postseason clubs, pre-deadline: batting diff +0.23yr p=0.21 (was p=0.31); pitching diff -0.09yr p=0.69 (was p=0.49). Both null, unchanged conclusion from spike #1.',
    'Robustness: same sign in 25/25 leave-one-season-out refits (build) and independently, 30/30 leave-one-club-out refits on both age measures during verification (range 0.072-0.121 batting, 0.177-0.218 pitching), including with the Yankees (the single most influential club) excluded. A non-rank Pearson alternate specification (0.121 batting, 0.226 pitching) confirms the result is not a rank-transformation artifact. 2020-included sensitivity (n=780) moves every figure by 0.01-0.02, no sign flips.',
    'Spot check: 2014 Oakland A\'s (the Jon Lester deadline trade, also the marquee case in the postseason-usage follow-up) — pre-deadline pitching IP 977.33 vs. whole-season 1463.33; pitchingAgeRelative moves from -0.61 (pre-deadline) to -0.26 (whole-season), the expected direction and size for adding a proven 30-year-old starter for the stretch run.',
    'Verification (independent re-run against the same cached JSON files): all Spearman rhos reproduced exactly (deterministic); permutation and bootstrap p-values reproduced within Monte Carlo noise (the analysis script uses unseeded random draws by design, e.g. batting permutation p 0.0054 vs. reported 0.0046, WS-band batting p 0.0694 vs. reported 0.0796 — both land on the same side of every threshold cited above). Verdict: confirmed, no retraction. The one substantive gap the verifier flagged, beyond running leave-one-club-out itself, is that the original build\'s caveats treated spike #1\'s "largely superseded" framing as simply outdated rather than stating plainly that this spike shows that framing was wrong; this entry states it directly per the point above.',
  ],
}
