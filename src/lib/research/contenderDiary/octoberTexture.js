// Diary entry — spike #5, and the first one in this program that does not
// regress a roster trait against the outcome ladder. It asks what is different
// about the GAMES, comparing the same men in the same year to themselves.
// Full method, every number, and the two traps this spike had to climb out of:
// docs/team-success-october-texture.md.
export const octoberTextureEntry = {
  id: 'october-texture-v1',
  date: '2026-08-25',
  source: 'Spike #5, commissioned directly',
  doc: 'docs/team-success-october-texture.md',
  title: 'October is the same sport, played by better pitchers, with a much quicker hook',
  verdict: 'holds',
  question:
    'Everybody who watches says postseason baseball feels different. So we went looking for it. Are the at-bats longer? Do hitters shrink? Do pitchers throw something else? Do managers really go to the bullpen sooner — and if they do, does it win anything? And how much of the whole thing is just luck?',
  headline:
    'Four of the five turned up something. At-bats are a touch longer. Pitchers throw harder and simplify what they throw. Managers pull starters a full inning earlier than they do in July, and they have been doing it more every year. But the thing everyone believes hardest — that hitters shrink in October — is mostly an illusion created by who is standing on the mound. And the quick hook, for all that it has taken over how October is managed, has never once shown up as a reason a team went further.',
  sections: [
    {
      id: 'the-image',
      heading: 'Twenty-four curveballs in a row',
      prose: [
        'Game 7 of the 2017 American League Championship Series, Houston. Lance McCullers Jr. comes out of the bullpen in the fourth inning and throws fifty-four pitches. The first thirty are a normal enough mix — a sinker here, a changeup there, the big knuckle-curve mixed in. Then something happens that does not happen in June.',
        'He throws the curveball. Then he throws it again. He throws it twenty-four consecutive times, all the way to the last out of the pennant, and the Yankees know it is coming, and they cannot do anything about it. He never throws another sinker.',
        'That is the postseason in one picture, and the useful thing about it is that it is not just a picture. It is a number, and there are twenty-six years of numbers underneath it. We went and got them: every regular-season and every postseason line since 2000, for every hitter and every pitcher, and every pitch a man threw since the tracking cameras went up in 2008. Then we asked the only question that keeps the answer honest — not "is October different from the regular season," but "is October different for the SAME people."',
      ],
    },
    {
      id: 'the-bats',
      heading: 'The at-bats get longer, but barely',
      prose: [
        'Start with the thing you can feel from the couch: the at-bats seem to go on forever. They do go on longer. They do not go on much longer.',
        'Across twenty-five seasons, the average postseason plate appearance takes 3.87 pitches. The average regular-season one takes 3.83. That is one extra pitch about every twenty-seven times a man comes to the plate — call it an extra pitch and a half per team per game. It shows up in seventeen of the twenty-five years, and it holds up when you throw any single year away. It is real. It is also nowhere near big enough to be what you are noticing.',
      ],
      table: {
        caption: 'The average trip to the plate, 2000-2025 (2020 left out)',
        columns: ['', 'Pitches per plate appearance'],
        rows: [
          ['Regular season', '3.83'],
          ['October', '3.87'],
          ['The gap', 'one extra pitch every 27 at-bats'],
        ],
      },
      proseAfter: [
        'Walks are the same in both months. Strikeouts are not — they jump by two full points in October. Hold that thought, because it is about to turn out to be somebody else\'s story.',
      ],
    },
    {
      id: 'the-illusion',
      heading: 'The best hitters look worse in October. Almost none of it is the hitters.',
      prose: [
        'Here is the belief we most wanted to test, because it is the one everyone holds: good hitters shrink in October. And on the first pass, the data agreed so loudly it was almost embarrassing.',
        'We took every man who batted in a postseason game, gave him exactly the plate appearances October actually gave him, and let him hit at his own regular-season rate. That is what October should have looked like if the only thing that changed was the calendar. Then we compared it to what happened. The hitters came in 88 points of OPS below their own season. Twenty-four of twenty-five years. It is a huge number.',
        'It is also worthless, and it took running the same test backwards to see why.',
        'Do it from the mound instead — every October pitcher, given his real October batters, pitching at his own regular-season rate — and the pitchers come in 37 points WORSE than their own season too. Both sides cannot be having a bad month in the same game. Somebody is getting those hits.',
        'What that first test was really measuring was not October. It was the opposition. An October hitter is better than the average hitter, so holding him to his own numbers sets a high bar. An October pitcher is better than the average pitcher, so holding him to his sets a low one. The two tests were measuring the same thing from opposite dugouts and both getting it backwards.',
        'So we held both ends of the matchup at once — a hitter fifty points above the league meeting a pitcher who keeps the league forty points down should produce about ten points above the league — and ran it again. The 88 points became 14.',
      ],
      table: {
        caption: 'How far October offence fell short of what it should have been',
        columns: ['How you measure it', 'The answer'],
        rows: [
          ['Hitters against their own season only', '88 points of OPS — and this is the wrong number'],
          ['Pitchers against their own season only', '37 points the other way — also the wrong number'],
          ['Both ends of the matchup held at once', '14 points'],
          ['Extra strikeouts, once both ends are held', 'none we can find'],
        ],
      },
      proseAfter: [
        'Fourteen points of OPS is the difference between a .700 hitter and a .714 hitter. It is there in sixteen of twenty-five seasons, it has not changed size since 2000, and it is about a sixth of what the naive number claimed.',
        'And the strikeouts — the two-point October jump from a moment ago — disappear completely. Every extra October strikeout is explained by the quality of the man throwing. Not by the month, not by the crowd, not by the pressure. October hitters strike out more because October pitchers are better. That is the whole explanation.',
        'One more thing worth saying, because the television broadcast will tell you otherwise every night: we split the October arms into starters and relievers and compared each group to its own regular season. Starters gave up 36 points more than their own form. Relievers gave up 39. There is no gap there. Relief pitchers are better than starters in October, but they are not more THEMSELVES in October, and the popular story about bullpens winning the month does not show up in this measurement at all.',
      ],
    },
    {
      id: 'the-mound',
      heading: 'They throw harder. They throw fewer things.',
      prose: [
        'McCullers was not an outlier. He was an extreme version of something almost everybody does.',
        'Take the eleven hundred and sixty-four pitchers since 2008 who threw enough in both months to compare, and put each man next to himself. In October his fastball is half a mile an hour faster. Starters and relievers, the same half a mile an hour — so this is not a trick of more relief innings being thrown, it is the same men reaching back.',
        'And the mix narrows. Two out of every three pitchers lean harder on their best pitch in October than they did all season.',
        'That one needed a trap cleared first. "Share of his best pitch" is a maximum, and a maximum measured over a small handful of games runs high all by itself — a pitcher who changed nothing would still look like he simplified. So we shrank each man\'s regular season down to exactly as many pitches as October gave him, drawn at random from his own real mix, and measured that the same way. About a quarter of the apparent narrowing was the small sample. Three quarters of it was the pitcher.',
        'The surprise is in what they are NOT doing. They do not throw more fastballs. The fastball share of all pitches in October is identical to the regular season, right down to the decimal. They are not reaching for the heater under pressure. They are dropping the fourth pitch and the fifth pitch — the show-me curve, the occasional cutter — and living on the two things they trust.',
      ],
      table: {
        caption: 'The same pitcher, his season and his October (2008-2025, 1,164 men)',
        columns: ['', 'Change in October'],
        rows: [
          ['Fastball speed', 'half a mile an hour faster'],
          ['Share thrown with his best pitch', 'up a point and a half'],
          ['Pitches he uses at all regularly', 'fewer'],
          ['Share of everything that is a fastball', 'no change whatsoever'],
        ],
      },
      proseAfter: [
        'Sean Manaea threw his best pitch 31 percent of the time for the Mets in 2024 and 55 percent of the time that October. Johnny Cueto went from 30 to 51 in 2015. Yordano Ventura, 33 to 54, the same fall. Those are not men who found something new in October. They are men who stopped throwing everything else.',
      ],
    },
    {
      id: 'the-hook',
      heading: 'The quick hook is real, it is growing, and it has never won anything',
      prose: [
        'This was the part we most expected to confirm, and it confirmed hard.',
        'Take the six hundred and fifty-five pitchers who started games in October and had started all year long, and measure each man against himself. In the regular season he goes six and a third innings and throws 96 pitches. In October he goes five innings and throws 84.',
        'A full inning, gone. And it is a decision, not exhaustion — look at what happens per batter. Each October hitter costs the starter slightly MORE pitches than a regular-season hitter does. He is working harder per man. He throws twelve fewer pitches anyway, because he faces three and a half fewer men. Somebody comes and takes the ball.',
        'Clubs use half an extra pitcher per game in October, in twenty-four of the twenty-five seasons we looked at. And the whole thing is accelerating. Between 2000 and 2012, an October starter lost about eight-tenths of an inning against his own form. Since 2013 he loses a full inning and a fifth. Managers do not just manage October differently — they manage it more differently every year.',
      ],
      table: {
        caption: 'The same starter, his season and his October (655 men, 2000-2025)',
        columns: ['', 'Regular season', 'October'],
        rows: [
          ['Innings per start', '6.1', '5.1'],
          ['Pitches per start', '96', '84'],
          ['Pitches per batter he faced', '3.82', '3.85'],
          ['Pitchers his club used per game', '4.0', '4.5'],
        ],
      },
      proseAfter: [
        'So does it work? Look at the 233 clubs that reached October and the answer seems obvious and immediate: the clubs whose starters went deep went further, and the clubs who emptied the bullpen went home. It is a clean, strong relationship in both directions.',
        'It is also entirely fake, and this diary has already been caught by this exact trick once before. A club that plays twenty October games got there by winning. A club swept in three did not. Winning teams leave starters in because they are ahead — the long start is a symptom of going deep, not a cause of it. Hold fixed how much October baseball a club actually played, and both relationships vanish. Not weaken. Vanish, to almost exactly zero, on both measures.',
        'The quick hook is the single largest, clearest, most obviously growing difference between an October game and a July game. And across 233 postseason clubs and a quarter century, there is no sign it has ever decided anything.',
      ],
    },
    {
      id: 'the-coin',
      heading: 'And then there is the part nobody wants to hear',
      prose: [
        'Two hundred and thirteen postseason series since 2000 were played between two clubs with different regular-season records. Somebody was demonstrably better. That club won 111 of them.',
        'Fifty-two percent. A coin, weighted so slightly you would need hundreds of flips to notice.',
        'And being MUCH better does not help. Clubs that finished eight to twelve games ahead of their opponent won 62 percent of the time, which sounds like something — until you see that clubs thirteen or more games better won only 48 percent, and clubs one to three games better won 48 percent too. There is no ladder there. The size of the gap between two clubs tells you essentially nothing about who advances.',
        'The team with the best record in all of baseball has won the World Series six times in twenty-six years: 2007, 2009, 2016, 2018, 2020 and 2024. The other twenty times, the best club in the sport spent October watching somebody else.',
      ],
      table: {
        caption: 'How often the better regular-season club won the series',
        columns: ['Round', 'Series', 'Better club won'],
        rows: [
          ['Wild Card', '37', '49%'],
          ['Division Series', '101', '51%'],
          ['Championship Series', '50', '58%'],
          ['World Series', '25', '52%'],
          ['All of them', '213', '52%'],
        ],
      },
      proseAfter: [
        'That Championship Series number is the only one that looks different, and fifty series is exactly the sample size where a run of luck looks like a pattern. Do not believe it yet.',
        'This finding matters more than it first appears, because it explains the last four entries in this notebook. Roster age, homegrown share, star power spread across a lineup, postseason experience — every one of them found something real about which clubs REACH October, and every one of them came back empty on how far a club goes once it is there. Four spikes, four nulls, on the same cut. We kept looking for the thing that separates the deep runs from the early exits.',
        'This entry is the answer to why we could not find it. There is not much there to find.',
      ],
    },
  ],
  caveats: [
    'The 14-point drop in October hitting is the number this entry stands behind, but the way we combined the hitter and the pitcher into one expectation is a rough-and-ready method, not a fitted model. The direction and the rough size are the claim. The exact figure is not.',
    'We did not control for ballparks or for weather, at all. October is played in twelve clubs\' parks, in the cold, mostly at night. Any of that could account for some or all of those 14 points. Nothing here is evidence that pressure is what makes hitters worse — only that something small does, after you account for who is pitching.',
    'A player\'s regular-season baseline here is his whole season, April included. So a man who is worn out by late October is being measured against his own fresh April self. Fatigue is inside these numbers, not removed from them.',
    'The disappearing October strikeout gap is a "we cannot find it," not a "it is zero." With twenty-five seasons of data we cannot detect a difference. A version built one hitter at a time would have far more power to.',
    'The pitch-mix work only goes back to 2008, when the tracking cameras went up. It covers eighteen of this window\'s twenty-six seasons and can say nothing at all about the 2000s.',
    'The coin-flip finding calls the club with the better record "the better club." Records are themselves noisy and partly an accident of schedule. A sharper way of ranking two clubs would probably push that 52 percent up somewhat — treat it as a floor, not a precise reading.',
    '2020 was left out of every year-by-year comparison here — a sixty-game season and a sixteen-team bracket is a different sport — and what including it would have done is written down in the full method.',
    'The starters-versus-relievers comparison in the hitting section measures each group against its own regular season. It does not say the two groups are equally good in October. They are not. It says neither one departs from its own form more than the other does.',
  ],
  open: [
    'The hitting result one player at a time instead of one season at a time. Twenty-five seasons is twenty-five data points; hitter-by-hitter would be tens of thousands, and could tell "everybody dips a little" apart from "a few men collapse."',
    'How often an October hitter is seeing a pitcher for the third time in a game. That is the most likely mechanism behind BOTH the quick hook and whatever is left of the hitting drop, and it needs pitch-by-pitch data rather than season totals.',
    'Whether the extra half mile an hour is adrenaline, or simply what a man throws when he knows he is only going five innings, or the cold weather fooling the cameras. Splitting it by how long the outing lasted would be the place to start.',
    'Whether the quick hook is really harmless at the level of a single series, rather than across a whole team-season where one bad decision gets averaged away with twenty good ones.',
    'Whether that 58 percent in the Championship Series is anything at all. Fifty series is not enough to tell.',
  ],
  technical: [
    'Panels: statsapi teams/stats (2,060 rows), stats league-wide (54,486 player-season rows), people/{id}/stats?stats=pitchArsenal (1,209 pitcher-seasons), all split by gameType R vs P, 2000-2025 (arsenal 2008-2025, PITCHf/x floor, min 50 postseason pitches). Series outcomes from public/data/postseason-history.json. Built by .scratch/team-success/build-october-texture.mjs; analysed by analyze-october-texture.mjs. Neither the 70 MB raw cache nor the 51 MB assembled panel is committed — both rebuild in ~2 minutes; october-texture-findings.json is.',
    'All paired tests are sign-flip permutation tests, 20,000 draws, deterministic LCG seed; all rank correlations are Spearman with a within-season permutation shuffle (the house convention). 2020 excluded from every season-level statistic.',
    'Q1 pitches/PA: league totals off the hitting side. Regular 3.827, postseason 3.865, mean paired difference +0.0373 (p=0.0031, n=25, positive in 17). Leave-one-season-out [+0.0341, +0.0417]. With 2020 included +0.0375 (p=0.0019). K/PA +2.04pp (p<0.0001); BB/PA +0.25pp (p=0.1163).',
    'Q2 selection-free expectation: for each October participant, his regular-season component counts (AB, H, BB, HBP, TB, K, SF, HR) scaled by postseasonPA/regularPA (hitters) or postseasonBF/regularBF (pitchers), summed and re-expressed as a rate line. Hitter-side residual −0.0882 OPS (p<0.0001, 24/25 seasons); pitcher-side residual +0.0366 OPS allowed (p=0.0005). THE SIGN FLIP IS THE POINT — each one-sided statistic estimates opposition quality, not a month effect, and neither may be quoted alone.',
    'Q2 matchup-held expectation: additive form E_h + E_p − E_league for OPS and AVG; log5 odds-ratio odds(h)·odds(p)/odds(L) for K/PA. Residuals: OPS −0.0141 (p=0.0413, 16/25 seasons below, LOO [−0.0178, −0.0116]); AVG −0.0082 (p=0.0019); K/PA +0.0040 (p=0.1111 — NULL). Era-stable: 2000-2012 −0.0138, 2013-2025 −0.0145. The additive OPS combination is an approximation and assumes hitter and pitcher deviations are independent; the third decimal is not defended.',
    'Q2 role split, each group against its own regular season: October starters +0.0361 OPS allowed (p=0.0007), relievers +0.0390 (p=0.0001), n=25 seasons each. The between-group comparison is clean (both face the same lineups); each figure alone still carries the one-sided opposition problem.',
    'Q3: 213 series with unequal regular-season records, 2000-2025. Better record won 52.1%; higher seed 52.6%. Spearman rho between record-gap size and better-club-won = 0.0497 (within-season permutation p=0.4241). By round: WC 48.6% (n=37), DS 50.5% (n=101), LCS 58.0% (n=50), WS 52.0% (n=25). Best record in MLB won the World Series 6/26 (2007, 2009, 2016, 2018, 2020, 2024). Team W-L taken from the team-level pitching row, gameType R.',
    'Q4 small-sample correction: best-pitch share is a MAXIMUM over pitch-type shares and is upward-biased at small n. Control = 60 multinomial draws of size (October pitch count) from each pitcher\'s own regular-season type distribution, measured identically. Corrected best-pitch share +1.46pp (p<0.0001) vs. naive +1.94pp — 25% of the naive effect was the bias. Corrected Herfindahl (sum of squared shares) +0.0195 (p<0.0001); corrected count of types at ≥10% usage −0.138 (p<0.0001). Fastball share +0.02pp (p=0.9286). Velocity +0.52 mph (p<0.0001) is a MEAN and not subject to this bias; starters +0.52, relievers +0.51. n=1,164 pitcher-seasons.',
    'Q5 league hook: pitcher appearances per club-game +0.514 (p<0.0001, 24/25 seasons, LOO [0.491, 0.545]); batters faced per appearance −1.05 (p<0.0001). Era: +0.37 (2000-2012) vs +0.67 (2013-2025).',
    'Q5 paired starters: n=655 pitcher-seasons with postseason GS==G and regular-season GS≥10 and GS/G≥0.8. Outs per start −3.11 (−1.04 IP, p<0.0001); pitches per start −12.39 (p<0.0001); batters per start −3.40 (p<0.0001). Pitches per batter faced 3.82 → 3.85, i.e. pitch count falls DESPITE per-batter cost rising. Era: −0.85 IP (2000-2012, n=321) vs −1.21 IP (2013-2025, n=334).',
    'Q5 does the hook win: n=233 postseason team-seasons. Starter outs/start vs ladder raw rho=+0.2812 (p<0.0001) → rank-residualised partial rho=+0.0097 (p=0.8699) controlling total postseason outs. Appearances/game vs ladder raw rho=−0.2382 (p<0.0001) → partial rho=+0.0300 (p=0.8156). This is the postseason-volume confound from docs/team-success-postseason-usage.md reproducing exactly as the framework predicted.',
    'Q6 mechanism probe: Spearman rho between a season\'s hook gap and its matchup-held OPS residual = +0.158 over 25 seasons — wrong sign for the third-time-through story and far too thin to interpret. Reported as an open question only.',
    'The opening anecdote was verified against the live feed, not recalled: gamePk 526503 (2017 ALCS Game 7), Lance McCullers Jr. (id 621121) threw 54 pitches, of which the final 24 consecutive were knuckle-curves (code KC), 41 KC in total against 11 sinkers and 2 changeups.',
  ],
}
