// Diary entry — the team-movement-window spike. Three pull requests, one
// question, one answer that never moved: no per-club range is shippable.
//
// This entry states the work AS IT STOOD when it merged. The entry above it
// (the 2016-2020 slowdown) takes two of these numbers back. Both are kept
// rather than one quietly overwriting the other — a diary that edits its past
// entries to agree with its present conclusions cannot show anyone how a
// conclusion actually moved.
export const movementWindowsEntry = {
  id: 'team-movement-windows',
  date: '2026-08-24',
  source: 'PR #881 – #883',
  doc: 'docs/team-movement-windows.md',
  title: 'Does your club move prospects slower than everyone else?',
  verdict: 'no-ship',
  question:
    'The benchmark says a typical Double-A stay is about eleven months. Could we say something sharper — "the Rays move a Double-A man in eight to eleven months, the Rockies take longer"?',
  headline:
    'No, and not for the reason you would guess. Clubs really do differ. But two players inside the same club differ from each other more than any two clubs differ, so a number printed next to your club\'s name would look exact and mean nothing.',
  sections: [
    {
      id: 'widening',
      heading: 'First we tripled the sample, because that was the cheap thing to try',
      prose: [
        'Before you call something unbuildable it is worth making sure it is not merely unbuilt. So the study went from 881 players to 3,061, back to men who debuted in 2005. That is as far as the affiliate records reach. Before then, the league\'s own record of which farm club belonged to which organization gets shaky, and hanging a stint on the wrong club is worse than hanging it on nobody.',
        'Tripling the sample moved the numbers, which is worth knowing on its own.',
      ],
      table: {
        caption: 'What tripling the sample changed',
        columns: ['Measure', '881 players (2019–23)', '3,061 players (2005–23)'],
        rows: [
          ['Triple-A plate appearances', '327', '380'],
          ['Triple-A innings', '54.0', '60.3'],
          ['Triple-A days at level', '250', '171'],
          ['Double-A days at level', '349', '331'],
          ['High-A days at level', '308', '286'],
          ['Clubs with enough players to rank', '25 to 27 of 30', '30 of 30'],
        ],
        note: 'Typical stays. The older players in the wider group needed more playing time before a promotion than the recent ones do — call it 15 to 20 percent more.',
      },
    },
    {
      id: 'zero-of-thirty',
      heading: 'The answer: nobody stands apart. Not one club, at any level',
      prose: [
        'Here is the test, and it is the whole argument. Take one club\'s stays and throw out its fastest quarter and its slowest quarter. What is left is the middle half. Do the same with all thirty clubs poured into one pile. Now ask whether the club\'s band sits clear of the big pile\'s band. If it does, that club really is different, and you can print it.',
        'Zero of thirty clubs clear it. Not at Single-A, not at High-A, not at Double-A, not at Triple-A. Not at 881 players, and not again at 3,061.',
        'Toronto makes the point better than any number can. Their Triple-A men have moved up in as little as 35 days and taken as long as 348 — ten times the wait, inside one organization. That spread is wider than the whole gap between the fastest club\'s typical stay and the slowest club\'s. Print "the Blue Jays typically move a Triple-A player in 53 days" and a reader will take it as a fact about the Blue Jays. It is not. It is a fact about whichever twenty-one players happened to land in the sample.',
      ],
    },
    {
      id: 'ranks-moved',
      heading: 'And the rankings did not hold still',
      prose: [
        'In the first pass the Reds were the fastest club at Triple-A, at 82 days. Add the older players and they are not the fastest at all — the Blue Jays are, at 53 days, with the Nationals a step behind at 55. When a leaderboard reshuffles that hard just because you fed it more players, the problem is not that it needs sharpening. The problem is that it was never a leaderboard.',
      ],
    },
    {
      id: 'tampa',
      heading: 'One club does survive everything: Tampa Bay',
      prose: [
        'Ask the same question of thirty clubs and two or three will look special on luck alone. That is arithmetic, not baseball. So the question was put seven different ways, changing the players, the corrections and the controls each time. Most clubs that stand out under one method vanish under the next.',
      ],
      table: {
        caption: 'Which clubs looked different, and under which method',
        columns: ['How it was measured', 'Clubs that stood out'],
        rows: [
          ['Simplest version, all players', 'Nationals, Orioles, Brewers, Rays'],
          ['Same, corrected for testing thirty clubs', 'Nationals, Rays'],
          ['Accounting for players appearing more than once', 'Orioles, Brewers, Rays'],
          ['Same, plus the thirty-club correction', 'Rays'],
          ['Same, plus an era control', 'Orioles, Brewers, Rays'],
          ['A different, narrower group of players', 'Braves, Guardians, Rays'],
          ['Same, plus how well the man was playing', 'Braves, Guardians, Rays'],
        ],
      },
      proseAfter: [
        'Read down the right-hand column. Which clubs look slow depends almost entirely on which perfectly defensible choice you make about how to count them — and that wobble is the finding, not a nuisance around the edge of it. The Rays are in all seven rows, including the strictest one and the one built on an entirely different set of players. That is the closest thing to a real club-level result anywhere in this work, and it is still a footnote rather than a feature.',
      ],
    },
    {
      id: 'performance',
      heading: 'What actually decides when a man gets promoted',
      prose: [
        'How he is playing. Nothing else in the study comes close — not the level, not where he was drafted, not whose farm system he is in. That is not a surprising answer, and it is exactly why the club effect is so faint. Thirty front offices are all reading the same box score and mostly doing the same thing about it.',
      ],
    },
  ],
  caveats: [
    'A real bug turned up during the review: every stay by a player who changed levels more than once was being stamped with the same season. It was fixed, and the whole study was run again.',
    'Everybody in this study reached the majors. The players a club buried in Double-A for four years and then released are invisible here, and they are exactly the players a "slow organization" story would be about.',
    'Payroll is not in this anywhere, because no historical payroll data exists in this repo at all. The salary and contract files are current-season snapshots looking forward, not a record of what clubs used to spend.',
  ],
  open: [
    'If a per-club range is ever going to work, it needs a smarter method, not a bigger sample. The bigger sample has been tried and it did not help.',
  ],
  technical: [
    'Durations resolved from the transactions wire; org attribution via a season-by-season team→parentOrg map (52 statsapi calls across sportIds 11–14), not the current affiliate file.',
    'Overlap test: per org/level p25–p75 against pooled p25–p75, n≥8 per cell. 0 of 30 at every level in both cohorts.',
    'Omnibus at the time: cluster-robust Wald F=1.824 (p=0.0048), player-collapsed ANOVA F=1.685 (p=0.0128), ICC ≈ 1.2%. Both figures are revised by the later entry.',
    'Tampa Bay is BH-significant under naive and cluster-robust SEs, with and without era and performance controls, and on the disjoint performance-eligible subsample.',
    'Cohort widening: 881 (debuts 2019–23) → 3,061 (debuts 2005–23). 2005 is the attribution floor — affiliate→parent mapping is unreliable before it. Median level stays run 15–20% longer in the wider cohort, and rankable cells go from 25–27 of 30 to 30 of 30.',
    'Toronto Triple-A: observed 35–348 days over n=21 stays, a within-org spread wider than the full fastest-to-slowest range of club medians.',
    'Rank instability across cohorts: the fastest Triple-A club moves from Cincinnati (82 days, 2019–23) to Toronto (53 days) with Washington second (55 days) in 2005–23.',
    'The seven specifications in the table, in order: naive SEs, all stays; naive + Benjamini-Hochberg; player-clustered SEs; clustered + BH; clustered + BH + era control; the disjoint performance-eligible subsample; that subsample plus a performance control.',
  ],
}
