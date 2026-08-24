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
    'No, and not for the reason you would guess. Clubs really do differ. But the difference between two clubs is smaller than the difference between two players inside the same club, so any per-club number we printed would read as precise and be worthless.',
  sections: [
    {
      id: 'widening',
      heading: 'First we tripled the sample, because that was the cheap thing to try',
      prose: [
        'Before declaring something unbuildable it is worth checking whether it is only unbuilt. So the study went from 881 players to 3,061, reaching back to debuts in 2005. That is as far back as the affiliate records can be trusted — statsapi’s own team-to-organization history gets unreliable before then, and attributing a stint to the wrong club is worse than not attributing it at all.',
        'More players changed the numbers, which is itself worth knowing.',
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
        'Here is the test, and it is the whole argument. Take the middle half of every club’s stays — cut off the fastest quarter and the slowest quarter, keep what is left. Then ask whether that band sits clear of the band you get from pooling all thirty clubs together. If it does, that club really is different and you can say so on a page.',
        'Zero of thirty clubs clear it. At Single-A, High-A, Double-A and Triple-A. At 881 players and again at 3,061.',
        'Toronto makes the point better than any statistic. Their Triple-A men have moved up in as little as 35 days and taken as long as 348 — a tenfold spread, inside one organization, and that spread is wider than the entire gap between the fastest club’s typical stay and the slowest club’s. Print "the Blue Jays typically move a Triple-A player in 53 days" and a reader will take it as a fact about the Blue Jays. It is not. It is a fact about whichever twenty-one players happened to land in the sample.',
      ],
    },
    {
      id: 'ranks-moved',
      heading: 'And the rankings did not hold still',
      prose: [
        'In the first pass the Reds were the fastest club at Triple-A, at 82 days. Add the older players and they are not the fastest anymore — the Blue Jays are, at 53 days, with the Nationals right behind at 55. A club’s rank moving that far when you add data is not a precision problem you fix with more data. It is a sign the ranking was never measuring what it looked like it was measuring.',
      ],
    },
    {
      id: 'tampa',
      heading: 'One club does survive everything: Tampa Bay',
      prose: [
        'Because thirty separate comparisons will hand you a few false positives no matter what, the same question was asked seven different ways — different sample, different corrections, different controls. Most clubs that show up "significant" show up under one method and vanish under the next.',
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
        'Read down the right-hand column. Which clubs look slow depends almost entirely on which reasonable choice you make about how to count — and that instability is the finding, not a nuisance around the edge of it. The Rays are in all seven rows, including the strictest and the one built on a completely different set of players. That is the closest thing to a real club-level result anywhere in this work, and it is still a footnote rather than a feature.',
      ],
    },
    {
      id: 'performance',
      heading: 'What actually decides when a man gets promoted',
      prose: [
        'How he is playing. It is far and away the strongest thing in the study — well ahead of the level, ahead of where he was drafted, ahead of which club owns him. That is not a shocking result, but it is the reason the club effect is so small. Thirty front offices are all watching the same thing and mostly reacting to it the same way.',
      ],
    },
  ],
  caveats: [
    'A real bug turned up during the review: every stay by a player who changed levels more than once was being stamped with the same season. Fixed, and the whole study rerun.',
    'Everybody in this study reached the majors. The players a club buried in Double-A for four years and released are invisible here, and they are exactly the players a "slow organization" story would be about.',
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
  ],
}
