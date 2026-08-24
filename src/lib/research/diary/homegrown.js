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
    'Some clubs fill the big-league roster with players they developed. Others buy and trade for them. Does that change how fast prospects move through the farm — and does either way win more games?',
  headline:
    'The more a club leaned on its own homegrown players last season, the longer its prospects wait at every rung this season. About a month longer at Double-A. It is a real pattern and it survived every attempt to break it — and it wins the club nothing at all.',
  sections: [
    {
      id: 'measure',
      heading: 'What "homegrown" means here',
      prose: [
        'A player belongs to the club he started with — whoever had him for his first professional season in the minors. Not whoever drafted him.',
        'That sounds like hair-splitting and it is not. A quarter of the players here were never drafted at all — they signed at sixteen out of the Dominican Republic or Venezuela. Build the rule on the draft and you throw all of them out, and they are a quarter of the sport. Starting from the first professional season counts an international signing the same way it counts a first-round pick, which is right, because they are the same thing: a kid the club got in the door and taught.',
        'It resolves for 99 percent of players, and where a draft record does exist the two rules agree 98 percent of the time. Most of the disagreements are not errors at all — they are Rule 5 picks, players already professional when someone else selected them.',
      ],
    },
    {
      id: 'the-finding',
      heading: 'The finding',
      prose: [
        'In the seasons where a club’s big-league roster carried more of its own players than that club normally carries, its prospects spent longer at every level the year after.',
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
        'It shows up hardest in the low minors and softens as players climb, which is at least a coherent story: the traffic jam is worst where the line is longest.',
      ],
    },
    {
      id: 'breaking-it',
      heading: 'Three ways we tried to break it, and did not',
      points: [
        'Maybe it is just the calendar. Both things drift over twenty years, and two things that drift together will look related whether or not they are. So the test was rerun asking only whether a club deviated from its own average in a year when the rest of the league did not. The pattern got slightly stronger.',
        'Maybe it is one club. Thirty clubs is not many, and a result resting on the Rays alone is not a result. So it was rerun thirty times, dropping a different club each time. It held all thirty times, and the size of the effect only moved between 9 and 13 percent.',
        'Maybe it is chance. The seasons were shuffled inside each club — same clubs, same seasons, same numbers, just deliberately mismatched — and the whole thing rerun 500 times to see how often pure coincidence produces something this strong. Once. Out of 500.',
      ],
    },
    {
      id: 'how-much',
      heading: 'And now the deflating part',
      prose: [
        'Everything above is real. It is also nearly useless for predicting any particular player. Knowing a club’s homegrown share improves your guess about how long a given prospect will sit by less than half of one percent.',
        'Those two things belong in the same breath, and neither one cancels the other. This is what almost every finding in player development looks like once you get close to it: the pattern is real at the level of thirty clubs over twenty years, and player-to-player noise swamps it entirely at the level of the kid you are watching tonight. Both readings are correct. Only one of them is useful at the ballpark.',
      ],
    },
    {
      id: 'winning',
      heading: 'Does building from within win games? No.',
      prose: [
        'This is the question everybody actually cares about, and it is the one this data answers best. Six hundred club-seasons, and an outcome — wins — that owes nothing to the transaction log, so none of the measurement trouble that dogs the rest of this work can reach it. When a study this well built finds nothing, the nothing means something.',
      ],
      table: {
        caption: 'Extra wins per 162 games from a ten-point rise in homegrown share',
        columns: ['How it was measured', 'Wins'],
        rows: [
          ['Simple comparison across clubs', '+0.7'],
          ['Comparing seasons within the same club', '+0.7'],
          ['Same, using last season’s share', '+0.7'],
          ['Using a three-year average', '−0.2'],
        ],
        note: 'Every one of these is comfortably inside the range you would expect from noise alone.',
      },
      proseAfter: [
        'The useful way to say it is not "we found nothing". It is this: across twenty years and thirty clubs, the range of possibilities that remain runs from about two thirds of a win worse to about two wins better. Building your roster out of your own players is not worth a meaningful number of games in either direction. Splitting it into hitters and pitchers does not rescue it, so it is not two real effects cancelling out.',
        'That is a stronger and more useful statement than a shrug, and it is worth remembering the next time a broadcast praises a club for its player-development culture as though it were showing up in the standings.',
      ],
    },
    {
      id: 'does-fast-pay',
      heading: 'Does moving fast actually pay off?',
      prose: [
        'The other half of the study asks whether promotion speed is worth anything to the player. Take everybody who graduated between 2010 and 2018, sort them by how quickly they climbed relative to comparable players, and look at what they did in their first six big-league seasons. A "bust" here means he never produced a full season’s worth of value across all six.',
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
        'The fastest movers are worth roughly a win more over six years and go bust noticeably less often. Most of that gap survives even after accounting for how well the men were hitting in the minors at the time.',
        'But read it as a description, not as advice. Clubs promote the players who are already tearing up the level, and players who tear up Double-A tend to be good in the majors. Nobody made anyone better by rushing him. The finding is that promotion speed is a reasonable read on what a club’s own scouts already believe — which is worth knowing when you watch a 22-year-old skip a level.',
      ],
    },
  ],
  caveats: [
    'Payroll is missing, and it is the obvious alternative explanation — poor clubs both promote from within and might promote slowly for reasons of their own. No historical payroll exists anywhere in this repo, so home attendance stands in as a weak substitute for market size. This gap is stated rather than hidden. What can be said is that homegrown dependence is not simply low payroll or bad baseball in disguise: against winning percentage the relationship between clubs is essentially nothing, and every sign runs opposite to what the lazy assumption would predict.',
    'This is a pattern, not a mechanism. Nothing here shows that leaning on your own players causes a slower farm. A club with eight homegrown regulars has no openings, and a prospect with nowhere to go stays where he is — that is the natural story, and it is a story, not a proof.',
    'Everybody in the promotion-speed half of this reached the majors. The men who never did are missing, and they would probably change the picture.',
  ],
  open: [
    'The reverse question is still open and is the better one: does a club’s farm slow down because the big-league roster is full, or does a full roster follow from a farm that was already slow?',
  ],
  technical: [
    'Homegrown = parentOrg of a player’s first professional MiLB season. 99.0% resolution over the cohort; 97.6% agreement with the drafting club, and 41 of the 56 disagreements are Rule 5 re-drafts.',
    'Primary spec: log(days) ~ homegrownShare[S−1] + level + tier + org FE + era, 2,852 durations, 30 orgs, 1,291 players. +11.2% per SD, org-clustered p=0.0056. Full season FE: +12.2%, p=0.0036. Leave-one-org-out: 9.0%–13.2%, p<0.05 in 30 of 30. Within-org permutation, 500 seeded draws: p=0.0040. Incremental R² 0.0043.',
    'By level: High-A +17.1% (p=0.0031), AA +8.4% (p=0.066), AAA +9.8% (p=0.19).',
    'Winning: 600 org-seasons, SEs two-way clustered on org and season. Point estimates +0.80 to +0.90 wins/162 per SD (p=0.24–0.36); trailing-3yr −0.29 (p=0.79). 95% interval roughly −0.8 to +2.4 wins per SD.',
    'Speed and outcome: 769 graduates, debuts 2010–2018, WAR over a fixed six-season window. +1 SD slower → −0.93 WAR6 (p=0.0011), −0.97 with dev-org FE (p=0.0017); bust rate +3.5 to +3.8 points.',
    'Two traps in the source data, both measured rather than assumed: raw.json carries only sportIds 11–14, so a player who entered in the complex leagues starts too high; and it sweeps only the group matching a player’s CURRENT position, so a position converter loses every pre-conversion season.',
  ],
}
