// The reference page. Dense with definitions on purpose — a glossary is read in
// fragments, so every row has to stand alone.
//
// Voice: a beat writer explaining the numbers to a reader who already likes
// baseball. Dry, patient, no evangelism about advanced statistics and no
// condescension toward anybody who prefers the old ones.
//
// SCOPE. This page defines STATISTICS. Scorekeeping notation — K, 6-3, F9, the
// nine position numbers — belongs to /learn/scorekeeping-symbols and must not be
// duplicated here; the two pages would compete for the same queries and split
// them. Where a reader wants notation, this page links out.
//
// NO SEASON-SPECIFIC NUMBERS. Scales are bands, never league leaders and never a
// current figure. A number that dates the page is a number that makes it wrong
// next April. Formulas with era-specific constants are described, not printed,
// for the same reason.
//
// STATIC — see the SPOILER RULE note in ../schema.js. Nothing here is derived.

export default {
  slug: 'stats-glossary',
  metaTitle: 'Baseball Stats Glossary: WAR, OPS, wRC+, FIP and More',
  metaDescription:
    'What every common baseball statistic measures and what counts as good — AVG, OPS, wRC+, ERA, FIP, WAR, exit velocity and more, in plain language.',
  h1: 'Baseball stats glossary',
  keywords: [
    'what is WAR in baseball',
    'what is OPS',
    'wRC+ explained',
    'baseball advanced stats glossary',
    'what is a good OPS',
    'what is FIP',
  ],
  schema: ['Article', 'DefinedTermSet', 'FAQPage'],
  updated: '2026-08-16',
  sources: [
    { name: 'MLB Glossary — Standard and advanced statistics', href: 'https://www.mlb.com/glossary' },
    { name: 'FanGraphs Library — WAR', href: 'https://library.fangraphs.com/misc/war/' },
    { name: 'FanGraphs Library — wRC and wRC+', href: 'https://library.fangraphs.com/offense/wrc/' },
  ],
  sections: [
    {
      id: 'answer',
      kind: 'answer',
      body: [
        'Baseball statistics come in three families, and knowing which family a number belongs to is most of reading it. Counting stats add up what happened — hits, home runs, innings. Rate stats divide that total by the opportunity it took, which is how batting average and earned run average work. Adjusted stats put a rate in the context of its era and its ballpark, so numbers from different decades can be compared; wRC+, OPS+ and ERA+ all do this, and all set league average at 100. WAR sits on top of the other three and tries to answer one question in one number: how many more games did a team win with this player than it would have won with a freely available replacement in his place?',
      ],
    },
    {
      id: 'families',
      kind: 'prose',
      heading: 'How do you read any baseball statistic?',
      body: [
        'A counting stat rewards playing time: thirty home runs beats twenty, but the second player may have missed two months. A rate stat divides to fix that — hits per at-bat, earned runs per nine innings. Rates compare a part-time player to a regular, but they get noisy in small samples.',
        'An adjusted stat asks what a rate was worth where it happened, since runs are not equally easy to score in every season or park. Numbers with a plus — OPS+, wRC+, ERA+ — set league average at 100, and higher is better. Numbers with a minus — ERA-, FIP- — use the same baseline but measure cost, so lower is better. That sign is the most common misreading here.',
        'So check whether a number is adjusted before you compare anything with it. An unadjusted rate from a pitcher’s era and one from a hitter’s era are not comparable, and care about the decimals will not make them so.',
      ],
    },
    {
      id: 'hitting',
      kind: 'table',
      heading: 'Hitting statistics',
      intro:
        'The scales are rough on purpose, and they shift with the run environment.',
      columns: ['Statistic', 'What it measures', 'Rough scale'],
      rows: [
        [
          'AVG (batting average)',
          'Hits per official at-bat; walks are not at-bats.',
          '.250 average, .280 good, .300 very good, .320 leads leagues.',
        ],
        [
          'OBP (on-base percentage)',
          'How often a hitter reaches base, with walks and hit by pitches counted.',
          '.320 average, .360 good, .400 a top season.',
        ],
        ['SLG (slugging percentage)', 'Total bases per at-bat: how far, not how often.', '.400 average, .480 good, .550 real power.'],
        [
          'OPS',
          'On-base plus slugging. Crude — the halves use different scales.',
          '.720 average, .800 good, .900 an All-Star season, 1.000 rare.',
        ],
        [
          'OPS+',
          'OPS adjusted for park and league.',
          '100 average, higher better. 120 good, 140 star, 160 award-level.',
        ],
        [
          'wOBA (weighted on-base average)',
          'Each way of reaching base at its run value, on the OBP scale.',
          '.320 average, .350 good, .400 elite.',
        ],
        [
          'wRC+ (weighted runs created plus)',
          'Offensive value per plate appearance, adjusted for park and league. The most complete hitting number in use.',
          '100 average, higher better. 120 good, 140 star, 160 tops the league.',
        ],
        ['ISO (isolated power)', 'Extra bases per at-bat — slugging without the singles.', '.150 average, .200 a power hitter, .250 elite.'],
        [
          'BABIP',
          'Hits per ball in fair play, minus home runs and strikeouts. See below.',
          'Near .300 league-wide; individuals hold .260 to .350 as a real level.',
        ],
        [
          'K% (strikeout rate)',
          'Strikeouts as a share of plate appearances.',
          'Lower better. 22 percent typical, under 15 excellent, over 30 a problem.',
        ],
        ['BB% (walk rate)', 'Walks as a share of plate appearances.', '8 percent typical, 12 very good, 15 elite.'],
      ],
    },
    {
      id: 'pitching',
      kind: 'table',
      heading: 'Pitching statistics',
      intro:
        'Pitching scales move with the run environment. A 4.00 ERA has been below average in some decades and above it in others.',
      columns: ['Statistic', 'What it measures', 'Rough scale'],
      rows: [
        [
          'ERA (earned run average)',
          'Earned runs per nine innings. Runs that scored on an error are excluded, so a scorer’s judgement is in it.',
          'Lower better. 4.00 typical for a starter, 3.50 good, 3.00 excellent.',
        ],
        [
          'ERA+',
          'ERA adjusted for park and league. Higher is better — the opposite of raw ERA and of ERA-.',
          '100 average, 120 good, 150 an ERA about two-thirds of league average.',
        ],
        [
          'FIP (fielding independent pitching)',
          'What an ERA would be with league-average results on balls in play, counting only strikeouts, walks, hit batters and home runs.',
          'On the ERA scale. A FIP well under the ERA suggests weak defence or bad luck behind him.',
        ],
        [
          'xFIP',
          'FIP with home runs replaced by what an average pitcher allows on the same fly balls, since home run rate swings year to year.',
          'On the ERA scale. Flags a home run rate likely to normalise.',
        ],
        ['WHIP', 'Walks and hits per inning: runners put on. Hit batters and men who reach on an error do not count.', 'Lower better. 1.30 typical, 1.15 good, under 1.00 outstanding.'],
        [
          'K/9',
          'Strikeouts per nine innings. Strikeout percentage is better: it counts batters faced.',
          '8.5 typical for a starter, 10 good, 12 a weapon.',
        ],
        ['BB/9', 'Walks per nine innings — the shorthand for control.', 'Lower better. 3.0 typical, under 2.0 very good, over 4.5 a problem.'],
        ['K/BB', 'Strikeouts divided by walks.', '2.5 typical, 4.0 very good, 6.0 exceptional.'],
        ['HR/9', 'Home runs allowed per nine innings. Volatile and park-dependent.', 'Lower better. Near 1.2 typical, under 0.9 good.'],
        [
          'IP (innings pitched)',
          'Innings completed, in thirds: 6.1 is six innings and one out.',
          '180 is a full modern starter’s season; 200 is heavy and now rare.',
        ],
        [
          'QS (quality start)',
          'Six or more innings, three or fewer earned runs. Its floor is a 4.50 ERA — the standard objection.',
          '20 or more is solid. Good for durability, weak for quality.',
        ],
      ],
    },
    {
      id: 'fielding',
      kind: 'table',
      heading: 'Fielding, batted ball and situational statistics',
      intro:
        'Three sources: human charting, ball-tracking cameras, and win-probability models. The fielding numbers disagree with each other more than hitting numbers do.',
      columns: ['Statistic', 'What it measures', 'Rough scale'],
      rows: [
        [
          'WAR (wins above replacement)',
          'Everything a player did, converted to runs, adjusted for park and league, then expressed as wins above a replacement-level player.',
          '2 a solid regular, 4 an All-Star season, 6 an award candidate.',
        ],
        [
          'DRS (defensive runs saved)',
          'Runs saved against an average fielder, from human charting: range, errors, arm, double plays.',
          'Zero average. Plus 10 very good, plus 20 elite, minus 10 costly.',
        ],
        [
          'OAA (outs above average)',
          'A tracking-camera count of outs made against an average fielder, given the distance and direction he had to cover, the time he had, and where he started.',
          'Zero average, plus 10 outs excellent. Often converted to runs.',
        ],
        [
          'UZR (ultimate zone rating)',
          'An older zone-based measure in runs, on the same charted data as DRS but weighted differently, so the two often disagree.',
          'Zero average. Usually quoted as UZR/150, scaled to a full season.',
        ],
        [
          'Exit velocity',
          'How fast the ball leaves the bat. Hardest-hit balls predict better than the average.',
          'Near 89 mph league-wide; above 92 marks a strong hitter.',
        ],
        [
          'Launch angle',
          'The vertical angle off the bat: ground balls low, line drives in the teens, fly balls higher.',
          'Roughly 8 to 32 degrees is productive. No single best figure.',
        ],
        [
          'Barrel rate',
          'The share of batted balls in the exit velocity and launch angle combination that historically produced at least a .500 average and 1.500 slugging. It starts at 98 mph, and the qualifying angle range widens as the ball is hit harder.',
          '7 to 8 percent typical, 12 very good, above 15 elite.',
        ],
        [
          'Hard-hit rate',
          'The share of batted balls struck at 95 mph or more. Ignores angle, so it settles faster than barrel rate.',
          '38 percent typical, above 45 a strong contact profile.',
        ],
        [
          'Spin rate',
          'Revolutions per minute, which shapes a pitch’s path. High spin is not automatically good: it interacts with spin axis and pitch type.',
          'Fastballs commonly 2,200 to 2,400 rpm, breaking balls higher.',
        ],
        [
          'WPA (win probability added)',
          'How much each play moved the chance of winning, added up. A story, not a forecast.',
          'Zero neutral. Relievers used in close games collect it fastest.',
        ],
        [
          'Leverage index',
          'How much rides on the situation: score, inning, outs, baserunners.',
          '1.0 average, above 2.0 high leverage, below 0.85 low.',
        ],
      ],
    },
    {
      id: 'war',
      kind: 'prose',
      heading: 'What is WAR in baseball, and why do two sites disagree?',
      body: [
        'WAR is not one statistic. It is a recipe, and the two best-known kitchens use different ones. Baseball-Reference publishes bWAR, FanGraphs publishes fWAR, and for the same player they usually print different numbers.',
        'The largest split is pitching. Baseball-Reference starts from the runs a pitcher actually allowed, then adjusts for the defence behind him, the parks and the opponents. FanGraphs starts from FIP, so it credits a pitcher only for outcomes fielders had no part in. A pitcher who allowed fewer runs than his strikeout and walk numbers suggest looks better at Baseball-Reference. The two also use different fielding inputs, so a shortstop can sit several runs apart. Neither is wrong; a disagreement is information about the player.',
        'One rule follows. A gap of about a win between two players is inside the noise — smaller than the gap between the two published versions of the same player. WAR sorts players into broad groups. It does not rank two players a few tenths apart.',
      ],
    },
    {
      id: 'babip',
      kind: 'prose',
      heading: 'BABIP, and the word “lucky”',
      body: [
        'BABIP is batting average on balls in play: how often a ball hit into fair play became a hit, leaving out home runs and strikeouts. League average sits close to .300, and that stability is why anybody far from it gets called lucky or unlucky and the conversation stops there.',
        'That reading fits pitchers better than hitters. Most pitchers have limited control over what happens once a ball is in play, so a starter with an unusually low BABIP has often been helped by his defence, and he tends to drift back toward normal. FIP is built on that reasoning.',
        'For hitters the claim is much weaker. Individual hitters carry real, repeatable levels, driven by speed, which turns choppers into infield hits; by line-drive rate, since line drives fall in more often than anything else; and by contact quality. Hitters with all three have held marks above .350 across whole careers. That is not a decade of good fortune.',
        'So a high BABIP supports a hypothesis, not a verdict. Check the batted-ball evidence beside it, and whether the same level appeared in earlier seasons. A mark that has held for four years describes a player.',
      ],
    },
    {
      id: 'cta',
      kind: 'cta',
      heading: 'See these numbers in context, all season',
      body: [
        'Tally is a free, spoiler-safe baseball companion. Player and team pages carry these statistics with percentile context beside them, so a figure reads as good or ordinary without your remembering the bands above.',
        'Stat lines are never sealed there. A season line is not a score. Only what would tell you how tonight’s game is going stays covered until you ask.',
      ],
      linkText: 'Browse the leader boards',
      href: '/leaders',
    },
    {
      id: 'faq',
      kind: 'faq',
      heading: 'Common questions',
      items: [
        {
          q: 'What is a good OPS?',
          a: 'Around .800 is a good season, .900 and up is an All-Star year, and 1.000 is rare enough to lead a league. League average sits near .720 and moves with the run environment, so the same .800 is worth more in a low-scoring year. For a number that accounts for that, use OPS+ or wRC+.',
        },
        {
          q: 'Why do two sites list different WAR values for the same player?',
          a: 'Because WAR is a recipe, not a measurement. Baseball-Reference builds from the runs a pitcher allowed, adjusted for the defence behind him; FanGraphs builds from strikeouts, walks and home runs. Their fielding inputs differ too. Treat a gap of about a win as noise, not a ranking.',
        },
        {
          q: 'What is the difference between ERA and FIP?',
          a: 'ERA counts the earned runs that actually scored, which depends on the fielders behind the pitcher and on when the hits arrived. FIP estimates what that ERA would have been with league-average results on balls in play, counting only strikeouts, walks, hit batters and home runs. A large gap points at defence, sequencing or home run rate.',
        },
        {
          q: 'Is a high BABIP luck?',
          a: 'Sometimes, and more often for pitchers than hitters. Pitchers have limited control over balls in play, so an extreme BABIP usually moves toward league average. Hitters differ: speed, line-drive rate and hard contact let some hold marks well above average for a career.',
        },
        {
          q: 'Do I need advanced stats to enjoy baseball?',
          a: 'No. This is a reference, not a prerequisite. People watched this game for a century with batting average and ERA, and those still tell you something true. The advanced numbers help when you compare players across parks and eras. Look one up when you are curious.',
        },
      ],
    },
    {
      id: 'related',
      kind: 'related',
      heading: 'Keep going',
      items: [
        { text: 'How to read a box score', href: '/learn/read-a-box-score' },
        { text: 'How to score a baseball game', href: '/learn/score-a-baseball-game' },
        { text: 'Every scorekeeping symbol, in one reference', href: '/learn/scorekeeping-symbols' },
        { text: 'Watching a game later without spoilers', href: '/learn/watch-without-spoilers' },
      ],
    },
  ],
}
