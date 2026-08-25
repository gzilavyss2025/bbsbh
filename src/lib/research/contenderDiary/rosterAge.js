// Diary entry — the first factor spike, roster age vs. the outcome ladder.
// Full method: docs/team-success-roster-age.md.
export const rosterAgeEntry = {
  id: 'roster-age-v1',
  date: '2026-08-25',
  source: 'Spike #1',
  doc: 'docs/team-success-roster-age.md',
  title: 'Older teams go deeper in October — but probably not for the reason it looks like',
  verdict: 'holds',
  question:
    'Compared to the rest of the league that same year, does a team with an older roster go further in the postseason? And does age separate the teams that win their division from the ones that sneak in on a wild card?',
  headline:
    'Yes, and it is a real, consistent pattern, not noise — teams that go deep, especially on the pitching side, skew older than league average, and the gap roughly triples by the time you reach the World Series. But age stops mattering the moment a team is already IN the tournament, and the single biggest reason to be careful here is that a team already winning in July is exactly the team that goes out and rents a proven veteran at the trade deadline — which raises its own age as a RESULT of being good, not a cause of it.',
  sections: [
    {
      id: 'the-numbers',
      heading: 'How much older, at each stage',
      prose: [
        'Every number below compares a team’s roster age to the REST OF THE LEAGUE that same season, so a 2003 team and a 2023 team are read on the same scale.',
      ],
      table: {
        caption: 'Age above (or below) league average, by how far a team went',
        columns: ['Team went', 'Hitters', 'Pitchers'],
        rows: [
          ['Missed the postseason (516 teams)', '0.18 years younger', '0.26 years younger'],
          ['Made the postseason (234 teams)', '0.37 years older', '0.57 years older'],
          ['Reached the League Championship Series or better (100 teams)', '0.62 years older', '0.86 years older'],
          ['Won the World Series (25 teams)', '0.68 years older', '1.26 years older'],
        ],
      },
      proseAfter: [
        'The pitching gap roughly triples between "made the postseason at all" and "won it all." The hitting gap barely grows past the first cut. Whichever way this cuts, it looks more like a story about pitching staffs than about lineups.',
        'And among teams that already made the postseason, age tells you nothing about who won their division and who came in as a wild card — division winners and wild-card teams are statistically indistinguishable in age, on both sides of the ball. Age looks like it buys a team its ticket in, not what it does once it’s there.',
      ],
    },
    {
      id: 'the-catch',
      heading: 'The most important caveat on this page',
      prose: [
        'A team’s age here is measured across its WHOLE season — including every trade it made. A club that is already winning in July is exactly the club that goes out and adds a 34-year-old proven starter or a veteran bat for the stretch run. That trade makes the team older on paper as a CONSEQUENCE of already being good enough to be a buyer at the deadline — not evidence that the extra years themselves are what won the games.',
        'This spike cannot tell those two stories apart. The fix is straightforward — measure a team’s age as of around June 30, before most trades happen — and it is the single most valuable thing to build next, not a footnote.',
      ],
    },
  ],
  caveats: [
    'This is very likely partly circular — see "the most important caveat" above. Nothing here separates a genuine age effect from contending teams renting veterans at the deadline.',
    'No payroll control exists anywhere in this program yet (that data source is blocked entirely, see the framework entry), and an older roster is a plausible stand-in for a more expensive one.',
    'The "age doesn’t separate division winners from wild cards" result is a real non-effect at the sample available (150 vs. 84 teams) but is not proof of an exact zero at a larger sample.',
    'Nothing here is causal. An older roster may simply mean an organization already had good, established players — age as a symptom of quality, not a cause of it.',
  ],
  open: [
    'A pre-trade-deadline (roughly June 30) age cut, to separate "started the season old" from "got old by adding veterans while already winning."',
    'Whether the effect is really about starting pitchers, relievers, or both — this spike only split hitting vs. pitching, not further.',
    'Everything else on the factor catalog in docs/team-success-research.md — this is one spike of eight questions asked.',
  ],
  technical: [
    'battingAge/pitchingAge: PA-weighted / IP-weighted mean of statsapi\'s per-team-stint `stat.age`, one row per player per team per season (teamId-filtered pull — the unfiltered version of this endpoint collapses a traded player to his final team\'s season total, verified live against a 2023 case). *Relative fields subtract that season\'s own PA/IP-weighted league mean.',
    '750 team-seasons (2000-2025, 2020 excluded). Spearman rho vs. the 0-5 ladder: 0.205 (batting), 0.282 (pitching), 0.289 (combined) — permutation p<0.0002 for all three (5,000 within-season shuffles), same sign in 25/25 leave-one-season-out refits.',
    'Band-difference permutation p-values (within-season shuffle, 5,000 draws): made postseason vs. not, p<0.0002 both sides; LCS+ vs. not, p<0.0002 both sides; WS winner vs. not, p=0.0058 (batting) / p<0.0002 (pitching).',
    'Division winner vs. wild card among the 234 postseason teams: p=0.31 (batting), p=0.49 (pitching) — null.',
    'Including the pandemic-shortened, 16-team 2020 field changes every figure above by 0.01-0.05, no sign flips (sensitivity check in the same script run).',
  ],
}
