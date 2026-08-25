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
    'Four clubs a year are still playing when the Championship Series starts. Look at twenty years of them. Were their farm systems doing anything the other twenty-six were not?',
  headline:
    'One thing, and it is a headcount, not a grade. The clubs that reach a Championship Series raised more big leaguers than everybody else — 26 of them over the previous five years, against 23. The gap is still there after you allow for the plain fact that those clubs won more games first. What does NOT separate them: how good the players turned out to be, or how much of the roster they filled.',
  sections: [
    {
      id: 'setup',
      heading: 'Why ask this when the standings already said no',
      prose: [
        'Start with what was already known. An earlier pass asked whether leaning on your own players wins you more games. Six hundred club-seasons later, the answer was no. The best anyone could say was that the truth sits somewhere between two thirds of a win worse and about two wins better, which is another way of saying nobody can find it. That was a careful study finding a real nothing.',
        'October is a different bar. A club gets to a Championship Series about one year in eight. It is the week a front office\'s whole plan is graded in public. So it is at least possible that a farm system shows up there and never shows up in the standings.',
        'It is also a much smaller pile of seasons, and that belongs in the same breath. Four clubs a year, twenty years, eighty slots in all. Anything built on eighty seasons needs a great deal of checking before a reader should believe it. Most of this entry is that checking.',
      ],
    },
    {
      id: 'the-comparison',
      heading: 'Five things a farm system might be for',
      prose: [
        'Every club-season gets put in line against the other twenty-nine clubs from the same year. That matters. If the whole league starts promoting faster, the line does not move, so a league-wide drift cannot be mistaken for a difference between the clubs that advanced and the clubs that went home. A club at 0.50 is dead average for its year. And 0.50 is exactly what chance looks like.',
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
        note: 'Five farm measures, with winning percentage sitting underneath them as a yardstick. It is in the table to show what a real separation looks like, not because it is something a farm system does. One of the five clears the bar, and it is a headcount.',
      },
      proseAfter: [
        'In plain numbers: 26 men against 23. Three extra big leaguers raised over five years. It does not sound like much. It is the whole finding.',
      ],
    },
    {
      id: 'the-control',
      heading: 'The obvious objection, and it does not hold',
      prose: [
        'Nobody gets to a Championship Series without winning a pile of games first. So anything at all tied to winning is going to look like it predicts October. Fine. Put the club\'s record into the model next to the graduate count and see which one is left standing. The graduate count is. Depending on which version you run, each step up in players raised lifts a club\'s odds of reaching a Championship Series by somewhere between half again and triple.',
        'Then it was rerun thirty more times, each run leaving one club out of the data entirely. It held in twenty-seven of the thirty. The weakest run is the one with Houston removed — nine Championship Series in twenty years off a farm that ranked below the middle of the league — and that is a useful reminder. A rule with a 27-in-30 record is a rule with three exceptions living inside it.',
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
        note: 'Across all thirty clubs, the more players a club raised the more often it reached the last four, and that link is a firm one. Homegrown SHARE tracks about half as closely and could be chance — look at Minnesota, better than half its roster homegrown and not one Championship Series in twenty years, and Colorado at 53 percent with one.',
      },
    },
    {
      id: 'count-not-quality',
      heading: 'Count, not quality — and one number that lies',
      prose: [
        'Now the trap. Once the record is held steady, the VALUE of a club\'s graduates points the other way: a club whose own men were BETTER looks LESS likely to reach a Championship Series. That is not a discovery. It is worth naming out loud anyway, because it is exactly the sort of number that ends up on a broadcast.',
        'Here is why it happens. A club wins because of its young players and because of everybody else, both at once. Freeze the record and you have forced those two to trade off. At the same 90 wins, a club that got a lot out of its rookies must have got less out of the rest of the roster. Take the record back out of the model and the same number goes flat. The minus sign belongs to the bookkeeping, not to baseball.',
        'What is left standing is the plain version. The NUMBER of big leaguers a club raises separates the final four. How good they were does not.',
      ],
    },
    {
      id: 'falsification',
      heading: 'The test that could have killed it',
      prose: [
        'If raising players really helps build an October club, it ought to show up in simply reaching the postseason — the part a club has some say over — and not only in the deep run, which is two rounds of coin flips stacked on top. Had it predicted the deep run and nothing else, the honest reading would be that eighty club-seasons had found a shape in noise.',
        'It shows up in both. The graduate count predicts a postseason berth on its own about as strongly as it predicts a Championship Series.',
        'Which points at the modest version of this finding, and the modest version is the true one. Nothing here says raising players wins pennants. It says raising a lot of big leaguers is a sign of a well-run organization, and well-run organizations reach the final four. That is a smaller claim than a club\'s public-relations department would write. It is the one these numbers will carry.',
      ],
    },
  ],
  caveats: [
    'Eighty club-seasons. Every number in this entry rests on eighty examples of the thing being explained, and that is not many. The leave-one-club-out check exists precisely because a result this size can turn out to be one franchise.',
    'A "graduate" here is a man who reached the majors and stuck, so the measure has already been strained through survival. A club that raises thirty players who all wash out is recorded as raising none of them.',
    'Payroll is missing, and it is the rival explanation with the best claim. A club that raises 26 big leaguers in five years may simply be a club that could not afford to buy any, and there is no historical payroll anywhere in this repo to test that with.',
    'Credit goes to the club a man spent his FIRST professional season with. That is the right rule for who developed him and the wrong one for who got the benefit. A player traded at nineteen counts for the club that signed him and plays October for somebody else.',
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
    'Reading the comparison table: each cell is the mean within-season percentile rank (0–1) of a club-season against the other 29 that year. 0.50 is therefore the no-difference expectation, and the reported gap is the final-four mean against the mean of the other 520 club-seasons. Ranking within season is what absorbs any league-wide drift in the underlying measure.',
    'The graduate-count effect is expressed per standard deviation of that within-season percentile. The prose range "half again to triple" is the OR span 1.41–2.83 across the alone, winning-controlled and full specifications together with the 30 leave-one-out refits; the weakest of those is the Houston-excluded fit (9 Championship Series on a 22.5 graduate count and a 44.9% homegrown share).',
    'The share measure carries counterexamples at both tails that the count measure does not — Minnesota 0 of 20 at a 50.3% homegrown share, Colorado 1 of 20 at roughly 53%, against Houston 9 of 20 at 44.9%. That club-level texture is what sits behind r=0.241 for share versus r=0.481 for count.',
  ],
}
