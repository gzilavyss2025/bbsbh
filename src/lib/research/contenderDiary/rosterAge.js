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
    'Set against the rest of the league that same year, does a team with an older roster go further in the postseason? And does age tell the division winners apart from the clubs that sneak in on a wild card?',
  headline:
    'Yes, and this one is not a fluke. The teams that go deep run older than the rest of the league, and the gap is widest on the pitching staff — by the time you get to World Series winners it is roughly three times what it was at the door. But age stops mattering the moment a club is already in the tournament. And here is the thing to be careful about: a team that is already winning in July is exactly the team that goes out and rents a proven veteran at the trade deadline. That makes the roster older BECAUSE the team was good, not the other way around.',
  sections: [
    {
      id: 'the-numbers',
      heading: 'How much older, at each stage',
      prose: [
        'Every number below is measured against the REST OF THE LEAGUE that same season. That way a 2003 club and a 2023 club are read on the same scale, even though the league itself got younger or older in between.',
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
        'Follow the pitching column down. The gap grows from about half a year to more than a full year between "got in" and "won it all." The hitting column barely budges after the first step. However this ends up being explained, it reads more like a story about pitching staffs than about lineups.',
        'And once a club is in the bracket, age stops telling you anything. Division winners and wild-card teams are the same age, near enough that nothing separates them, on both sides of the ball. Age looks like it buys the ticket in. It does not seem to matter after that.',
      ],
    },
    {
      id: 'the-catch',
      heading: 'The most important caveat on this page',
      prose: [
        'A team\'s age here is counted across its WHOLE season — every trade included. A club sitting in first place in July is exactly the club that goes and adds a 34-year-old starter or a veteran bat for the stretch run. That trade makes the roster older on paper BECAUSE the team was already good enough to be a buyer at the deadline. It is not evidence that the extra years are what won the games.',
        'This spike cannot tell those two stories apart. The fix is simple enough — measure a team\'s age as of around June 30, before most trades happen — and it is the most valuable thing to build next, not a footnote.',
      ],
    },
  ],
  caveats: [
    'This is very likely at least partly circular — see "the most important caveat" above. Nothing here separates a genuine age effect from contenders renting veterans at the deadline.',
    'There is no way to account for payroll anywhere in this program yet (that data is blocked entirely, see the framework entry), and an older roster is a fair stand-in for a more expensive one.',
    'The "age does not separate division winners from wild cards" result is a real nothing at the sample on hand (150 clubs against 84), but it is not proof of an exact zero. A bigger pile of teams could still turn up a small gap.',
    'Nothing here says one thing caused the other. An older roster may simply mean an organization already had good, established players — age as a symptom of quality, not the cause of it.',
  ],
  open: [
    'A pre-trade-deadline (roughly June 30) age cut, to separate "started the season old" from "got old by adding veterans while already winning."',
    'Whether the effect is really about starting pitchers, relievers, or both — this spike only split hitting from pitching, not further.',
    'Everything else on the factor catalog in docs/team-success-research.md — this is one spike of eight questions asked.',
  ],
  technical: [
    'battingAge/pitchingAge: PA-weighted / IP-weighted mean of statsapi\'s per-team-stint `stat.age`, one row per player per team per season (teamId-filtered pull — the unfiltered version of this endpoint collapses a traded player to his final team\'s season total, verified live against a 2023 case). *Relative fields subtract that season\'s own PA/IP-weighted league mean.',
    '750 team-seasons (2000-2025, 2020 excluded). Spearman rho vs. the 0-5 ladder: 0.205 (batting), 0.282 (pitching), 0.289 (combined) — permutation p<0.0002 for all three (5,000 within-season shuffles), same sign in 25/25 leave-one-season-out refits.',
    'Band-difference permutation p-values (within-season shuffle, 5,000 draws): made postseason vs. not, p<0.0002 both sides; LCS+ vs. not, p<0.0002 both sides; WS winner vs. not, p=0.0058 (batting) / p<0.0002 (pitching).',
    'Division winner vs. wild card among the 234 postseason teams: p=0.31 (batting), p=0.49 (pitching) — null.',
    'Including the pandemic-shortened, 16-team 2020 field changes every figure above by 0.01-0.05, no sign flips (sensitivity check in the same script run).',
    'Band sizes behind the table, as reported in prose: 516 missed / 234 made / 100 LCS-or-better / 25 champions. The division-winner cut splits those 234 into 150 division winners and 84 wild-card clubs — the sample behind the "real nothing, not an exact zero" caveat.',
    'Deadline-acquisition circularity is not modeled here at all — no instrument, no pre/post-deadline split, no control for July win percentage. The proposed June 30 cut is the identification fix, and until it exists the reported association should be read as descriptive.',
  ],
}
