// Diary entry — size, handedness, velocity and pitch mix against the length of
// a man's stay in the minors. Two questions were commissioned separately and
// they are answered together here, because the answer to the first one is the
// second one: size does nothing to a hitter's timetable and everything it does
// do belongs to pitchers.
//
// The entry also carries the clearest statement of an instrumentation limit
// this research has run into. There is no pitch-tracking data below Triple-A
// and there never has been, so the honest answer about velocity in the minors
// is that it cannot be measured, and what is reported instead is a proxy with
// its direction problem stated in the open.
export const bodyAndArmEntry = {
  id: 'body-and-arm',
  date: '2026-08-24',
  source: 'PR #891',
  doc: 'docs/prospect-traits.md',
  title: 'Big, small, left-handed, hard-throwing: what actually moves the clock',
  verdict: 'holds',
  question:
    'Does a player’s size change how long he sits in the minors — being unusually big, or unusually small? And for pitchers, does throwing left-handed, throwing hard, or throwing five different pitches get you there sooner?',
  headline:
    'For hitters, size does nothing. For pitchers it does, and not in a straight line — the unusually light and the unusually heavy both wait longer than the men in the middle, about a third of a season for the outliers. Velocity does not buy calendar time. It buys innings: the hardest throwers need a hundred fewer of them to convince a club. And pitch mix, once you know whether a man starts or relieves, is worth nothing at all.',
  sections: [
    {
      id: 'the-shape',
      heading: 'The question was about the tails, so the tails are what got tested',
      prose: [
        '"Above or below the average" is a different question from "does bigger help". It asks whether being unusual in either direction costs a man time — a club slower to trust the 5-foot-8 second baseman, and slower to sort out the 6-foot-7 arm. That shape is a U, and the usual way of asking cannot see a U. So every measure here was run three ways: does bigger move faster, does the middle move fastest, and does being unusual either way cost time.',
        'Size is measured against the average for the man’s own position, not the league. A 6-foot-4 pitcher is ordinary; a 6-foot-4 second baseman is not. Skip that step and you are not measuring size, you are measuring position.',
      ],
      table: {
        caption: 'Seasons from the first professional season to the debut, by weight',
        columns: ['How far from the average for his position', 'Players', 'Seasons in the minors'],
        rows: [
          ['More than 1.5 below', '176', '4.43'],
          ['0.5 to 1.5 below', '674', '4.28'],
          ['Within half a step of average', '1,346', '4.02'],
          ['0.5 to 1.5 above', '610', '4.20'],
          ['More than 1.5 above', '217', '4.37'],
        ],
        note: 'Both ends slower, the middle fastest. The identical table built on HEIGHT is flat — 4.18, 4.23, 4.17, 4.08, 4.20 — so this is mass, not stature.',
      },
    },
    {
      id: 'pitchers-only',
      heading: 'And it belongs entirely to the pitchers',
      prose: [
        'Split the same test by position group and there is no ambiguity about where the U lives.',
      ],
      table: {
        caption: 'The extra time an unusual weight costs, by who is being measured',
        columns: ['Group', 'Extra seasons', 'Could this be chance?'],
        rows: [
          ['Everybody', '0.17', 'No — 7 in 10,000'],
          ['Everybody except pitchers', '0.09', 'Yes'],
          ['Pitchers alone', '0.26', 'No — 3 in 10,000'],
          ['Catchers alone', '0.11', 'Yes'],
          ['Middle infield and centre field', '0.11', 'Yes'],
          ['Corner positions', '0.07', 'Yes'],
        ],
      },
      proseAfter: [
        'Pitchers in five groups, lightest to heaviest: 4.28 seasons, 3.86, 3.96, 4.11, 4.43. Around 205 pounds is the fast lane. Either side of it is the slow one.',
        'One thing here should worry a reader, and it is not the arithmetic. The whole effect sits in the last six years. Split the twenty seasons in three and only 2018 through 2023 carries it clearly. The two earlier stretches lean the same way and could both be chance. So either something changed in how clubs handle an unusual body, or a third of the data found a pattern the other two thirds do not have.',
      ],
    },
    {
      id: 'velocity',
      heading: 'Velocity buys innings, not summers',
      prose: [
        'One thing has to come first. There is no pitch tracking below Triple-A and there never has been — Double-A and everything under it hold no record of what anybody threw. Nobody can measure what a prospect’s fastball was doing at Double-A in 2014, and nobody ever will.',
        'What can be measured is what he threw once he got to the majors. That is a reading taken after the event it is meant to explain, which is why this half of the entry describes a pattern and never claims a cause. With that said, the pattern is one of the cleanest in all of this work.',
      ],
      table: {
        caption: 'Pitchers by fastball, softest to hardest, against their time in the minors',
        columns: ['Where his fastball ranked', 'Fastball', 'Age entering pro ball', 'Minor-league innings', 'Age at debut'],
        rows: [
          ['Softest tenth', '87.9', '21.5', '318', '25.4'],
          ['Below average', '90.5', '21.0', '343', '25.0'],
          ['Average', '93.0', '21.0', '277', '24.7'],
          ['Above average', '94.9', '21.0', '230', '24.2'],
          ['Hardest tenth', '97.1', '20.0', '200', '23.9'],
        ],
        note: 'Velocities are compared within each season, because the league fastball went from 91.0 in 2008 to 94.2 in 2024 and an uncorrected number would mostly be measuring the calendar.',
      },
      proseAfter: [
        'Innings fall by a third down that table. Debut age falls by a year and a half. But the number of SUMMERS a man spends in the minors barely moves at all, and the hardest throwers actually spend a few more.',
        'The reason is in the third column. They sign younger. Nearly half of the hardest-throwing tenth turned professional at nineteen or under, and 44 percent never went through a draft at all — they were sixteen-year-olds in the Dominican Republic. Same number of summers, far fewer innings, and they arrive a year ahead of everybody else.',
        'Which is the more useful way to put it. Hard throwers do not get fewer summers. They get less work inside them.',
      ],
    },
    {
      id: 'handedness',
      heading: 'The left-hander’s advantage is real and it is invisible until you correct for something',
      prose: [
        'Left-handers are 27 percent of the pitchers here. Line them up against right-handers and they reach the majors at the same pace. No difference worth the name.',
        'But they throw 1.7 miles an hour slower, and that is an enormous gap — about two thirds of the entire spread between pitchers. So the plain comparison is rigged. It sets men who throw 91.7 against men who throw 93.4, finds they arrive together, and calls it a tie. After the table above, that is already the answer. Something is carrying the left-hander.',
        'Hold velocity and role steady and the something shows up: a quarter of a season sooner, for the same stuff. It is the oldest cliché in scouting and it is sitting in the data. A club will wait on a left-hander it would have given up on if he threw with the other arm.',
      ],
    },
    {
      id: 'mix',
      heading: 'Pitch mix: nothing',
      prose: [
        'How many pitches a man throws, how much he leans on the breaking ball, how much on the changeup — none of it survives once you know whether he starts or relieves. Repertoire looks like it matters on its own. Then it turns out that starters throw four pitches and relievers throw two, and that was the whole finding.',
        'The one result worth keeping from this half is a negative, and it cost real work. The weight U-shape above is not about stuff. Put velocity into that model and the U does not move a hair. Whatever makes a club slower with an unusually built pitcher, it is not that he throws softer.',
      ],
    },
  ],
  caveats: [
    'The weight is a CURRENT listing, not a measurement taken while the man was a prospect. For anyone who retired ten years ago it is his last listed number, and listed weights are rounded, stale, and sometimes flattering. Height barely moves after eighteen; weight does. This is the largest single problem with the finding and it cannot be fixed from inside this data.',
    'The pitcher U-shape is carried by the most recent third of the window. That is either a change in the sport or a coincidence, and this study cannot tell which.',
    'Velocity and pitch mix are measured in the major leagues, AFTER the promotions being explained. A pitcher who added two miles an hour on a big-league strength programme, or lost them to an elbow, is recorded at the wrong number.',
    'Everybody here reached the majors. The unusually small pitcher who never got a look is not in this data, and a club’s reluctance to promote him would show up as him being absent rather than as him being slow.',
  ],
  open: [
    'Why an unusual build should slow a pitcher down is not answered here, and the two obvious explanations point in opposite directions. Either clubs are genuinely slower to trust a body that does not look like the others, or an unusual body is a signal of something real — a delivery that needs more work, a frame that needs filling out — and the extra time is well spent. Nothing in this data separates those.',
  ],
  technical: [
    'Cohort: 3,023 of the 3,060 with a listed height, weight and a wire-free clock. Size standardized within position group (P / C / middle / corner). Outcome: seasons from first professional season to debut, with draft-tier, position and era controls.',
    'Weight |z|: +0.174 seasons per SD (p=0.0007). Quadratic +0.069 (p=0.001) with the linear term at nothing — a symmetric U. Height linear +0.069 (p=0.034), no U. Same models on log(total minor-league playing time) agree; the wire-dated days agree in sign and are not significant.',
    'Leave-one-group-out: dropping pitchers takes |zWeight| to 0.085 (p=0.24); pitchers alone give 0.257 (p=0.0003). Era split: 0.115 / 0.076 / 0.308 for 2005–2011, 2012–2017, 2018–2023.',
    'Velocity: primary fastball average speed from /api/v1/people/{id}/stats?stats=pitchArsenal in the rookie season, standardized within season (SD ≈ 2.55 mph). −12.9% of minor-league innings per SD (p<0.0001); −0.40 years of debut age per SD (p<0.0001); seasons-to-debut −0.14 with role controlled (p=0.004).',
    'Handedness: 443 L / 1,223 R. Median fastball 91.7 vs 93.4. Lefty term −0.108 seasons alone (p=0.29), −0.224 (p=0.042) with velocity, mix and role in the model.',
    'Mix: repertoire, breaking share and offspeed share all fail with role controlled (p=0.54, 0.80, 0.11). |zWeight| moves 0.162 → 0.161 when velocity is added on the identical subset.',
  ],
}
