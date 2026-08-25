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
    'A club makes the postseason, or wins its division, or wins a round, or reaches its league’s Championship Series, or reaches the World Series, or wins the World Series. What, across payroll, roster construction, trades, injuries, star power, and roster age, actually separates the teams that go far from the teams that don’t?',
  headline:
    'Six questions collapse into one ladder, because five of them nest inside each other and one doesn’t. The ladder itself is built and checked in for all 780 team-seasons from 2000 to 2025. Nothing has been measured against it yet — this entry is the plan, not a result.',
  sections: [
    {
      id: 'the-ladder',
      heading: 'How far a team got, as one number',
      prose: [
        'Winning the World Series implies reaching it. Reaching it implies reaching the League Championship Series. Reaching that implies winning at least one round. Winning a round implies making the postseason at all. That chain is a ladder, 0 through 5, and every team-season since 2000 has a rung.',
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
        'Winning the division is NOT one of these rungs, on purpose. A wild-card team has out-lasted a division winner before — the 2014 Royals, the 2002 Angels — so it is kept as its own yes/no fact next to the ladder rather than folded into it.',
      ],
    },
    {
      id: 'catalog',
      heading: 'What the plan covers, and what is already blocked',
      prose: [
        'Eight things were asked about: situational rosters, roster construction, trades and acquisitions, adjusted payroll, injuries, how spread out a roster’s star talent is, whether the core players came up through the org or were acquired, and roster age. None of the eight has been checked against the ladder yet. One of the eight already hit a wall worth stating up front.',
      ],
      table: {
        caption: 'Where each question stands',
        columns: ['Question', 'Status'],
        rows: [
          ['Age of the roster', 'Not started — planned first, cleanest data path'],
          ['Where the best players came from (homegrown vs. acquired)', 'Not started — reuses a classifier already built for the prospect research'],
          ['How spread out the star talent is', 'Not started — data already on hand, needs assembling'],
          ['Trades / player acquisition', 'Not started — two data sources need reconciling first'],
          ['Injuries', 'Not started — needs a new sweep of transaction records'],
          ['Situational rosters / roster construction', 'Not started — richest data, least obvious single number'],
          ['Payroll, adjusted for the era', 'Blocked. This app keeps only a current snapshot of payroll, never a history of it, and there is no way to reconstruct 2007’s payrolls from anything on hand. Parked until a historical source turns up — no substitute number will stand in for it'],
        ],
      },
    },
  ],
  caveats: [
    'Nothing in this entry is a finding. It is a plan, and the order it proposes is a guess about which question is cheapest to answer first, not a claim about which one matters most.',
    'The ladder counts 26 World Series winners across the whole window. Any question that slices all the way down to the champions alone is a very small sample — see the standing notes above the entries.',
    'Payroll, one of the eight original questions, cannot be answered with what this app already has on hand and is on hold until that changes.',
  ],
  open: [
    'Which of the seven open questions to run first, once age-of-roster proves the pipeline end to end.',
    'Whether a historical payroll source can be found at all.',
    'Whether the ladder needs a same-shape sibling for something other than "how far in the bracket" — e.g. margin of victory in the games actually played — once the first few spikes are in.',
  ],
  technical: [
    'Outcome variable: ordinal, 6 levels (0-5), 780 team-season observations (30 teams × 26 seasons, 2000-2025). Built from public/data/postseason-history.json alone; wonDivision is seed ≤ 3 within that same file, verified format-independent across all three bracket eras in the window.',
    'Planned model family: ordered logistic/probit against the ladder, plain logistic against wonDivision, with a 3-level era dummy (pre-2012 / 2012-2021 wildcard-game / 2022+) and 2020 either excluded or given its own dummy per spike.',
  ],
}
