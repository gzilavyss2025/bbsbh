// Diary entry — the first of the player-side spikes. Everything before it asked
// about organizations. This one asks about the man.
//
// The finding it turns on is not a trait at all. It is that "a good rookie
// season" has two ordinary meanings, they disagree about a third of the time,
// and the minor-league history behind each one is different. That has to lead,
// because a reader who takes only the second half of this entry away will end
// up quoting a number about the wrong question.
export const rookieTraitsEntry = {
  id: 'rookie-season-traits',
  date: '2026-08-24',
  source: 'PR #891',
  doc: 'docs/prospect-traits.md',
  title: 'What a good rookie season looks like from the minors',
  verdict: 'holds',
  question:
    'A kid comes up in June and has a real year. Look back at his time in the minors — is there anything there you could have seen coming?',
  headline:
    'Some. But first you have to say what a good rookie season is, and the two obvious answers turn out to be two different questions. Ask who hit well and the answer is the big men. Ask who was worth something and the answer is the fast movers. They are not the same players. They agree about three times in five.',
  sections: [
    {
      id: 'two-definitions',
      heading: 'The two ways of saying "good", and why they part company',
      prose: [
        'One way is the rate. Did he hit, or did he keep runs off the board, measured against the league he played in that summer. The other is value: what the season was worth once playing time and defense and everything else are counted — the number a front office uses.',
        'A man can clear one bar and miss the other, and plenty do. A reliever with a shiny earned-run average in fifty innings has a lovely rate and is worth close to nothing. A shortstop who plays every day and hits a shade below average is worth a great deal.',
      ],
      table: {
        caption: '1,673 rookie seasons, sorted by both bars at once',
        columns: ['', 'Worth two wins or more', 'Worth less than that'],
        rows: [
          ['Hit better than the league', '206', '607'],
          ['Hit worse than the league', '27', '833'],
        ],
        note: 'They agree on 62 percent. Nearly every valuable rookie also hit well — 206 of 233 — but only a quarter of the men who hit well were worth two wins. Value is much the harder bar.',
      },
    },
    {
      id: 'rate-answer',
      heading: 'Ask who hit well, and the answer is the size of the man',
      prose: [
        'Two things separate the hitters who beat the league as rookies from the ones who did not, and neither is a surprise. How well they had hit at Double-A and Triple-A. And how they had ranked against everybody else at their last stop. That is the sport working as advertised.',
        'The third thing is weight, and it is nearly as big as the first two. The men who hit are heavier — 215 pounds against 202. Height rides along and then falls away entirely once weight is accounted for. This is mass, not stature.',
        'The obvious objection is that it is really about position, since the heavy men are the men at the corners. Hitting five percent better than the league is a poor year for a first baseman and a fine one for a shortstop. So the whole thing was run again inside each position group, where a heavy shortstop is only measured against other shortstops.',
      ],
      table: {
        caption: 'Rookie-year hitting, by weight, within position group',
        columns: ['Position', 'Lightest third', 'Middle third', 'Heaviest third'],
        rows: [
          ['Catcher', '200 lb → 92', '220 lb → 94', '235 lb → 94'],
          ['Middle infield, centre field', '180 lb → 91', '195 lb → 93', '210 lb → 97'],
          ['Corners', '195 lb → 98', '215 lb → 103', '230 lb → 105'],
        ],
        note: 'A hundred is league average. The pattern holds inside every group, and it is steepest where the bat matters most.',
      },
      proseAfter: [
        'And now the deflation, in the same breath, because it belongs there. All of that weight is worth about a tenth of a win. The heavy corner outfielder gives back with his glove and his legs roughly what he adds with the bat. He looks better in the box score. He is not worth much more.',
      ],
    },
    {
      id: 'war-answer',
      heading: 'Ask who was worth something, and the answer is who got there fast',
      prose: [
        'Change the bar to value and the size finding vanishes — 210 pounds against 206, which is nothing at all. What comes up instead is speed. The rookies worth two wins had spent a year less in the minors and three hundred fewer trips to the plate, were eight months younger on debut day, and had spent noticeably less time at Triple-A.',
        'That is the same shape the earlier work found from the other direction, where the fastest third of graduates were worth about a win more over six seasons and went bust a third less often.',
        'Read it as a description, not as advice. Nobody ever made a player better by rushing him. Clubs move the men who are already too good for the level, and men who are too good for Double-A tend to be good in the majors.',
      ],
    },
    {
      id: 'pitchers',
      heading: 'The pitchers produced a contradiction, and it was worth chasing',
      prose: [
        'The first pass said an older pitching debutant posts a better rate line and a worse season by value. Both of those cannot be a fact about age.',
        'They are a fact about the bullpen.',
      ],
      table: {
        caption: 'Rookie pitchers, by role',
        columns: ['', 'Median debut age', 'Rate against the league', 'Value'],
        rows: [
          ['Starters', '24.1', '93 to 98', '0.5 to 0.8 wins'],
          ['Relievers', '25.3', '108 to 128', '0.2 wins'],
        ],
      },
      proseAfter: [
        'Relievers come up later, throw fifty innings, post a handsome earned-run average and are worth almost nothing. Put the man\'s role into the picture and the age effect disappears completely, while role carries thirteen points of rate and a quarter of a win.',
        'There was never an age paradox. There was a question nobody had asked about what kind of pitcher we were talking about.',
      ],
    },
  ],
  caveats: [
    'Everybody in this study reached the majors and stuck. So nothing here can say a trait MAKES a good rookie — the heavy corner outfielders who never got out of Double-A are not in the data, and they are exactly who a claim like that would need. What can be said is narrower and it is what is said above: among men who all made it, these are the histories that separate the good rookie years from the poor ones.',
    'The rate measures are crude. They hold a man up against the raw league line with no adjustment for his ballpark, which flatters a hitter in Denver and punishes one in San Diego. A park correction would move individual players around; it is unlikely to move a pattern this size, but it was not done.',
    'Weight is whatever the league currently lists a player at, not what he weighed in the minors. For a man who retired in 2014 it is his last listed number. That is the wrong ruler read at the wrong time, and nothing inside this data can repair it.',
    'A quarter of these players have no draft record at all because they signed as teenagers out of Latin America. They currently sit in the same box as a handful of veterans who came over from Japan — two very different groups in one box, the same gap the level-tenure work flagged and nobody has closed.',
  ],
  open: [
    'The size finding is the one worth pushing on, because there is a cheap version of the missing half: minor leaguers who never graduated still have listed heights and weights. Line the heavy men who made it up against the heavy men who did not, and you would learn whether size is a real edge or just what a club looks for when it decides who gets the at-bats.',
  ],
  technical: [
    'Cohort: MLB debuts 2010–2023 past the 130 AB / 50 IP threshold, rookie season within two years of the debut — 2,059 players; 1,673 with ≥150 PA or ≥40 IP in the rookie season. Rookie season = the season containing rookieUntil.',
    'Rate = OPS/leagueOPS × 100 (hitters), leagueERA/ERA × 100 (pitchers), league lines summed from /api/v1/teams/stats per season. Value = FanGraphs season WAR from public/data/war-history.',
    'Trait separation: Mann-Whitney U with tie correction, Benjamini-Hochberg across 14 traits per comparison. Hitters by rate: AA+AAA OPS d=0.57, last-level peer percentile d=0.54, weight d=0.49, height d=0.35 (all q<0.0001).',
    'Weight survives position control: +3.49 points of rate per SD (p<0.0001) with position-group dummies; height −0.44 (p=0.45). On WAR the same term is +0.111 (p=0.052).',
    'Pitcher role: start share carries −13.3 rate points per SD (p<0.0001) and +0.243 WAR per SD (p<0.0001); the age term on rate moves from +1.56 to −1.88 and is not significant either way.',
    'Definition agreement: the 1,673 rookie seasons cross-classified on rate index >100 against season WAR ≥2.0 agree in 62% of cases (206 + 833). Of 233 two-win rookie seasons, 206 also cleared the rate bar; of 813 rate-clearing seasons, only 206 reached two wins.',
    'Fast-mover gap on the WAR bar: about one fewer minor-league season, ~300 fewer minor-league PA, ~8 months younger at debut, and less Triple-A service. Weight on this bar is 210 vs 206 lb and does not separate.',
    'The position-group table reports, per weight tercile within the group, the tercile\'s typical listed weight against its typical rate index (100 = league average).',
    'Pitcher roles: median debut age 24.1 (starters) vs 25.3 (relievers); rate index 93–98 vs 108–128; WAR 0.5–0.8 vs 0.2.',
  ],
}
