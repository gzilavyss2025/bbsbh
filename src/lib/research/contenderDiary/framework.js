// Diary entry #1 — sets up the notebook rather than reporting a finding.
// Verdict 'framework' (see index.js) is for exactly this: nothing here was
// measured against a team yet, so every sentence below is a plan, not a
// result. Full method: docs/team-success-research.md.
export const frameworkEntry = {
  id: 'framework-v1',
  date: '2026-08-25',
  source: 'Program kickoff',
  doc: 'docs/team-success-research.md',
  title: 'What "team success" means here, and what is still to check',
  verdict: 'framework',
  question:
    'A club makes the postseason. Or it wins its division. Or it wins a round. Or it reaches its league\'s Championship Series. Or it reaches the World Series. Or it wins the whole thing. What actually separates the teams that go far from the teams that go home early — money, how the roster was built, trades, injuries, star power, or the ages of the players?',
  headline:
    'Six ways of asking "how good was that season" fold into one ladder, because five of them stack on top of each other. Only winning the division sits off to the side. The ladder is built and saved for all 780 team-seasons from 2000 through 2025. Nothing has been measured against it yet. This page is the plan, not a result.',
  sections: [
    {
      id: 'the-ladder',
      heading: 'How far a team got, as one number',
      prose: [
        'Think about the 2015 Royals. To win the World Series, they first had to get there. To get there, they had to win the American League Championship Series. To play in that, they had to win a round. To win a round, they had to make the postseason at all. Each step sits on top of the one below it, like rungs on a ladder. So every team-season since 2000 gets one number, 0 through 5, for how high it climbed.',
      ],
      table: {
        caption: 'The ladder',
        columns: ['Rung', 'Means'],
        rows: [
          ['0', 'Did not make the postseason'],
          ['1', 'Made the postseason, lost its first series'],
          ['2', 'Won at least one round, did not reach the League Championship Series'],
          ['3', 'Reached the League Championship Series, lost it'],
          ['4', 'Reached the World Series, lost it'],
          ['5', 'Won the World Series'],
        ],
      },
      proseAfter: [
        'Winning the division is NOT a rung, and that is on purpose. A wild-card team has out-lasted a division winner plenty of times — the 2014 Royals did it, the 2002 Angels did it. So winning the division is kept beside the ladder as its own yes-or-no fact instead of being squeezed into it.',
      ],
    },
    {
      id: 'catalog',
      heading: 'What the plan covers, and what is already blocked',
      prose: [
        'Eight things were on the list to look at: how a manager fills out a roster for the moment, how the roster was built, trades and other pickups, payroll once you adjust for the era, injuries, whether the talent is bunched in a couple of stars or spread around, whether the best players came up through the farm system or arrived from somewhere else, and how old the roster is. None of the eight has been held up against the ladder yet. One of the eight already ran into a wall, and it is worth saying so right at the top.',
      ],
      table: {
        caption: 'Where each question stands',
        columns: ['Question', 'Status'],
        rows: [
          ['Age of the roster', 'Not started — planned first, cleanest data path'],
          ['Where the best players came from (homegrown vs. acquired)', 'Not started — reuses a sorter already built for the prospect research'],
          ['How spread out the star talent is', 'Not started — data already on hand, needs assembling'],
          ['Trades / player acquisition', 'Not started — two data sources need lining up first'],
          ['Injuries', 'Not started — needs a new sweep of transaction records'],
          ['Situational rosters / roster construction', 'Not started — richest data, least obvious single number'],
          ['Payroll, adjusted for the era', 'Blocked. This app keeps only today\'s payroll, never a history of it, and there is no way to rebuild what teams paid in 2007 from anything on hand. Parked until a historical source turns up — no stand-in number will be swapped in for it'],
        ],
      },
    },
  ],
  caveats: [
    'Nothing on this page is a finding. It is a plan. The order it proposes is a guess about which question is easiest to answer first, not a claim about which one matters most.',
    'The ladder counts 26 World Series winners across the whole window. Any question that cuts all the way down to the champions alone is working with a very small pile of teams — see the standing notes above the entries.',
    'Payroll, one of the eight questions asked at the start, cannot be answered with what this app has on hand. It is on hold until that changes.',
  ],
  open: [
    'Which of the seven open questions to run first, once age-of-roster proves the pipeline end to end.',
    'Whether a historical payroll source can be found at all.',
    'Whether the ladder needs a same-shape sibling for something other than "how far in the bracket" — say, how lopsided the games actually were — once the first few spikes are in.',
  ],
  technical: [
    'Outcome variable: ordinal, 6 levels (0-5), 780 team-season observations (30 teams × 26 seasons, 2000-2025). Built from public/data/postseason-history.json alone; wonDivision is seed ≤ 3 within that same file, verified format-independent across all three bracket eras in the window.',
    'Planned model family: ordered logistic/probit against the ladder, plain logistic against wonDivision, with a 3-level era dummy (pre-2012 / 2012-2021 wildcard-game / 2022+) and 2020 either excluded or given its own dummy per spike.',
    'Reader-facing glossary for this entry: "the ladder" is the 6-level ordinal outcome; "rung" is an ordinal level; "kept beside the ladder as its own yes-or-no fact" means wonDivision is carried as a separate binary outcome rather than folded into the ordinal scale, because the ordering assumption fails for it (wild-card clubs have out-climbed division winners within the same season).',
    'Sample-thinness note carried in the caveats: the top rung holds 26 of the 780 team-seasons (3.3%), so any band-difference test that isolates champions is underpowered by construction, independent of which factor is being tested.',
  ],
}
