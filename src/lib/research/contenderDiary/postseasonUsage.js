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
    'Spike #1 found that older rosters go deeper in October. But it counted every player who wore the uniform all season — including the veteran a club rented in July who then sat on the bench all October. Does the finding hold up if a team\'s age is weighted by who ACTUALLY played once the postseason started?',
  headline:
    'Yes. Counting only the men who actually took the field in October moves a team\'s age by less than a tenth of a year, and pitching age still lines up with how far a club goes. Along the way, a second result with a much louder headline — "leaning on surprise contributors costs you games" — turned out to be almost all measuring stick and almost no baseball. Fixed properly, it points the other way.',
  sections: [
    {
      id: 'the-check',
      heading: 'Does the age effect survive using real October playing time?',
      prose: [
        'Picture the veteran a contender rents in July. He is thirty-six, he has a ring, and he makes the roster older the day he signs. Then October comes and he sits. Every club that reached October had its age worked out a second time to deal with exactly that man. This pass counted only the players who actually batted or pitched in that club\'s postseason games. It weighted each one by how much he played THERE rather than by his summer workload.',
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
        'If the first finding had been propped up by veterans who never got off the bench in October, this number would have swung hard. It barely moved. And looking only at the 250 team-seasons that reached the postseason, pitching age measured this new way still tracks how far a club goes, and it is a checked result, not a hunch. Batting age still does not. That is the same hitting-versus-pitching split spike #1 already found.',
      ],
    },
    {
      id: 'the-trap',
      heading: 'A result that looked bigger than it was',
      prose: [
        'Here is the natural next question. Some clubs get to October and end up leaning on a man who barely pitched all year — the long reliever pressed into a start, the September call-up handed the eighth inning. Does being forced into that hurt you? The first pass said yes, loudly. The first pass was almost entirely a trick of the measuring stick.',
        'Picture two clubs. One gets swept in three games. The other plays twenty. The swept club has a tiny pile of innings to hand out, so ANY one pitcher\'s slice of it looks huge — not because of who he is, but because the pie is small. Once you compare clubs that played a similar amount of October baseball, the whole thing turns over. For a given amount of October play, leaning on a man who stepped into a bigger role than his regular season predicted is a MILD GOOD sign, not a warning light.',
      ],
      table: {
        caption: 'Before and after allowing for how many games a team actually played',
        columns: ['Version', 'Result'],
        rows: [
          ['Before allowing for games played', 'Looked bad: teams relying on "surprise" contributors went less far'],
          ['After allowing for games played', 'Mildly good: the same teams, for a given amount of October play, tended to go slightly FURTHER'],
        ],
      },
      proseAfter: [
        'This lesson is bigger than this one number. Any future measure built on "what share of a team\'s October did this player handle" needs the same fix, because how many games a club played IS very nearly the same thing as how far it went. Skip that step and you ship the backwards version.',
      ],
    },
  ],
  caveats: [
    'The fixed result — leaning on surprise contributors is a mild plus, once you hold games played steady — is real but modest. It is nowhere near the biggest thing in this program.',
    'Every single extreme case this measure turned up, in both directions, was a pitcher. Not one was a hitter. So this is much better evidence about how pitching staffs get reshuffled for October than about hitters, or about how clubs get players generally.',
    'The measure cannot tell a trade-deadline rental, a regular coming back off the injured list, and a September call-up apart. All three look identical to it. Any specific claim about one of those needs the actual case checked by name, not just the aggregate number.',
    'Both checks here cover only the 250 team-seasons that reached October. There is nothing to measure for a club that never got there.',
  ],
  open: [
    'Whether this same "a share of October needs a games-played fix" trap applies to any other factor spike in this program that touches postseason activity, not just this one.',
    'Whether the specific cases behind the biggest role jumps (a real trade-deadline story vs. a man returning from injury vs. a rookie call-up) sort differently against how far a team went.',
  ],
  technical: [
    'Postseason-actual age: PA/IP-weighted mean of each player\'s REGULAR-SEASON age (statsapi\'s boxscore endpoint carries no age field), weighted by his POSTSEASON PA/IP for that team instead of his regular-season PA/IP. n=250 postseason team-seasons.',
    'Spearman rho vs. the 0-5 ladder, restricted to postseason teams: postseasonBattingAgeRel 0.0882 (permutation p=0.1692, within-season shuffle, 5,000 draws), postseasonPitchingAgeRel 0.1731 (p=0.0070).',
    'Mismatch = postseasonShare − regularShare per player-team-season (share of team total PA for hitters, IP for pitchers). surpriseReliance = sum of positive mismatches per team-season.',
    'surpriseReliance vs. ladder: raw Spearman rho=−0.4257 (permutation p<0.0002). Confound check: surpriseReliance vs. total postseason IP, rho=−0.5478 (total postseason IP itself correlates with the ladder at rho=0.91, by construction). Partial Spearman correlation controlling for total postseason IP (rank-residualized, permutation test on the residualized statistic, within-season shuffle): rho=+0.2201, p=0.0006.',
    'Prose-to-formal map for this entry: "allowing for how many games a team actually played" is the rank-residualized partial Spearman controlling for total postseason IP; "the pie is small" is the mechanical inflation of any one player\'s share when the denominator (team postseason IP/PA) is small — and that denominator is itself the quantity carrying the outcome signal (rho=0.91 with the ladder). The sign reversal between the raw and controlled statistics (−0.4257 to +0.2201, both clearing the conventional threshold) is the entire reason this entry exists.',
    'Reusable rule this spike establishes: any team-level statistic whose denominator is postseason volume is confounded with the outcome ladder by construction, and must be reported with the volume control alongside the raw version rather than instead of it.',
    'The two age deltas quoted in the table (hitters +0.09 years, pitchers −0.01 years) are mean differences between the postseason-actual and regular-season relative-age fields over the same n=250 postseason team-seasons — small enough on both sides that the deadline-rental dilution story spike #1 flagged cannot account for the original association.',
  ],
}
