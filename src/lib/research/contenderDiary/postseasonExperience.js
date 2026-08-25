// Diary entry — the fourth factor spike. How much of a team's playing time
// went to players who had already been to the postseason in some earlier
// year, and whether that share tells you who gets to October or how far they
// go once they are there. Full method:
// docs/team-success-postseason-experience.md.
export const postseasonExperienceEntry = {
  id: 'postseason-experience-v1',
  date: '2026-08-25',
  source: 'Spike #4',
  doc: 'docs/team-success-postseason-experience.md',
  title: 'October experience buys the ticket in, and then October stops caring',
  verdict: 'holds',
  question:
    'Are the teams that reach the Championship Series and the World Series built out of players who had already been to the postseason in an earlier year? Is that what separates a team that merely qualifies from a team that advances? And does it show up more in the pitchers or the hitters?',
  headline:
    'The teams that reached October leaned far harder on players who had been there before — about twenty trips to the plate out of every hundred more than the teams that stayed home. That is one of the largest gaps this notebook has found, and it holds every way we sliced it. But among the teams that DID reach October, the same number goes quiet. It does not tell you who wins a round, who reaches the Championship Series, or who wins the World Series. The 2002 Angels won a title with almost nobody on the roster who had ever played a postseason game. The 2022 Brewers had a roster full of them and watched October on television.',
  sections: [
    {
      id: 'two-teams',
      heading: 'Two teams, opposite rosters, opposite Octobers',
      prose: [
        'Start in Anaheim in 2002. The Angels won the World Series that fall. Now go back through their season and ask a simple question of every trip to the plate: had the hitter standing in the box ever played in a postseason game before, for anybody, in any earlier year? Two out of a hundred. That is it. Ninety-eight trips out of a hundred went to a player who had never been there in his life. They beat the Giants in seven games anyway.',
        'Now go to Milwaukee in 2022. Ninety-six trips to the plate out of every hundred went to a player who had already been to the postseason. About as experienced a lineup as the last twenty-six years can build. The Brewers finished seven games out and did not get in.',
        'Those two teams are the whole entry in miniature. To see which story is the rule and which is the exception, we did the same count for every team from 2000 through 2025 — 750 team seasons in all, 234 of which reached the postseason. For the hitters we counted trips to the plate; for the pitchers we counted innings. A player only counted as experienced if he had already appeared in a postseason game in an EARLIER year, so the October a team is playing toward can never sneak into its own number. The short 2020 season was left out.',
      ],
    },
    {
      id: 'getting-in',
      heading: 'Getting in: the biggest gap in this notebook so far',
      prose: [
        'Line up the teams that reached October against the teams that did not, and the difference is not subtle.',
      ],
      table: {
        caption: 'Share of a team\'s season that went to players who had been to October before',
        columns: ['Team', 'Trips to the plate', 'Innings pitched'],
        rows: [
          ['Missed the postseason (516 teams)', 'About 5 in every 10', 'About 4 in every 10'],
          ['Reached the postseason (234 teams)', 'About 7 in every 10', 'About 6 in every 10'],
        ],
      },
      proseAfter: [
        'Twenty points out of a hundred on the hitting side, twenty on the pitching side. That is bigger than anything the roster-age spike found and bigger than anything the star-diversity spike found. And it is not one lucky season carrying the rest: pull any single year out of the twenty-five and refit the whole thing, and the gap is still there, on both sides of the ball, all twenty-five times.',
      ],
    },
    {
      id: 'the-ladder',
      heading: 'Once you are in, the ladder goes flat',
      prose: [
        'So experience gets you to the door. Does it get you through the house? Here is every rung, from the teams that never made it to the teams that won the whole thing.',
      ],
      table: {
        caption: 'Experience by how far a team went (share of the season given to players who had been to October before)',
        columns: ['Team went', 'Trips to the plate', 'Innings pitched'],
        rows: [
          ['Missed the postseason (516 teams)', '47.8%', '39.1%'],
          ['Lost its first series (116 teams)', '70.7%', '61.8%'],
          ['Won a round, no Championship Series (18 teams)', '52.8%', '45.8%'],
          ['Lost the Championship Series (50 teams)', '69.0%', '60.1%'],
          ['Lost the World Series (25 teams)', '63.9%', '56.5%'],
          ['Won the World Series (25 teams)', '69.9%', '66.6%'],
        ],
      },
      proseAfter: [
        'Read the shape of that table and you have the finding. There is one big step in it — the step from the first row to the second, about twenty-two points on both sides. After that, the numbers wobble around and go nowhere. Look at the two World Series rows. The teams that LOST the World Series were LESS experienced than the teams that went home in the first round. If experience were carrying teams deeper, that row could not look like that.',
        'One row deserves a warning label. "Won a round, no Championship Series" holds only 18 teams and only exists from 2022 on, when the bracket added a wild-card round. Those are the weakest teams in the field by definition, and they are the only ones who can land on that rung. Do not read the dip as a discovery. It is the bracket, not the baseball.',
        'Two more cuts say the same thing. Among the 234 teams that reached October, the deeper you look the flatter it gets: teams that reached the Championship Series were four tenths of a point MORE experienced than the postseason teams that did not, which is a rounding error. Teams that reached the World Series were a full point LESS experienced. Neither gap is anything you could tell apart from a coin flip.',
      ],
    },
    {
      id: 'the-catch',
      heading: 'The catch, and it is a real one',
      prose: [
        'There is an obvious objection, and it deserves a straight answer. A team that went deep last October has experienced players BECAUSE it went deep last October. The experience did not make the team good. The team being good made the experience. If that were the whole story, the twenty-point gap above would just be the boring fact that good teams tend to stay good, wearing a costume.',
        'So we checked. Set aside how the same club finished the season before, and set aside how old its roster was, and the gap shrinks to about half its size — but it does not disappear. Then a harder test: measure each club only against its OWN twenty-six-year average, so that being the Yankees or being the Pirates drops out of the math entirely. The question becomes "in the years THIS club leaned more on experienced players, did THIS club get to October more often?" The answer is still yes, on both sides of the ball, at close to the same size.',
        'So it is not purely good-teams-stay-good. Something real is left over. But nothing here proves that bringing in October veterans is what causes a team to make October. That is a different claim, and this spike cannot make it.',
      ],
    },
    {
      id: 'pitchers-or-hitters',
      heading: 'Pitchers or hitters?',
      prose: [
        'The pitchers edge the hitters on almost every raw number in this spike, and the only tests that clearly clear the bar are on the pitching side. That is a tempting headline, and it matches what a couple of earlier spikes found.',
        'It does not survive a closer look. Once you account for how good the team already was and how old its roster was, the two sides land on top of each other — the leftover edge is 0.164 for pitching and 0.166 for hitting. That is a tie. Earlier entries in this notebook found a sharper split between the two sides of the ball than this one does, and it would be dishonest to sell this as another pitching story. It is not.',
      ],
    },
    {
      id: 'seeds-and-divisions',
      heading: 'Experience buys a good regular season. October then ignores the regular season.',
      prose: [
        'Hold each team\'s seed fixed — meaning, compare only teams that had roughly the same regular season — and nothing about the advancing answer changes. Experience still does not tell you who goes deeper.',
        'The interesting part is why. Experienced teams DO earn better seeds. That much is clear. But the seed itself barely predicts how far a team goes once the bracket starts. So the chain runs like this: experience helps a club win in April through September, the club banks a good record, and then October largely throws the record away. That is not a knock on experience. It is a fact about how short a postseason series is.',
        'The division-winner cut fits the same picture. Among teams that reached October, division winners were about seven points more experienced than wild-card teams — nearly ten points if you count only players who had been deep, to a Championship Series or a World Series. Winning a division is a regular-season achievement, so of course experience shows up there. It is the same finding from a different angle, not a new one.',
      ],
    },
    {
      id: 'the-lead',
      heading: 'One lead worth chasing, and it is only a lead',
      prose: [
        'Here is the one thread that did not go quiet, and we are calling it a lead on purpose, not a finding.',
        'Instead of counting anybody who ever played a postseason game, count only the players who had been in a Championship Series or a World Series before — the late rounds, not a two-day wild-card visit. Measured that way, the teams that reached the Championship Series were about seven points more experienced on both sides of the ball. That is a real-looking gap where the broader measure had none.',
        'Two things keep it from being a finding. It stops holding up as soon as you account for how old the roster was, which is a polite way of saying it may just be another way of measuring veterans. And it was one of roughly ten related ideas we tried. When you try ten things, about one of them looks good by luck alone. This is exactly the kind of result that ought to be checked fresh, on data it has never seen, before anybody believes it.',
      ],
    },
    {
      id: 'the-cases',
      heading: 'The teams at both ends',
      prose: [
        'Averages hide the good stories. Here are the teams that reached a World Series with almost nobody who had ever been to October.',
      ],
      table: {
        caption: 'Reached the World Series with almost no October experience (hitting side)',
        columns: ['Team', 'Share of trips to the plate', 'How it ended'],
        rows: [
          ['2002 Angels', '2%', 'Won the World Series'],
          ['2014 Royals', '13%', 'Lost the World Series'],
          ['2007 Rockies', '16%', 'Lost the World Series'],
          ['2010 Rangers', '16%', 'Lost the World Series'],
          ['2003 Marlins', '19%', 'Won the World Series'],
          ['2008 Rays', '20%', 'Lost the World Series'],
        ],
      },
      proseAfter: [
        'Two of those six won it all. The 2002 Angels are the cleanest answer anyone could ask for: two trips to the plate out of a hundred went to a player who had ever been in a postseason game, and they were the last team standing.',
        'And here is the other end — rosters stacked with October veterans that never got to use them:',
      ],
      points: [
        '2022 Brewers — 96% of trips to the plate, missed the postseason',
        '2021 Athletics — 96%, missed',
        '2019 Cubs — 96%, missed',
        '2009 Rays — 95%, missed',
        '2008 Yankees — 95%, missed',
        '2017 Blue Jays — 93%, missed',
      ],
    },
  ],
  caveats: [
    'Nothing here proves cause. Experienced players and winning teams travel together, and this spike cannot tell you which one is pulling. A club that goes deep in October comes back the next spring with an experienced roster automatically — it did not have to go acquire one.',
    'Only 25 teams won a World Series in the years we looked at, and only 25 lost one. That is too few teams to tell apart from each other on any number. The top of this ladder is a story about six or seven teams a decade, and it will stay too thin to settle no matter how carefully it is measured.',
    'When we say experience does not tell you how far a team goes, that is not the same as saying it makes exactly zero difference. It means that with 234 postseason teams, whatever difference exists is too small to see through the noise of October. A larger pile of seasons could still turn up something small.',
    'The late-round lead — that having been to a Championship Series or World Series before separates the teams that reach a Championship Series — is fragile. It stops holding up once roster age is taken into account, and it was one of about ten related ideas tested, which is about how many you would expect to look good by luck. Treat it as something to check, not something we found.',
    'No payroll data exists anywhere in this program, same gap as every other spike. A team that can afford to keep and buy October veterans can afford a lot of other things too, and none of them are in this measure.',
    'Experience here is a yes-or-no flag: one postseason game in one earlier year counts the same as ten Octobers. A team of eight players with one game apiece looks identical to a team of eight players with a hundred games apiece.',
    'The 18-team "won a round, no Championship Series" rung exists only from 2022 forward, and only wild-card teams can land on it. Its low number is a property of the bracket, not evidence that winning a round takes less experience.',
  ],
  open: [
    'Check the late-round lead on seasons it has never seen — either the years before 2000 or the seasons that come after this spike was run. A lead found among ten tries needs fresh data, not a rerun on the same data.',
    'Count October games, not October appearances. Does a roster with a few deeply seasoned veterans behave differently from a roster where everybody has been once?',
    'Look at experience concentrated where the pressure is: the starting rotation and the back of the bullpen, the lineup spots that bat in the late innings. A team average may be smoothing over the only place this could matter.',
    'Join this against the roster-age spike properly. Four spikes in, age, homegrown share, star diversity, and now October experience all say something about getting in and little about advancing. Whether those are four signals or one trait wearing four hats is still open.',
    'Managers and coaching staffs are not in this measure at all, only players. A club\'s October experience in the dugout is a separate question and an unasked one.',
  ],
  technical: [
    'MEASURE — `expShare` (and its league-relative twin `expShareRelative`) in .scratch/team-success/postseason-experience.json: for each team-season and each side of the ball, the share of regular-season plate appearances (hitters) or innings pitched (pitchers) credited to players with >=1 postseason game appearance in a STRICTLY EARLIER season, for any franchise. Prior-experience flags are cut off at the season boundary, so no within-season leakage is possible. The late-round variant is `deepShare` (prior LCS or World Series appearance only); `wsShare`, `expYears` and `expDepth` are the further variants built and reported in the doc.',
    '750 team-seasons, 2000-2025, 2020 excluded (60-game season, 16-team field). 234 postseason qualifiers. Outcome ladder is the standard 0-5 contender-diary ladder (missed / lost first series / won a round without reaching the LCS / lost LCS / lost WS / won WS); band counts 516 / 116 / 18 / 50 / 25 / 25.',
    'MADE-THE-POSTSEASON CUT — in league-relative terms, batting +19.7pp and pitching +20.5pp (permutation on the *Relative measure). In raw shares the same cut is 47.8% -> 68.1% batting (+20.3pp) and 39.1% -> 60.2% pitching (+21.0pp), n=516 missed / 234 made. Permutation p=0.0000 both sides (within-season shuffles). Same sign in 25/25 leave-one-season-out refits on both sides. Spearman rho vs. the full ladder: batting 0.348, pitching 0.372.',
    'ADVANCEMENT, RESTRICTED TO THE 234 QUALIFIERS — Spearman rho vs. the ladder: batting -0.017, pitching +0.023; neither distinguishable from chance. LCS+ vs. non-LCS qualifiers: batting +0.4pp, p=0.89. WS vs. non-WS qualifiers: batting -1.0pp, p=0.79. Pitching-side equivalents are the same story with slightly larger point estimates and no test clearing the conventional bar.',
    'BAND MEANS, batting: 47.8 / 70.7 / 52.8 / 69.0 / 63.9 / 69.9. Pitching: 39.1 / 61.8 / 45.8 / 60.1 / 56.5 / 66.6. The 18-team "won a round, no LCS" band is structurally post-2022 wild-card-round winners and is not comparable to the bands above it.',
    'CONFOUND CONTROLS — partial correlations against the ladder controlling for prior-season finish (same franchise) plus roster age: batting rho falls 0.348 -> 0.166, pitching 0.372 -> 0.164. Roughly half the raw signal is attributable to team-quality persistence; the remainder is not. Note the batting/pitching gap closes to nothing under controls (0.166 vs 0.164), a WEAKER side-of-the-ball split than spikes #1 and #3 reported.',
    'WITHIN-TEAM (FRANCHISE-DEMEANED) SPECIFICATION — each club measured against its own 2000-2025 mean, removing all between-franchise quality variation: batting +0.180, pitching +0.206 against the ladder. The made-it signal is therefore not purely a between-team artifact.',
    'SEED CONTROL — holding regular-season seed fixed leaves the advancement nulls unchanged. Separately: experience predicts a BETTER seed (Spearman rho vs. seed number = -0.227 batting, -0.182 pitching; negative because seed 1 is the best), while seed itself is only weakly related to ladder position among qualifiers (rho=-0.053). Mechanism reads as experience -> regular-season quality -> seed, with October largely insensitive to seed.',
    'DIVISION WINNER VS WILD CARD, among qualifiers — batting +7.1pp; late-round-experience variant +9.6pp. Directionally consistent with a regular-season mechanism.',
    'LATE-ROUND VARIANT — LCS+ vs. non-LCS qualifiers: +6.9pp batting, +7.1pp pitching, clearing the conventional bar before controls. Does NOT survive adding roster age as a control. One of ~10 related specifications tested in this spike; at that family size roughly one nominal pass is expected under the null. Flagged as a lead requiring out-of-sample confirmation, not a finding.',
    'CASE EXTREMES, batting expPA — pennant winners with minimal prior experience: 2002 Angels 0.02 (WS winner), 2014 Royals 0.13, 2007 Rockies 0.16, 2010 Rangers 0.16, 2003 Marlins 0.19 (WS winner), 2008 Rays 0.20. Non-qualifiers with maximal prior experience: 2022 Brewers 0.96, 2021 Athletics 0.96, 2019 Cubs 0.96, 2009 Rays 0.95, 2008 Yankees 0.95, 2017 Blue Jays 0.93.',
    'The experience flag is binary per player-season and is not weighted by how many prior postseason games a player accumulated; a one-game 2011 cameo and a decade of Octobers are identical to it. Depth-weighted variants are untested.',
    'No payroll covariate exists in this program. Roster age comes from spike #1\'s roster-age-cache.json; prior-season finish comes from the same ladder construction used throughout the contender diary.',
  ],
}
