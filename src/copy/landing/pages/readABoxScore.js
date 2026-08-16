// The reading companion to the scoring pillar page. Scoring is what you write;
// this is what you read afterwards.
//
// Voice: plain, dry, patient. Short sentences, active voice, no hype. The app is
// named once, in the cta, and the guidance is complete for a reader who never
// opens it.
//
// SCOPE. This page defines the columns that appear in a box score and nothing
// beyond them. Advanced statistics — WAR, wRC+, FIP, BABIP — belong to
// `/learn/stats-glossary`, and duplicating them here would put two of our own
// pages in front of the same query. Mention that they exist, then link onward.
//
// STATIC — see the SPOILER RULE note in ../schema.js. Nothing here is derived.

export default {
  slug: 'read-a-box-score',
  metaTitle: 'How to Read a Baseball Box Score and Line Score',
  metaDescription:
    'What every column in a baseball box score means — AB, RBI, IP, ER, ERA and WHIP — plus R/H/E, the X in the ninth, and why 5.2 innings pitched is five and two-thirds.',
  h1: 'How to read a baseball box score and a line score',
  keywords: [
    'how to read a baseball box score',
    'what does R H E mean',
    'baseball box score explained',
    'what is a line score',
    'what does IP 5.2 mean',
  ],
  schema: ['Article', 'DefinedTermSet', 'FAQPage'],
  updated: '2026-08-16',
  sections: [
    {
      id: 'answer',
      kind: 'answer',
      body: [
        'A baseball game is summarized twice. The line score is the strip across the top: runs scored in each inning, left to right, then three totals — R, H and E, for runs, hits and errors. The box score is everything below it, one row per player, with a hitting line for each batter and a pitching line for each pitcher. Read the line score for the shape of the game. Read the box score to see who did what.',
      ],
    },
    {
      id: 'line-score',
      kind: 'prose',
      heading: 'What is a line score, and what do R, H and E mean?',
      body: [
        'Two rows, one per team, with the visiting team on top because the visiting team bats first. Across each row are the innings, and the number in each cell is the runs that team scored in that half-inning. Nothing else goes there. Extra innings simply add columns.',
        'At the right end sit three totals, always in this order: R for runs, H for hits, E for errors. R is the final score. H will not match it, because hits do not have to score and runs do not have to come from hits.',
        'A dash or an X often appears in the home team’s ninth. It means the home team did not bat. If they already lead after the top of the ninth, there is nothing left to play for, so the cell is marked rather than filled with a 0, which would claim they batted and scored nothing.',
        'The E column misleads people. Errors are a fielding statistic. They sit beside runs and hits, but they do not change the score, and they are charged to the team in the field, not the team at bat. A team can commit three errors and win comfortably. E tells you how the defense held up, and nothing about who won.',
      ],
    },
    {
      id: 'hitters',
      kind: 'table',
      heading: 'The hitters’ columns',
      intro: 'One row per batter, in batting order, with substitutes indented under the player they replaced.',
      columns: ['Column', 'Full name', 'What it tells you'],
      rows: [
        [
          'AB',
          'At-bats',
          'Plate appearances less walks, hit by pitches, sacrifice bunts, sacrifice flies and catcher’s interference. Reaching on an error or a fielder’s choice is still an at-bat. The denominator of batting average.',
        ],
        ['R', 'Runs scored', 'Times he crossed the plate. It says nothing about how he got on base.'],
        [
          'H',
          'Hits',
          'Times he reached safely on a batted ball, without an error or a fielder’s choice. A single and a home run each count as one hit here.',
        ],
        [
          'RBI',
          'Runs batted in',
          'Runs that scored as a result of his plate appearance. A bases-loaded walk counts. There is no RBI when he grounds into a force double play, and none when the scorer judges a run scored only because of an error.',
        ],
        ['BB', 'Walks (bases on balls)', 'Four balls. He reached base, and it is neither an at-bat nor a hit.'],
        ['SO', 'Strikeouts', 'Three strikes. Sometimes printed as K.'],
        ['AVG', 'Batting average', 'Hits divided by at-bats, to three decimals. In a box score this is the season figure, not the day’s.'],
        [
          'OBP',
          'On-base percentage',
          'How often he reaches base: hits, walks and hit by pitches, over at-bats plus walks, hit by pitches and sacrifice flies. Higher than batting average for nearly every hitter.',
        ],
        [
          'SLG',
          'Slugging percentage',
          'Total bases divided by at-bats. A double counts twice a single, a home run four times. Power, not frequency.',
        ],
      ],
    },
    {
      id: 'hitters-notes',
      kind: 'prose',
      body: [
        'Under the batting table sits a block of detail lines: 2B, 3B, HR, RBI, SB, CS, GIDP, LOB, often E with the fielder named. They exist because the table collapses every hit into one H column. The 2B line names who doubled; the HR line names who homered and how many runners were on.',
      ],
    },
    {
      id: 'at-bats',
      kind: 'prose',
      heading: 'What an at-bat is not',
      body: [
        'The most common confusion in a box score is the gap between plate appearances and at-bats. A plate appearance is every trip to the plate. An at-bat is the narrower subset used as the denominator of batting average.',
        'A walk is not an at-bat. Neither is a hit by pitch, a sacrifice bunt, a sacrifice fly, nor reaching on catcher’s interference. A hitter who comes up five times, walks twice and singles once is 1-for-3, and his average goes up.',
        'The reasoning is that batting average measures what a batter did with a chance to hit, and these outcomes are either not an attempt to hit or an attempt to give himself up. It is also why the statistic understates a patient hitter, and why on-base percentage exists. OBP puts walks and hit by pitches back in, on both sides of the fraction.',
      ],
    },
    {
      id: 'pitchers',
      kind: 'table',
      heading: 'The pitchers’ columns',
      intro: 'One row per pitcher, in the order they appeared. The decision — win, loss, save, hold — is printed beside the name.',
      columns: ['Column', 'Full name', 'What it tells you'],
      rows: [
        ['IP', 'Innings pitched', 'Outs recorded, written as innings and thirds. The decimal counts outs, not tenths — see below.'],
        ['H', 'Hits allowed', 'Hits charged to him while he was in the game.'],
        ['R', 'Runs allowed', 'Every run that scored against him, earned or not.'],
        ['ER', 'Earned runs', 'The subset of those runs not caused by an error or a passed ball. Never higher than R.'],
        ['BB', 'Walks allowed', 'Bases on balls issued. Intentional walks are included, and usually noted separately below.'],
        ['SO', 'Strikeouts', 'Batters he struck out.'],
        ['HR', 'Home runs allowed', 'Home runs hit off him. Printed on its own because it is the one hit his defense could not have affected.'],
        ['ERA', 'Earned run average', 'Earned runs divided by innings pitched, times nine. A season figure, not the day’s.'],
        [
          'WHIP',
          'Walks and hits per inning pitched',
          'Walks plus hits, divided by innings pitched. Roughly how many runners he lets on. Hit by pitches and errors do not count.',
        ],
        ['P-S', 'Pitches and strikes', 'Total pitches, then how many were strikes. So 94-61 is ninety-four pitches, sixty-one of them strikes.'],
      ],
    },
    {
      id: 'innings-decimal',
      kind: 'prose',
      heading: 'What does 5.2 innings pitched mean?',
      body: [
        'An innings-pitched figure of 5.2 does not mean five and two tenths. It means five innings and two outs. The digit after the point counts outs, and an inning holds three, so it only ever takes the values 0, 1 and 2.',
        'So 5.2 is five and two-thirds innings, and 6.1 is six and one third. A pitcher who records one more out after 5.2 does not go to 5.3. He goes to 6.0.',
        'The consequence is that the decimal is not arithmetic. 5.2 plus 3.2 is not 9.4; it is nine and one third, written 9.1. Convert to outs, add, convert back. Rate statistics use the true fraction, so 5.2 innings is divided by 5.667, not by 5.2.',
      ],
    },
    {
      id: 'earned-runs',
      kind: 'prose',
      heading: 'Earned and unearned runs',
      body: [
        'A box score charges a pitcher with runs twice, in R and in ER. The idea behind the split is that a pitcher should be judged on the runs he was responsible for, not the ones his defense handed over. An unearned run is one that would not have scored had the defense played the half-inning cleanly — without an error or a passed ball.',
        'The plain case is easy to picture. A batter reaches on an error and later scores. He should have been out, so the run appears in R but not in ER, and the pitcher’s earned run average is untouched by it.',
        'Beyond that it is genuinely complicated, and it is worth saying so. Deciding which runs are earned means reconstructing the inning as it would have gone without the misplay: who would still have reached, who would still have scored, and when the third out would have come. That reconstruction has detailed rules of its own, and the official scorer makes judgement calls inside them — starting with whether a difficult play was an error at all or simply a hit. Two scorers can differ, and a ruling is sometimes changed after the game.',
        'So a pitcher’s ERA may not match the runs you watched him give up, and that is not a mistake in the box score. Because the split rests on a human decision, ER is a softer number than the ones beside it.',
      ],
    },
    {
      id: 'limits',
      kind: 'prose',
      heading: 'What does a box score not tell you?',
      body: [
        'A box score is a summary, and every summary throws something away. What it throws away is sequence.',
        'Take two batting lines from one game. The first reads 4-for-4, four singles, no runs batted in. The second reads 1-for-4 with a three-run double. By batting average the first is the better day. But four singles with nobody on base moved nothing, and one double with the bases occupied changed the game.',
        'The same applies to pitchers. Six innings and three runs hides whether the three came in a quick first-inning burst or a slow bleed in the sixth with the game on the line. Leverage is nowhere in the columns.',
        'Luck is missing too. A line drive caught at the wall and a soft ground ball that finds a gap appear as 0-for-1 and 1-for-1. Over one game that noise is loud; over a season it quiets, which is why season figures sit beside the day’s.',
        'Closing that gap is what the newer statistics are for. WAR, wRC+, FIP and BABIP account for context and for the share of an outcome a player controlled. They have their own page.',
      ],
    },
    {
      id: 'cta',
      kind: 'cta',
      heading: 'Read the box score without reading the ending',
      body: [
        'The awkward part of following a game closely is that the box score is where the score lives. Open one mid-game to check a pitcher’s line, and the final margin arrives with it.',
        'Tally shows the box score for the game you are following, with the inning totals sealed by half-inning until you tap to reveal them. You can check a hitting line or a pitch count for the innings you have reached without being told how the game ends. Season and career stat lines are not sealed, because a stat line is not a score. It is free, it runs in a browser, and it never asks you for an account.',
      ],
      linkText: 'Open tonight’s games',
      href: '/',
    },
    {
      id: 'faq',
      kind: 'faq',
      heading: 'Common questions',
      items: [
        {
          q: 'What does R H E stand for?',
          a: 'Runs, hits and errors — the three totals at the right end of the line score. R is the final score, H is the team’s hits, and E is the errors its fielders committed. E is a fielding statistic and has no direct effect on the score.',
        },
        {
          q: 'What does the X in the last inning mean?',
          a: 'The home team did not bat. If they lead after the top of the ninth, there is no reason to play the bottom half, so the cell is marked with an X or a dash instead of a 0, which would wrongly say they batted and scored nothing.',
        },
        {
          q: 'Why does a pitcher’s ERA not match the runs he allowed?',
          a: 'ERA counts only earned runs, and it is a season figure. A run that scored because of an error or a passed ball is unearned: it shows in the pitcher’s R column, not in ER, and never reaches his ERA. The official scorer decides which runs are earned, by reconstructing the inning as it would have gone without the misplay.',
        },
        {
          q: 'What is a quality start?',
          a: 'A start of at least six innings with three or fewer earned runs. No box score column says so — you read it off the IP and ER columns in the starter’s row. What the standard is worth as a measure of pitching is a question for the statistics glossary.',
        },
        {
          q: 'What is a golden sombrero?',
          a: 'Four strikeouts by one batter in a single game. It is slang, not an official statistic, so nothing is labelled — you read it off the SO column in that batter’s row. Three strikeouts is a hat trick, and five is a platinum sombrero.',
        },
      ],
    },
    {
      id: 'related',
      kind: 'related',
      heading: 'Keep going',
      items: [
        { text: 'The baseball statistics glossary', href: '/learn/stats-glossary' },
        { text: 'How to score a baseball game', href: '/learn/score-a-baseball-game' },
        { text: 'Every scorekeeping symbol, in one reference', href: '/learn/scorekeeping-symbols' },
        { text: 'How to watch baseball without spoilers', href: '/learn/watch-without-spoilers' },
      ],
    },
  ],
}
