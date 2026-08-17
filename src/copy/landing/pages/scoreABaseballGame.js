// The pillar page. Every other landing page links up to this one.
//
// Voice: a person who has kept score for years explaining it to somebody who
// has not, without ceremony. Plain sentences. No exclamation marks. The app is
// mentioned once, in the one place where it genuinely removes a chore, and the
// guidance is complete for a reader who never opens it.
//
// STATIC — see the SPOILER RULE note in ../schema.js. Nothing here is derived.

export default {
  slug: 'score-a-baseball-game',
  metaTitle: 'How to Score a Baseball Game: A Beginner’s Guide',
  metaDescription:
    'How to keep score in baseball by hand: the scorecard grid, the nine position numbers, the symbols for hits, outs and walks, and a worked half-inning to follow.',
  h1: 'How to score a baseball game',
  keywords: [
    'how to score a baseball game',
    'how to keep score in baseball',
    'baseball scorekeeping for beginners',
    'how to fill out a baseball scorecard',
  ],
  schema: ['Article', 'HowTo', 'FAQPage'],
  updated: '2026-08-16',
  sources: [
    { name: 'MLB Glossary — Scorekeeping', href: 'https://www.mlb.com/glossary/miscellaneous/scorekeeping' },
    { name: '2026 Official Baseball Rules', href: 'https://mktg.mlbstatic.com/mlb/official-information/2026-official-baseball-rules.pdf' },
  ],
  sections: [
    {
      id: 'answer',
      kind: 'answer',
      body: [
        'To score a baseball game, you write down what happened in every at-bat on a scorecard grid where each row is a spot in the batting order, one through nine, and each column is an inning. Keeping score by hand takes three things: the nine fielding positions memorized as numbers, a small set of symbols for hits, outs and walks, and something to write with. A ground ball to the shortstop who throws to first base is written 6-3. A strikeout is K. A run is a diamond filled in solid, and the runs in a column are that inning’s score. That is most of it. The rest is practice, and the practice is the enjoyable part.',
      ],
    },
    {
      id: 'why',
      kind: 'prose',
      heading: 'Why keep score at all',
      body: [
        'Nobody needs a scorecard. Every number you could write down is already on a screen somewhere, faster and more accurate than your handwriting. That is exactly why people still do it.',
        'A scorecard changes how you watch. You notice the second baseman shading toward the bag before the pitch, because you are about to have to write down where the ball went. You notice that the leadoff hitter has seen fourteen pitches in two innings, because you are counting them. You leave with an object that says you were there, in your own hand, wrong in a couple of places. Broadcasters keep score for the same reason a chef tastes food: the record is useful, but the attention is the point.',
      ],
    },
    {
      id: 'need',
      kind: 'list',
      heading: 'What you need',
      intro:
        'Four things, and only the first two are strictly required. Everything else in this guide is knowledge, not equipment.',
      items: [
        {
          text: 'A scorecard. A printed one from the team, a page from a bound scorebook, or a sheet you drew yourself. Any grid with nine numbered rows and nine or more columns will do.',
        },
        {
          text: 'A pencil, and a second pencil. Pencil makes ruling changes easy. If you choose pen, bring two fine points and use one clean strike-through for corrections.',
        },
        {
          text: 'Something firm to write on. A bound scorebook solves this. A loose card and a bare knee does not.',
        },
        {
          text: 'A way to check the lineup. This is the part that trips up new scorers, and it is worth being honest about: batting orders change, a pinch hitter arrives in the seventh, and a defensive substitution in the fifth is often announced once, quietly, over a public address system nobody can hear.',
        },
      ],
    },
    {
      id: 'grid',
      kind: 'prose',
      heading: 'How do you fill out a baseball scorecard?',
      body: [
        'Read the card as a spreadsheet. Each row is one spot in the batting order, one through nine, running down the left side. Each column is one inning, running across. The cell where a row and a column meet is one plate appearance, and inside that cell is a small diamond that stands for the four bases.',
        'One detail matters more than it looks. The row is the lineup SPOT, not the player. When a pinch hitter bats for your number-five hitter, they do not get a new row. They inherit row five, usually written on a second line inside it, and everyone who follows them in that spot for the rest of the night goes there too. This is why a scorecard can reconstruct a game hours later and a list of names cannot.',
      ],
    },
    {
      id: 'positions',
      kind: 'table',
      heading: 'The nine position numbers',
      intro:
        'Memorize these first. Almost every mark you will make on a scorecard is built out of them, and once they are automatic the rest of scoring is small.',
      columns: ['Number', 'Position', 'Abbreviation'],
      rows: [
        ['1', 'Pitcher', 'P'],
        ['2', 'Catcher', 'C'],
        ['3', 'First base', '1B'],
        ['4', 'Second base', '2B'],
        ['5', 'Third base', '3B'],
        ['6', 'Shortstop', 'SS'],
        ['7', 'Left field', 'LF'],
        ['8', 'Center field', 'CF'],
        ['9', 'Right field', 'RF'],
      ],
    },
    {
      id: 'positions-notes',
      kind: 'prose',
      body: [
        'Two things catch everyone. Shortstop is 6 and third base is 5, which feels backwards until you notice the numbers run first base, second base, third base and then double back to the shortstop. And the outfielders are numbered 7, 8, 9 from left to right as you look out from home plate, so 7 is left field, on your left in a seat behind the plate. It runs the other way for the fielders, who face back toward home.',
      ],
    },
    {
      id: 'outs',
      kind: 'prose',
      heading: 'How do you record an out?',
      body: [
        'Write the fielders who touched the ball, in the order they touched it, joined by hyphens. A ground ball to the shortstop who throws to first base is 6-3. Second baseman to shortstop to first baseman, the standard double play, is 4-6-3. A ground ball the first baseman fields and steps on the bag with himself is 3U, the U standing for unassisted.',
        'A ball caught in the air is written with the letter for how it was hit and the number of who caught it: F9 is a fly ball to right field, L4 a line drive to the second baseman, P5 a pop-up to third base. Plenty of scorers drop the letter and write plain 9. Both are in wide use and neither is wrong. Pick one and hold to it for the whole game, because a card that switches conventions in the sixth inning is a card you cannot read in the spring.',
        'Put the out number in a corner of the cell as you go: a small 1, 2 or 3. It sounds fussy and it is the single habit that most reliably keeps a new scorer from losing their place.',
      ],
    },
    {
      id: 'hits',
      kind: 'prose',
      heading: 'How do you record a hit and a run?',
      body: [
        'Draw a line from home plate along the bottom right of the diamond toward first base, and write what the hit was: 1B for a single, 2B for a double, 3B for a triple, HR for a home run. Some scorers use one, two, three or four short dashes instead of the letters, which is faster and just as clear.',
        'Then follow the runner. Every time they advance, extend the line along the next side of the diamond, and note what moved them: the number of the batter who drove them in, or SB for a stolen base, or WP for a wild pitch. When they cross the plate, fill the diamond in solid.',
        'That filled diamond is the whole system in one mark. At the end of an inning you count the filled diamonds in that column and you have the runs. At the end of the game you count the column totals and you have the score, arrived at honestly, by you.',
      ],
    },
    {
      id: 'events',
      kind: 'table',
      heading: 'The symbols you will use in the first inning',
      intro:
        'A short working set. The complete reference, including the rarer marks, is on the symbols page linked at the bottom.',
      columns: ['Mark', 'Means'],
      rows: [
        ['K', 'Strikeout, batter swung'],
        ['Backward K', 'Strikeout looking — called strike three'],
        ['BB', 'Walk (base on balls)'],
        ['IBB', 'Intentional walk'],
        ['HBP', 'Hit by pitch'],
        ['1B / 2B / 3B / HR', 'Single, double, triple, home run'],
        ['E6', 'Error charged to the shortstop'],
        ['FC', 'Fielder’s choice'],
        ['SB / CS', 'Stolen base / caught stealing'],
        ['SAC / SF', 'Sacrifice bunt / sacrifice fly'],
      ],
    },
    {
      id: 'worked',
      kind: 'prose',
      heading: 'A worked half-inning',
      body: [
        'Top of the first. The leadoff hitter grounds sharply to the shortstop, who throws to first. In row one, column one: 6-3, and a small 1 in the corner. One out.',
        'The second hitter lines a single to left field. In row two: a line from home toward first, and 1B. Some scorers add a 7 to record where it went, which is worth doing and takes no extra time.',
        'The third hitter strikes out swinging. Row three: K, and a small 2 in the corner.',
        'The cleanup hitter doubles into the right-field corner. Row four: the line out to second base, and 2B. The runner from first comes all the way around to score. Back in row two, extend that line around the diamond to home and fill it in solid, then write a small 4 beside it, because the number-four hitter drove him in.',
        'The fifth hitter pops up to the catcher. Row five: P2, and a small 3 in the corner. Side retired.',
        'One filled diamond in column one. The inning was one run, two hits, no errors, and one man left on base — and you can read all four of those facts off the page without having written any of them down as words.',
      ],
    },
    {
      id: 'cta',
      kind: 'cta',
      heading: 'Tally keeps the lineup straight so you can keep the pencil moving',
      body: [
        'The hard part of scoring by hand was never the notation. It is knowing who is actually standing in right field in the sixth inning after a double switch nobody announced clearly.',
        'Tally is a free, spoiler-safe companion for exactly that. It shows both lineups and the defense entering the half-inning before you score it. A change during the half appears in order with the play feed as you reveal each plate appearance. Later results stay sealed until you open them. It runs in a browser, installs to a phone home screen, and never asks you to enter a play — the scorecard is yours.',
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
          q: 'Do I have to use the standard symbols?',
          a: 'No. Your scorecard is a record for you, and consistency inside one game matters far more than matching anybody else. The argument for the standard marks is simply that they let another scorer read your card, and let you read a card you kept nine years ago.',
        },
        {
          q: 'Pen or pencil?',
          a: 'A 0.5 mm mechanical pencil is the easiest place to start because it fits small cells and makes corrections simple. A fine pen works too if you prefer a permanent page and use one clear correction mark.',
        },
        {
          q: 'What happens if I miss a play?',
          a: 'Mark the gap, record the new out count and occupied bases, then keep scoring. Rebuild the missing play from official play-by-play during the next pause.',
        },
        {
          q: 'How long does it take to learn?',
          a: 'About one game to be functional and about a season to stop thinking about it. Most people find the position numbers automatic within three or four innings, which is the steepest part of the whole climb.',
        },
        {
          q: 'Can I keep score of a game I am watching later?',
          a: 'Yes, and it is a good way to learn, because you can pause. The difficulty is that most baseball apps and sites show a score the moment you open them. Tally is built to hold that back until you ask for it.',
        },
      ],
    },
    {
      id: 'related',
      kind: 'related',
      heading: 'Keep going',
      items: [
        { text: 'Every scorekeeping symbol, in one reference', href: '/learn/scorekeeping-symbols' },
        { text: 'How to record baseball substitutions', href: '/learn/score-baseball-substitutions' },
        { text: 'What to do when you miss a play', href: '/learn/missed-play-scorekeeping' },
        { text: 'Choosing a baseball scorebook', href: '/learn/choose-a-scorebook' },
        { text: 'Pen or pencil for scorekeeping?', href: '/learn/pen-or-pencil-baseball-scorekeeping' },
        { text: 'Keeping score at the ballpark', href: '/learn/score-at-the-ballpark' },
        { text: 'How to read a box score', href: '/learn/read-a-box-score' },
      ],
    },
  ],
}
