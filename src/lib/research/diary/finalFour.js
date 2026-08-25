// Diary entry — the postseason version of a question this body of work already
// answered in the standings, and the only entry here that lands on a club-level
// result rather than a player-level one.
//
// It sits deliberately close to the homegrown entry, which found that building
// from within wins no games. The two are not in conflict and the difference
// between them is the point: HOW MANY major leaguers a club raises is not the
// same measure as WHAT FRACTION of its roster they make up, and only the first
// one separates the final four.
export const finalFourEntry = {
  id: 'final-four-farms',
  date: '2026-08-24',
  source: 'PR #891',
  doc: 'docs/prospect-traits.md',
  title: 'What the final four have in common: more players, not better ones',
  verdict: 'holds',
  question:
    'Four clubs a year reach a Championship Series. Looking at twenty years of them, is there anything their farm systems were doing that the other twenty-six were not?',
  headline:
    'One thing, and it is a headcount rather than a quality. Clubs that reach a Championship Series raised more major leaguers than everybody else — a median of 26 over the previous five years against 23. It survives being asked whether they simply won more games first. What does NOT separate them is how good those players were, or what share of the roster they filled.',
  sections: [
    {
      id: 'setup',
      heading: 'Why ask this when the standings already said no',
      prose: [
        'The earlier pass asked whether leaning on your own players wins games and found nothing — six hundred club-seasons, and a range of possibilities running from about two thirds of a win worse to about two wins better. That was a well-built study finding a real nothing.',
        'October is a different bar. A club reaches a Championship Series roughly one season in eight, and October is where a front office’s plan actually gets judged. It is at least possible for a farm system to show up there and nowhere in the standings.',
        'It is also a much smaller sample, and that belongs in the same breath. Four clubs a year, twenty seasons, eighty slots. A finding built on eighty club-seasons needs a great deal of checking before anybody believes it, and most of this entry is that checking.',
      ],
    },
    {
      id: 'the-comparison',
      heading: 'Five things a farm system might be for',
      prose: [
        'Each club-season is ranked against the other twenty-nine that year, so a league-wide drift in any of these cannot be mistaken for a difference between the clubs that advanced and the clubs that did not. A club at 0.50 is average for its year. That is also what chance looks like.',
      ],
      table: {
        caption: 'Where the final four ranked among the thirty, 2004 through 2023',
        columns: ['What was measured', 'The final four', 'Everyone else', 'Could this be chance?'],
        rows: [
          ['Share of the roster they raised themselves', '0.542', '0.494', 'Yes'],
          ['Own graduates reaching the majors that year', '0.513', '0.498', 'Yes'],
          ['Own graduates over the previous five years', '0.599', '0.485', 'No — 13 in 10,000'],
          ['What those graduates were worth', '0.549', '0.492', 'Yes'],
          ['How fast their prospects moved', '0.448', '0.508', 'Yes'],
          ['Winning percentage', '0.853', '0.446', 'No, obviously'],
        ],
        note: 'Five farm measures, and winning percentage underneath them as a yardstick — it is in the table to show what a real separation looks like, not as something a farm system does. One of the five clears the bar, and it is a headcount.',
      },
      proseAfter: [
        'In plain numbers: 26 men against 23. Three extra major leaguers raised over five years — which does not sound like much, and is the entire finding.',
      ],
    },
    {
      id: 'the-control',
      heading: 'The obvious objection, and it does not hold',
      prose: [
        'Nobody reaches a Championship Series without winning a lot of games first. So anything at all tied to winning will look like it predicts October. Put the record into the model and the graduate count is still standing: the odds of reaching a Championship Series rise by somewhere between a half again and triple for each step up in how many players a club raised, depending on which version you run.',
        'Then thirty more refits, each one dropping a different club. It held in twenty-seven. The weakest is what happens when Houston comes out — nine Championship Series in twenty years off a below-median farm — which is a useful reminder that a rule with a 27-in-30 record is a rule with three exceptions living inside it.',
      ],
      table: {
        caption: 'The thirty clubs, sorted by how often they got to the last four',
        columns: ['Club', 'Championship Series', 'Graduates per five years', 'Homegrown share'],
        rows: [
          ['Houston', '9 of 20', '22.5', '44.9%'],
          ['Los Angeles (NL)', '8 of 20', '26.4', '41.1%'],
          ['St. Louis', '8 of 20', '26.1', '49.5%'],
          ['New York (AL)', '7 of 20', '27.1', '39.4%'],
          ['Boston', '6 of 20', '23.4', '34.6%'],
          ['…', '', '', ''],
          ['Cincinnati, Pittsburgh, Seattle, Minnesota, Miami', '0 of 20', '19.9 to 22.3', '30.8% to 50.3%'],
        ],
        note: 'Across all thirty clubs the count of graduates tracks final-four appearances at about r=0.48. Homegrown SHARE tracks them at about half that and could be chance — note Minnesota at better than half the roster and no Championship Series at all, and Colorado at 53 percent with one.',
      },
    },
    {
      id: 'count-not-quality',
      heading: 'Count, not quality — and one number that lies',
      prose: [
        'Value per graduate points the other way once the record is held steady. A club whose own men were BETTER looks LESS likely to reach a Championship Series. That is not a discovery. It is a trap, and it is worth naming, because it is exactly the sort of number that ends up in a broadcast.',
        'Winning is caused by the young players and by everybody else at once. Hold a club’s record fixed and you have forced the two to trade off — at the same record, a club that got a lot out of its rookies must have got less out of the rest of the roster. Take the record back out of the model and the same term is neutral. The negative sign belongs to the control, not to baseball.',
        'What is left standing is the plain version. The NUMBER of major leaguers a club raises separates the final four. How good they were does not.',
      ],
    },
    {
      id: 'falsification',
      heading: 'The test that could have killed it',
      prose: [
        'If raising players really helps build an October team, it ought to show up in simply making the playoffs — the part a club has some control over — and not only in the deep run, which is two rounds of a coin flip stacked on top. Had it predicted the deep run alone, the honest reading would be that eighty club-seasons found a pattern in noise.',
        'It shows up in both. Graduate count predicts a postseason berth on its own about as strongly as it predicts a Championship Series.',
        'Which points at the modest version of this finding, and the modest version is the true one. Nothing here says producing players wins pennants. It says producing a lot of major leaguers is a symptom of a well-run organization, and well-run organizations reach the final four. That is a smaller claim than a club’s public-relations department would write, and it is the one the data will carry.',
      ],
    },
  ],
  caveats: [
    'Eighty club-seasons. Every number in this entry rests on eighty observations of the thing being explained, and that is not many. The leave-one-club-out check exists precisely because a result this size can be one franchise.',
    'A "graduate" here is a man who reached the majors and stuck, so the measure is already filtered through survival. A club that raises thirty players who all wash out registers as raising none of them.',
    'Payroll is missing, and it is the alternative explanation with the best claim. A club that raises 26 major leaguers in five years may simply be a club that could not afford to buy any, and there is no historical payroll anywhere in this repo to test that with.',
    'Credit goes to the club a man spent his FIRST professional season with, which is the right rule for who developed him and the wrong one for who benefited. A player traded at nineteen counts for the club that signed him and plays October for somebody else.',
  ],
  open: [
    'Whether the same holds for the World Series rather than the Championship Series is not answered — twenty champions is too few to ask. The more promising direction is the reverse of this entry: not what the final four had, but what the five clubs with none in twenty years were missing.',
  ],
  technical: [
    '600 club-seasons, 2004–2023, from the homegrown panel; 80 reached a Championship Series, 194 reached the postseason. Postseason participation from public/data/postseason-history.json. Measures compared as within-season percentiles across the thirty clubs.',
    'Graduates, trailing 5 years: final four 0.599 vs 0.485 (p=0.0013); median 26 vs 23. Homegrown share 0.542 vs 0.494 (p=0.17); promotion speed 0.448 vs 0.508 (p=0.088).',
    'Logistic on reaching a Championship Series with season fixed effects: graduates OR 2.25/SD alone (p=0.0004), 1.86 with winning controlled (p=0.024), 2.83 in the full model (p=0.001). Leave-one-club-out across 30 refits: OR 1.41–2.28, p<0.05 in 27 of 30.',
    'WAR per graduate: OR 0.42 (p=0.001) with winning controlled, OR 1.09 (p=0.70) without — a collider induced by conditioning on the outcome both terms cause.',
    'Falsification: reaching the postseason ~ graduates gives OR 1.67 (p=0.002). Across the 30 clubs, final-four count vs graduates r=0.481 (p=0.007), vs homegrown share r=0.241 (p=0.20).',
  ],
}
