// Diary entry — the newest of the four, and the only one that finds a real
// club-level signal in this whole body of work.
//
// The distinction it turns on is worth keeping straight when reading the
// entries below it: the earlier work asked whether the club's NAME predicts
// promotion speed and answered no. This asks whether something a club DOES,
// which changes from year to year, predicts it — and answers yes. Those are
// not the same question, and the second one being yes does not undo the first.
export const homegrownEntry = {
  id: 'homegrown-dependence',
  date: '2026-08-24',
  source: 'PR #886',
  doc: 'docs/homegrown-dependence.md',
  title: 'Clubs that lean on their own players promote slower',
  verdict: 'holds',
  question:
    'Some clubs fill the big-league roster with players they raised. Others buy and trade for them. Does that change how fast prospects move through the farm — and does either way win more games?',
  headline:
    'The more a club leaned on its own homegrown players last season, the longer its prospects wait at every rung this season. About a month longer at Double-A. It is a real pattern and it survived every attempt to break it — and it wins the club nothing at all.',
  sections: [
    {
      id: 'measure',
      heading: 'What "homegrown" means here',
      prose: [
        'A sixteen-year-old signs out of Santo Domingo. He was never drafted, because nobody drafts him. Five years later he is a big-league regular. Is he homegrown?',
        'He is, and that answer decides the whole study. A player belongs to the club he started with — whoever had him for his first professional season in the minors. Not whoever drafted him.',
        'That sounds like hair-splitting and it is not. A quarter of the players here were never drafted at all. They signed at sixteen out of the Dominican Republic or Venezuela. Build the rule on the draft and you throw every one of them out, and they are a quarter of the sport. Starting from the first professional season counts an international signing the same way it counts a first-round pick. That is right, because they are the same thing: a kid the club got in the door and taught.',
        'The rule works for 99 percent of players. Where a draft record does exist too, the two rules agree 98 percent of the time. Most of the handful that disagree are not mistakes at all. They are Rule 5 picks — players who were already professionals when somebody else selected them.',
      ],
    },
    {
      id: 'the-finding',
      heading: 'The finding',
      prose: [
        'In the seasons where a club\'s big-league roster carried more of its own players than that club normally carries, its prospects spent longer at every level the year after.',
        'Comparing a club to itself is the whole trick, and it is worth a sentence. Set the Rays against the Rockies and you have also set a dome against a mile of altitude, one payroll against another, one farm against another. Set the 2016 Rays against the 2019 Rays and all of that holds still. One thing moves.',
      ],
      table: {
        caption: 'What a ten-point rise in homegrown share costs a prospect',
        columns: ['Level', 'Typical stay', 'Added wait'],
        rows: [
          ['High-A', '301 days', 'about 28 days'],
          ['Double-A', '342 days', 'about 32 days'],
          ['Triple-A', '214 days', 'about 20 days'],
        ],
        note: 'Ten points of share is roughly the gap between a club filling a third of its big-league playing time with its own players and one filling closer to half.',
      },
      proseAfter: [
        'It bites hardest in the low minors and eases off as players climb, which is at least a story that makes sense: the traffic jam is worst where the line is longest.',
      ],
    },
    {
      id: 'breaking-it',
      heading: 'Three ways we tried to break it, and did not',
      points: [
        'Maybe it is just the calendar. Both things drift over twenty years, and two things that drift together will look joined at the hip whether they are or not. So the test was rerun asking a narrower question: did a club pull away from its own average in a year when the rest of the league did not? The pattern got slightly stronger.',
        'Maybe it is one club. Thirty clubs is not many, and a result resting on the Rays alone is not a result. So it was rerun thirty times, dropping a different club each time. It held all thirty times, and the size of the effect only wandered between 9 and 13 percent.',
        'Maybe it is chance. The seasons were shuffled inside each club — same clubs, same seasons, same numbers, just deliberately mismatched — and the whole thing rerun 500 times to see how often pure coincidence throws up something this strong. Once. Out of 500.',
      ],
    },
    {
      id: 'how-much',
      heading: 'And now the deflating part',
      prose: [
        'Everything above is real. It is also close to useless for guessing about any one player. Knowing a club\'s homegrown share improves your guess about how long a given prospect will sit by less than half of one percent.',
        'Those two things belong in the same breath, and neither cancels the other. This is what almost every finding in player development looks like once you get close to it. The pattern is real at the level of thirty clubs over twenty years. At the level of the kid you are watching tonight, the noise from one player to the next swallows it whole. Both readings are correct. Only one of them is any use at the ballpark.',
      ],
    },
    {
      id: 'winning',
      heading: 'Does building from within win games? No.',
      prose: [
        'This is the question everybody actually cares about, and it is the one this data answers best. Six hundred club-seasons, and an outcome — wins — that owes nothing to the transaction log, so none of the measurement trouble that dogs the rest of this work can reach it. When a study built this well finds nothing, the nothing means something.',
      ],
      table: {
        caption: 'Extra wins per 162 games from a ten-point rise in homegrown share',
        columns: ['How it was measured', 'Wins'],
        rows: [
          ['Simple comparison across clubs', '+0.7'],
          ['Comparing seasons within the same club', '+0.7'],
          ['Same, using last season\'s share', '+0.7'],
          ['Using a three-year average', '−0.2'],
        ],
        note: 'Every one of these is comfortably inside the range you would expect from noise alone.',
      },
      proseAfter: [
        'The useful way to say it is not "we found nothing". It is this: across twenty years and thirty clubs, what is left on the table runs from about two thirds of a win worse to about two wins better. Building your roster out of your own players is not worth a meaningful number of games in either direction. Splitting it into hitters and pitchers does not rescue it, so this is not two real effects quietly cancelling each other out.',
        'That is a stronger and more useful statement than a shrug, and it is worth remembering the next time a broadcast praises a club for its player-development culture as though the standings could see it.',
      ],
    },
    {
      id: 'does-fast-pay',
      heading: 'Does moving fast actually pay off?',
      prose: [
        'The other half of the study asks whether promotion speed is worth anything to the player himself. Take everybody who graduated between 2010 and 2018. Sort them by how quickly they climbed next to comparable players. Then look at what they did in their first six big-league seasons. A "bust" here is a man who never put together a full season\'s worth of value across all six.',
      ],
      table: {
        caption: 'First six big-league seasons, by how fast the player climbed',
        columns: ['Climbed', 'Players', 'Typical value', 'Bust rate'],
        rows: [
          ['Fastest third', '256', '2.3 WAR', '19.9%'],
          ['Middle third', '256', '2.1 WAR', '20.3%'],
          ['Slowest third', '257', '1.2 WAR', '31.5%'],
        ],
      },
      proseAfter: [
        'The fastest movers are worth roughly a win more over six years and go bust noticeably less often. Most of that gap is still there even after you take account of how well the men were hitting in the minors at the time.',
        'But read it as a description, not as advice. Clubs promote the players who are already tearing up the level, and players who tear up Double-A tend to be good in the majors. Nobody was ever made better by being rushed. What the finding says is that promotion speed is a fair read on what a club\'s own scouts already believe — which is worth knowing when you watch a 22-year-old skip a level.',
      ],
    },
  ],
  caveats: [
    'Payroll is missing, and it is the obvious rival explanation — poor clubs both promote from within and might promote slowly for reasons of their own. No historical payroll exists anywhere in this repo, so home attendance stands in as a weak substitute for the size of a market. That gap is stated here rather than hidden. What can be said is that leaning on homegrown players is not simply low payroll or bad baseball wearing a disguise: set against winning percentage, the club-to-club relationship is essentially nothing, and every sign runs opposite to what the lazy assumption would predict.',
    'This is a pattern, not a mechanism. Nothing here shows that leaning on your own players CAUSES a slower farm. A club with eight homegrown regulars has no openings, and a prospect with nowhere to go stays where he is — that is the natural story, and it is a story, not a proof.',
    'Everybody in the promotion-speed half of this reached the majors. The men who never did are missing, and they would probably change the picture.',
  ],
  open: [
    'The reverse question is still open and is the better one: does a club\'s farm slow down because the big-league roster is full, or does a full roster follow from a farm that was already slow?',
  ],
  technical: [
    'Homegrown = parentOrg of a player\'s first professional MiLB season. 99.0% resolution over the cohort; 97.6% agreement with the drafting club, and 41 of the 56 disagreements are Rule 5 re-drafts.',
    'Primary spec: log(days) ~ homegrownShare[S−1] + level + tier + org FE + era, 2,852 durations, 30 orgs, 1,291 players. +11.2% per SD, org-clustered p=0.0056. Full season FE: +12.2%, p=0.0036. Leave-one-org-out: 9.0%–13.2%, p<0.05 in 30 of 30. Within-org permutation, 500 seeded draws: p=0.0040. Incremental R² 0.0043.',
    'By level: High-A +17.1% (p=0.0031), AA +8.4% (p=0.066), AAA +9.8% (p=0.19).',
    'Winning: 600 org-seasons, SEs two-way clustered on org and season. Point estimates +0.80 to +0.90 wins/162 per SD (p=0.24–0.36); trailing-3yr −0.29 (p=0.79). 95% interval roughly −0.8 to +2.4 wins per SD.',
    'Speed and outcome: 769 graduates, debuts 2010–2018, WAR over a fixed six-season window. +1 SD slower → −0.93 WAR6 (p=0.0011), −0.97 with dev-org FE (p=0.0017); bust rate +3.5 to +3.8 points.',
    'Two traps in the source data, both measured rather than assumed: raw.json carries only sportIds 11–14, so a player who entered in the complex leagues starts too high; and it sweeps only the group matching a player\'s CURRENT position, so a position converter loses every pre-conversion season.',
    'Reading the per-level table: the added-wait days are the level effects (High-A +17.1%, AA +8.4%, AAA +9.8%) carried onto the typical stay at each level (301, 342, 214 days). Note the two orderings differ — High-A is the largest in percentage terms, Double-A the largest in days (32), because Double-A has the longest typical stay for a percentage to act on. Only the High-A split stands on its own (p=0.0031); AA (p=0.066) and AAA (p=0.19) do not, which is why the pooled estimate is the one the entry rests on.',
    'Calendar check: the "own average in a year the league did not move" run is the full season fixed-effects spec (+12.2%, p=0.0036) against the primary era spec (+11.2%, p=0.0056) — the modest strengthening the prose reports. The chance check is a within-org permutation over 500 seeded draws, reported p=0.0040.',
    'The "less than half of one percent" figure is the incremental R² of 0.0043 over the level + tier + org + era baseline. Real at the panel level and negligible for a single duration; both readings come out of the same fit.',
    'Bust threshold: WAR6 below one win across the fixed six-season window. Tercile counts 256/256/257 of the 769 graduates. Speed is measured relative to comparable players rather than in raw calendar days, so the terciles are not simply fast-and-slow stays.',
  ],
}
