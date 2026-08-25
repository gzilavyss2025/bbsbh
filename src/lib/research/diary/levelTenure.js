// Diary entry — the level-tenure benchmark. The first of the four prospect
// spikes, and the only one that shipped a feature.
//
// The numbers here are a FROZEN SNAPSHOT of what the research said the day it
// landed, not a live read of public/data/level-tenure-benchmark.json. That is
// deliberate. The shipped generator recomputes its own sliding five-year cohort
// from statsapi, so a live read would quietly rewrite history every time the
// nightly data refreshed, and a diary whose past entries move is not a diary.
// When the generator's numbers drift far enough to matter, that is a NEW entry,
// not an edit to this one.
export const levelTenureEntry = {
  id: 'level-tenure-benchmark',
  date: '2026-08-24',
  source: 'PR #880',
  doc: 'docs/level-tenure-benchmark.md',
  title: 'How long is a normal stay in the minors?',
  verdict: 'shipped',
  question:
    'Your club\'s best prospect got to Double-A in April. It is August and he is still there. Is that a long time, or is that just what Double-A takes?',
  headline:
    'Nobody had ever written the answer down. What you can find is either one lump number for a whole career, or a thin slice of first-round high-school hitters. Pitchers were not in any of it. So it got built from scratch: 881 players, every big-league debut from 2019 through 2023, with a line for every rung of the ladder each man climbed.',
  sections: [
    {
      id: 'cohort',
      heading: 'Who counts as a prospect who made it',
      prose: [
        'Everybody who debuted between 2019 and 2023 and then actually stuck — 130 at-bats or 50 innings in the majors, career. The app already drew that line somewhere else, and reusing it keeps the September cup of coffee out of the study. A man who got two pinch-hit at-bats in a lost year did not graduate. Count him and every stay in the minors would look shorter than it really is.',
        'The five-year window is a compromise, and it is worth saying so out loud. Reach back to 2015 and you get about 1,600 players — and a minor-league system that no longer exists, because the 2021 reorganization shut forty affiliates. Start at 2021 and the pandemic stops being a problem, but you are down to 500 players and the numbers start jumping around. 2019 through 2023 is recent enough to describe how clubs work now and big enough to trust.',
        'Rookie and complex ball is left out, the same call the Farm Index already makes. Those seasons are short, the leagues get rebuilt every year, and what looks like a pattern down there is usually a handful of players dressed up as one.',
      ],
    },
    {
      id: 'numbers',
      heading: 'What a normal stay looks like',
      prose: [
        'This is the playing time a man got at a level before he moved up, and only the first time through. If he came back down later on an option or a rehab stint, that time is not added on.',
      ],
      table: {
        caption: 'A typical stay, and the normal range around it',
        columns: ['Level', 'Hitters — plate appearances', 'Pitchers — innings'],
        rows: [
          ['Single-A', '332  (207 to 495)', '58.8  (30.4 to 96.8)'],
          ['High-A', '350  (228 to 473)', '59.3  (35.7 to 93.0)'],
          ['Double-A', '410  (267 to 553)', '68.3  (36.3 to 105.3)'],
          ['Triple-A', '327  (180 to 529)', '54.0  (26.3 to 88.8)'],
        ],
        note: 'The middle number is the typical stay. The range in parentheses covers the middle half of players — a quarter finished faster, a quarter took longer. Between 318 and 437 players in each box.',
      },
      proseAfter: [
        'Double-A is the long stop, and the numbers say what scouts have always said about it. A hitter spends the better part of a full season there and gets more trips to the plate than at any other rung, because Double-A is where a club finds out whether a prospect can hit.',
        'Triple-A is the shortest stay of the four and by some distance the widest. Some men pass through in six weeks. Others sit there the better part of two years — and the honest reading of that is that a Triple-A stay is often not about the player at all. It is about whether there is a job open above him.',
      ],
    },
    {
      id: 'ordering',
      heading: 'The messy part, and why the numbers survived it',
      prose: [
        'Before you can say how long a man stayed somewhere, you have to know the order he went in. Usually that is obvious. Sometimes it is not. 240 of the 881, better than one in four, spent at least one season bouncing between two levels more than once. That is mostly forty-man churn — a Triple-A arm shuttled up and down as emergency depth — and the season record does not say which stint came first.',
        'The transaction log settles most of them, and where it does, it backs the up-the-ladder assumption about seven times in ten. But the test that matters is the blunt one. Throw all 240 of those players out and run the whole thing again. Every level\'s typical stay moves by single digits. Whatever is going on underneath, it is not moving the answer.',
      ],
    },
    {
      id: 'folklore',
      heading: 'Two things everybody says that turn out not to be true',
      points: [
        'There is no All-Star-break bump. The two weeks after the break promote players at about the same rate as the two weeks before it. Clubs are not saving up call-ups for the second half. It only feels that way because the second half is when you start paying attention.',
        'And there is no "give him a full year there" rule either. Only 7 to 15 percent of stays land anywhere near a calendar year. If clubs are working off a schedule, it is not that one.',
      ],
    },
  ],
  caveats: [
    'The first level a player reaches has no arrival date anywhere in the feed. He simply turns up in a box score one day in April. Dating it would mean rebuilding extended spring training from scratch, and no public source covers that.',
    'Where a man was drafted matters — first-round bats need fewer trips to the plate at every level, high-school picks need far more low-minors time than college bats — but it did not ship. A quarter of these players have no draft record at all, because they signed as international free agents, and right now that group sits in the same box as a handful of veterans who came over from Japan. Two very different groups, one box.',
    'There is no historical top-100 prospect list to build pedigree from. This app started keeping its own weekly snapshot on 2026-07-07, which is no use at all for a player drafted in 2013. Keep that snapshot running anyway. In a few years it is an archive nothing else can replace.',
  ],
  open: [
    'Busts — the players who never made it — are a harder study and an unbuilt one. There is no clean signal for when a career ended. A man released at 25 and a man still grinding at 25 look identical in the data.',
  ],
  technical: [
    'Cohort: 881 players, MLB debuts 2019–2023, filtered on the existing 130 AB / 50 IP rookie threshold. Levels are sportIds 11–14; sportId 16 excluded.',
    'Per-level accumulation reconstructed from yearByYear hitting/pitching splits, sorted chronologically, same-season ties broken by ascending level rank. 240 of 881 players have at least one ambiguous season (63% involve Triple-A); the wire confirms the ascending assumption in 71% of resolvable cases; dropping all 240 moves every level median by single digits.',
    'Shipped as scripts/gen-level-tenure-benchmark.mjs → public/data/level-tenure-benchmark.json → src/api/levelTenure.js, surfaced on the prospect card.',
    'Table values are medians with the interquartile range (p25–p75) in parentheses. Per-level cell counts run 318–437.',
    'Windows considered and rejected: 2015–2023 gives n≈1,600 but straddles the 2021 affiliate reorganization (forty clubs eliminated); 2021–2023 clears the COVID-affected seasons but falls to n≈500, at which point the per-level medians become unstable.',
    'Folklore tests: promotion rate in the 14 days after the All-Star break is indistinguishable from the 14 days before. Calendar-year heuristic: only 7–15% of level stays, depending on level, fall near a 365-day span.',
  ],
}
