// Diary entry — the answer to the first ask in the front-office reading below
// it. That entry asked for the job above the prospect to be described and then
// tested against the length of his Triple-A stay, and said it was the one it
// would fund first.
//
// It got a no on its own question and a yes on a question it did not ask. The
// entry is filed under "holds" for the second of those, and the headline says
// the no first, because an ask that comes back with a different answer than the
// one it wanted is the case where burying the no does the most damage.
export const blockageEntry = {
  id: 'price-the-blockage',
  date: '2026-08-25',
  source: 'PR #904',
  doc: 'docs/price-the-blockage.md',
  title: 'What the man ahead of you actually costs you',
  verdict: 'holds',
  question:
    'A prospect is stuck at Triple-A and there is an established big leaguer playing his position. Everybody in the game says that is why he is stuck. Is it?',
  headline:
    'No — not in the way the question assumes. Describing the job above a man tells you nothing at all about how long he waits, and that no survives every way of asking. What it does tell you is whether he arrives in the majors playing a different position, and usually an easier one. A third of hitters do. The blockage is real. It is not paid in waiting. It is paid in position.',
  sections: [
    {
      id: 'the-no',
      heading: 'First the no, because it was the question that got asked',
      prose: [
        'Picture a shortstop starting his third summer at Triple-A. Up in the big-league park, a healthy 28-year-old plays shortstop every day, and the club controls him for four more years. Everybody in the game will tell you that is why the kid is still riding the bus. So we went and checked.',
        'For every one of 962 Triple-A stays, we wrote down the job above the man: who held it, how he was hitting or pitching, how many years the club still controlled him, how long he had held it. Then we tried to guess how long the stay would last. Twice. The first guess used only the prospect\'s own numbers. The second used his numbers plus everything we knew about the man ahead of him.',
        'Knowing about the man ahead of him made the guess better by about one part in a hundred. Which is another way of saying it did not help. It did not help when we counted the stay in calendar days, and it did not help when we took the winter months out. Not for hitters. Not for pitchers. Not when we described the job a full season before the prospect ever showed up. And not when each position was given its own allowance.',
      ],
      table: {
        caption: 'How much better the guess gets when you know who is ahead of him',
        columns: ['How it was asked', 'Improvement to the guess'],
        rows: [
          ['Every stay, counting only months when games are played', 'Nine tenths of one percent — nothing'],
          ['Every stay, counting the winter too', 'One percent — nothing'],
          ['Describing the job a season before he got there', 'A third of one percent — nothing'],
          ['Hitters on their own', 'Half of one percent — nothing'],
          ['Pitchers on their own', 'Two percent — nothing'],
          ['Hitters, each position given its own allowance', 'One percent — nothing'],
        ],
        note: 'Not one of these is strong enough to be told apart from chance.',
      },
      proseAfter: [
        'One number did look real at first, and it is worth telling you what happened to it, because it is the reason the rest of this entry can be trusted. Among pitchers, a BETTER man ahead of the prospect went with a SHORTER stay — backwards from the whole idea. Then we measured the same thing a year earlier, before the prospect ever turned up. It vanished. A real effect does not care what year you measure it in. A measurement that is quietly picking up the club reacting to the prospect does exactly that.',
        'There was also a bug worth confessing. The first version of this counted the prospect himself among the men holding the job above him — the moment he is called up, he plays that position for that club. So a prospect promoted in May piles up starts and makes his own position look crowded, and an early promotion ended up looking like it was CAUSED by a crowded position. It gave us a strong, clean, completely false answer. Taking him back out cost 75 stays, and those 75 turned out to be exactly the men who had nobody standing in front of them at all.',
      ],
    },
    {
      id: 'the-yes',
      heading: 'Then the thing nobody asked about',
      prose: [
        'Waiting is not the only way out of a blocked spot, and it turns out to be the least common one. A prospect can be traded. He can be moved to another position. The second of those is not a rare event, and nobody here had bothered to count it.',
        'Of 427 hitters, 154 — better than a third — reached the majors playing a different position than the one they had played at Triple-A. A quarter of the whole group arrived somewhere easier: shortstops turning up at second base, third basemen out in left field, centre fielders slid over to a corner.',
        'And unlike the waiting, this one IS predicted by the job above him. Strongly, and in the direction the story needs.',
      ],
      table: {
        caption: 'Where a hitter ends up, by how crowded the job above him was',
        columns: ['The job above him', 'Stays', 'Changed position', 'Moved somewhere easier'],
        rows: [
          ['One man owns it', '134', '50.0%', '38.1%'],
          ['Two men share it', '143', '32.9%', '26.6%'],
          ['Three or more share it', '150', '26.7%', '12.0%'],
        ],
        note: 'No model involved. This is simply counting.',
      },
      proseAfter: [
        'The two corners of the sample make the same point harder. Behind a single veteran the club no longer controls, 46% of prospects changed position. Behind a job shared by cheap young players, 20.5% did.',
      ],
    },
    {
      id: 'the-trap',
      heading: 'The trap this nearly fell into',
      prose: [
        'There is an obvious way for all of that to be a mirage, and it took most of a day to rule out. Corner outfield is two jobs at once, so it always looks crowded — and it already sits near the bottom of the difficulty ladder, so nobody there has anywhere easier to go. Catcher is one job, at the top of that ladder. So "crowded job" and "no room left to fall" might be the same fact about which position a man plays, dressed up in a costume and passed off as a finding about front offices.',
        'That trap is real. Corner outfielders typically have four men sharing their job, and only 7.4% of them ever move down the ladder. Shortstops typically have one man sharing it, and 51.5% move down. So the whole thing was run again with every position given its own separate allowance, which takes the positional arithmetic out of it entirely.',
        'It survived. Compare a man only against others at his own position and a crowded job above him still makes him much less likely to be moved down. It also survives being measured a season before he arrived — which the contract length does not. And the backwards test agrees: moving UP the ladder, which a blocked path gives you no reason to expect, shows nothing at all.',
        'The plainest version of it needs no model whatsoever. Split each position at its own crowding level and compare like with like: 38.0% of men behind a settled job changed position, against 29.4% of men behind a shared one.',
      ],
    },
    {
      id: 'the-price',
      heading: 'What can be priced, and what cannot',
      prose: [
        'The ask wanted a price on a blocked prospect — ours, and everybody else\'s. Half of that price is available now and half of it is not, and the missing half is the more important one.',
        'What we can price is the chance the club moves him off his position. That is computable today, for any prospect in any organization, out of nothing but public paperwork: who is playing his position, how old that man is, and how many years the club still controls him.',
        'What we cannot price is what the move costs him. Take the 302 hitters who have six full seasons on the record. The ones who moved down the ladder were worth about two wins less across those six years than the ones who did not — and that gap is small enough that plain luck could have produced it. So we can say who gets moved. We cannot yet say whether being moved hurt them, or whether clubs simply moved the men who were never going to hold the harder position anyway. Those two stories look identical in this data, and this sample cannot tell them apart.',
        'One more number belongs in the room before anybody gets excited. A genuinely blocked spot — one man owning the job AND the club out of control years on him — happens in 11.7% of Triple-A stays. It is a real thing that happens to about one prospect in eight, which is also most of the reason it never showed up in the average.',
      ],
      points: [
        'A third of hitters arrive in the majors at a different position than the one they played at Triple-A. That is a large fact about player development that nobody here had written down.',
        'Contending clubs move prospects off their position. A club a hundred points of winning percentage better is about 66% more likely to move a man down the ladder, and this is the single strongest signal in the study — nobody asked for it.',
        'The years left on the man ahead of him predict the move strongly, but only when the job and the stay are read in the same season. Describe the job a year earlier and it is gone, so it cannot be called a cause.',
        'How WELL the man ahead of him is playing is the weakest part of the description and the first thing to fall apart. What matters is whether the job is settled, not whether it is held well.',
      ],
    },
    {
      id: 'contracts',
      heading: 'A note on the thing we were told we did not have',
      prose: [
        'The ask assumed contract data would have to be bought, and listed buying it as a separate item. For most of this, it did not. Three pre-arbitration years and then three arbitration years has held in every season in this sample. So for any player inside his first six years, the number of years his club still controls him is just arithmetic off his debut date. No money required.',
        'That covers 60% of the men holding these jobs. The other 40% are past their control window, on a real contract this app genuinely cannot see, and that is the only place the missing payroll history actually bites. A useful narrowing of an expensive purchase.',
      ],
    },
  ],
  caveats: [
    'Everybody in this study reached the majors. The prospect who was blocked so badly he never got there is invisible here, and he is the case the whole idea is about. The one test we could run on it came back clean — blocked prospects were no more likely to be traded away than anybody else — but that is a weak substitute for the missing men.',
    'The position a man "plays" is taken from wherever he started the most games. For a debut season of twenty games that is a thin reading, and the effects do get weaker when we keep only the men with forty or more starts. Some of what we are seeing may be clubs shuffling utility players around, which is not the same thing as blockage.',
    'The contract effect only turns up when the job and the stay are read in the same season. It is strong then, and gone when the job is described a year earlier. Something about it is picking up decisions the club made about the man ahead and about the prospect at the same moment, and this design cannot pull those apart.',
    'The cost of a position change is not established, only estimated — about two wins over six seasons, with a range of error wide enough to include no harm at all and wide enough to include a great deal worse. So every sentence here about what blockage costs a player is about the CHANCE of the move, and not about what the move does to him.',
    'Left and right field are treated as one job. A man moved from left to right does not register as having changed position, so the 36% is a floor and not a ceiling.',
    'Triple-A stays before 2009 do not exist in this data at all, because the transaction wire that supplies the arrival dates does not cover them. Nothing here describes the 2000s.',
  ],
  open: [
    'Whether being moved down the ladder actually hurt these men, or whether clubs moved the ones who were never going to stay at the harder position. Answering it needs the defensive grades this app does not carry, and probably needs the busts the cohort cannot see.',
    'Why contending clubs move prospects off their position so much more often. The obvious story is that a good club has good players everywhere and something has to give, but the effect holds up even after you account for how well the man ahead of him is playing, so the obvious story is not the whole story.',
    'What the same study says about pitchers. There is no defensive ladder for an arm, so the position outcome does not exist for them, and the waiting answer for pitchers is the same no as for everybody else. If blockage has a currency for pitchers, it is not one of the two this study can see.',
  ],
  technical: [
    'Cohort: 962 Triple-A stays, 2009–2023, from the level-tenure date resolution. 864 carry a complete job description; 427 hitter stays carry a readable position at Triple-A and at debut.',
    'Job construction: incumbent = max games started at the prospect’s position group on the parent club that season, prospect himself excluded. Starters = the fifth man by games started; relievers = worst ERA with 25+ appearances. Quality = season OPS or ERA over the qualified-league mean, then z-scored within season and player group.',
    'Contract: control years remaining = max(0, 6 - service years), service clock starting the following season for debuts after 15 August. A stricter variant counting only seasons with a major-league appearance disagrees on 15.5% of stays and changes no conclusion.',
    'Waiting model: OLS on log(days), base = own rate (z), age, draft tier, era band; volume excluded as mechanically endogenous to the outcome. Incremental R² 0.0089, F(6,848) = 1.39 for season days; 0.0102, F(5,407) = 1.00 for hitters with position fixed effects. Nothing significant under any specification, including a five-way split by position scarcity.',
    'Position model: logistic on moved-down-the-ladder with position fixed effects — control years OR 0.096 (p = 0.0005), depth OR 0.638 (p = 0.0032), incumbent age OR 0.850 (p = 0.0154), parent club win pct OR 1.66 per .100 (p = 0.0046), incumbent quality OR 1.163 (p = 0.31). McFadden 0.228 against 0.109 without position controls.',
    'Lagged refit: depth OR 0.618 (p = 0.0015) and win pct OR 1.67 per .100 (p = 0.0028) survive; control years OR 0.840 (p = 0.68) does not. Placebo on moved-UP: control p = 0.78, depth p = 0.16, incumbent age p = 0.93.',
    'Within-position median split on depth: 38.0% (n = 305) settled against 29.4% (n = 119) shared.',
    'Cost: WAR over six seasons from debut, n = 302. Moved down b = -2.08 (p = 0.16); changed position b = +1.53 (p = 0.27); model R² 0.153.',
    'Two null side results: stays ending 1–21 April number 89 against 81 for the following twenty days, so no service-time cliff is visible; and stays end in September 184 times against 135 in April, so roster expansion moves more men than any description of the job above them.',
    'Position-change base rates behind the prose: 154 of 427 hitter stays changed position (36.1%); 25.1% of the 427 moved DOWN the defensive ladder.',
    'The positional confound quantified — this is what the position fixed effects exist to remove: corner outfielders carry a median incumbent depth of 4 and move down the ladder 7.4% of the time; shortstops carry a median depth of 1 and move down 51.5% of the time.',
    'Sample corners on position change: single incumbent already past his control window, 46.0% changed position; job shared among pre-arbitration incumbents, 20.5%.',
    'Genuine-blockage prevalence (single incumbent AND zero control years remaining on him): 11.7% of the 962 stays, i.e. roughly one prospect in eight — a base rate low enough on its own to keep the effect out of any conditional mean.',
    'The parent-club win-pct term restated for the prose: OR 1.66 per .100 of winning percentage is about a 66% lift in the odds of a move down the ladder.',
    'Control-year coverage: 60% of incumbents sit inside the six-year window where control years are pure arithmetic off mlbDebutDate; the remaining 40% are past it and would require the contract data this app does not hold.',
  ],
}
