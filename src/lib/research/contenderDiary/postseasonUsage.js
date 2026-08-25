// Diary entry — a direct follow-up on the roster-age spike (rosterAge.js),
// requested to close the trade-deadline-rental hole in that finding. Also
// introduces a reusable measure (postseason role vs. regular-season role)
// and catches a mechanical trap worth knowing before anyone reuses it.
// Full method: docs/team-success-postseason-usage.md.
export const postseasonUsageEntry = {
  id: 'postseason-usage-v1',
  date: '2026-08-25',
  source: 'Spike #1 follow-up',
  doc: 'docs/team-success-postseason-usage.md',
  title: 'The age effect survives checking who actually played — and a trap that would have shipped a backwards finding',
  verdict: 'holds',
  question:
    'Spike #1 found that older rosters go deeper in October, but a team’s age there counted every player on its full-season roster — including a trade-deadline rental who might never have gotten into a postseason game. Does the finding survive weighting a team’s age by who ACTUALLY played once October started?',
  headline:
    'Yes. Reweighting by real postseason playing time instead of regular-season role moves a team’s age by less than a tenth of a year, and pitching age still predicts postseason depth among the teams that made it. Along the way, a second, much more strikingly-worded result — "leaning on surprise contributors costs you games" — turned out to be almost entirely a measurement artifact, and reversed sign once corrected.',
  sections: [
    {
      id: 'the-check',
      heading: 'Does the age effect survive using real October playing time?',
      prose: [
        'For every team that made the postseason, its age was recomputed using only the players who actually pitched or batted in that team’s postseason games, weighted by how much they played THERE instead of during the regular season.',
      ],
      table: {
        caption: 'Postseason-actual age vs. the original regular-season age',
        columns: ['Measure', 'Difference'],
        rows: [
          ['Hitters', '0.09 years older, on average — essentially no change'],
          ['Pitchers', '0.01 years younger, on average — essentially no change'],
        ],
      },
      proseAfter: [
        'If the original finding were mostly padded by veterans who never got into a postseason game, this number would have moved a lot. It did not. And restricted to just the 250 team-seasons that made the postseason, pitching age measured this way still predicts how far a team goes (a real, checked result); batting age does not — the same split spike #1 already found.',
      ],
    },
    {
      id: 'the-trap',
      heading: 'A result that looked bigger than it was',
      prose: [
        'A natural next question: do teams that lean heavily on a player whose October role greatly exceeded his regular-season role do worse, because they were forced into it by injuries or a thin roster? The first pass said yes, clearly — and it was almost entirely a trick of the measuring stick.',
        'A team that loses in three games has a much smaller, lumpier sample of postseason innings to spread around than a team that plays twenty. That alone — nothing about who the players actually were — makes any single player’s SHARE of a short October look bigger. Once that is accounted for, the relationship flips: for a given amount of October playing time, leaning on a player who stepped into a bigger role than his regular season predicted is a MILD POSITIVE sign, not a red flag.',
      ],
      table: {
        caption: 'Before and after correcting for how many games a team actually played',
        columns: ['Version', 'Result'],
        rows: [
          ['Before correcting for games played', 'Looked bad: teams relying on "surprise" contributors went less far'],
          ['After correcting for games played', 'Mildly good: the same teams, for a given amount of October play, tended to go slightly FURTHER'],
        ],
      },
      proseAfter: [
        'This matters beyond this one number: any future measure of "share of a team\'s postseason activity" needs the same correction, because how many games a team played IS almost exactly how far it went. Skipping that check would have shipped the wrong-signed version.',
      ],
    },
  ],
  caveats: [
    'The corrected result (leaning on surprise contributors is a mild positive, once games played is held constant) is real but modest — not close to the biggest thing in this program.',
    'Every single outlier this measure surfaced, in both directions, was a pitcher — none were hitters. This is much better evidence about how pitching staffs get reorganized for October than about hitters or about acquisition strategy generally.',
    'The measure cannot tell a trade-deadline rental, an injury-return regular, and a September call-up apart — they look identical to it. A specific claim about any one of those needs the actual case checked by name, not just the aggregate number.',
    'Both checks here only cover the 250 team-seasons that made the postseason — there is nothing to measure for a team that never got to October.',
  ],
  open: [
    'Whether this same "playing-time-share needs a volume control" trap applies to any other factor spike in this program that touches postseason activity, not just this one.',
    'Whether the specific cases behind the biggest mismatches (a real trade-deadline story vs. an injury return vs. a rookie call-up) cluster differently against how far a team went.',
  ],
  technical: [
    'Postseason-actual age: PA/IP-weighted mean of each player\'s REGULAR-SEASON age (statsapi\'s boxscore endpoint carries no age field), weighted by his POSTSEASON PA/IP for that team instead of his regular-season PA/IP. n=250 postseason team-seasons.',
    'Spearman rho vs. the 0-5 ladder, restricted to postseason teams: postseasonBattingAgeRel 0.0882 (permutation p=0.1692, within-season shuffle, 5,000 draws), postseasonPitchingAgeRel 0.1731 (p=0.0070).',
    'Mismatch = postseasonShare − regularShare per player-team-season (share of team total PA for hitters, IP for pitchers). surpriseReliance = sum of positive mismatches per team-season.',
    'surpriseReliance vs. ladder: raw Spearman rho=−0.4257 (permutation p<0.0002). Confound check: surpriseReliance vs. total postseason IP, rho=−0.5478 (total postseason IP itself correlates with the ladder at rho=0.91, by construction). Partial Spearman correlation controlling for total postseason IP (rank-residualized, permutation test on the residualized statistic, within-season shuffle): rho=+0.2201, p=0.0006.',
  ],
}
