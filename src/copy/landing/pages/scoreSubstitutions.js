// A focused answer to the substitution questions that recur among new paper
// scorers. The marks vary by scorebook; the lineup rules do not. Keep that
// distinction explicit so a house notation never reads like an official rule.

export default {
  slug: 'score-baseball-substitutions',
  metaTitle: 'How to Record Baseball Substitutions on a Scorecard',
  metaDescription:
    'Record pinch hitters, pinch runners, pitching changes, defensive replacements and position changes without losing the batting order.',
  h1: 'How to record baseball substitutions on a scorecard',
  keywords: [
    'how to score baseball substitutions',
    'how to record a pinch hitter on a scorecard',
    'how to record a pinch runner on a scorecard',
    'baseball scorecard pitching change',
    'defensive substitution scorebook',
  ],
  schema: ['Article', 'FAQPage'],
  updated: '2026-08-16',
  sections: [
    {
      id: 'answer',
      kind: 'answer',
      body: [
        'To record a baseball substitution, write the new player on the next available line in the same batting-order row as the player he replaces. Add the inning and the role: PH for pinch hitter, PR for pinch runner, or the fielding position for a defensive replacement. Mark the exact plate appearance or base where the change happened with a line, a note, or the substitute’s uniform number. The notation can vary, but the new player always keeps the replaced player’s spot in the batting order.',
      ],
    },
    {
      id: 'one-rule',
      kind: 'prose',
      heading: 'The one rule that keeps every substitution straight',
      body: [
        'Follow the batting-order spot, not the fielding position. A player who enters at shortstop does not automatically go into the starting shortstop’s row. Put him in the batting-order row of the player he replaced, even if that player had played a different position. In Major League Baseball, a removed player cannot return to the game.',
        'Most scorebooks give each batting-order spot two or three name lines. Put every substitute in that small stack. If the row is full, continue in the margin and use a clear arrow back to the correct batting-order spot. Do not create a tenth batting-order row.',
      ],
    },
    {
      id: 'method',
      kind: 'list',
      heading: 'A simple four-step method',
      items: [
        { text: 'Write the substitute directly below the player he replaces, inside the same batting-order row.' },
        { text: 'Label how he entered: PH, PR, a fielding position, or P for a new pitcher.' },
        { text: 'Write the inning. Add T or B if you need to distinguish the top from the bottom.' },
        { text: 'Mark the first plate appearance, base, or defensive inning that belongs to the substitute.' },
      ],
    },
    {
      id: 'types',
      kind: 'table',
      heading: 'What to write for each kind of change',
      columns: ['Change', 'Lineup entry', 'Mark on the card'],
      rows: [
        ['Pinch hitter', 'New name below the replaced player', 'PH plus the inning; draw a vertical line before his first plate appearance'],
        ['Pinch runner', 'New name below the runner he replaces', 'PR plus the inning; write his number beside the base where he entered'],
        ['Defensive replacement', 'New name in the batting-order spot he inherits', 'New position plus the inning he takes the field'],
        ['Position change', 'Keep the same player in the same row', 'Add the new position and the inning beside his name'],
        ['Pitching change', 'New pitcher in the pitchers section', 'Mark the first batter he faces; if he enters mid-plate appearance, write the inherited count'],
        ['Double switch', 'Two new names in two existing batting-order rows', 'Record both new positions and the same inning'],
      ],
    },
    {
      id: 'pinch-runner',
      kind: 'prose',
      heading: 'How do you show a pinch runner after a hit?',
      body: [
        'Leave the hit in the original batter’s cell. The batter earned the hit and the pinch runner did not. Write the pinch runner’s uniform number beside the base where he entered, or draw a short line across that base path and label it PR. Continue the remaining base path in the same cell.',
        'If the pinch runner later scores, credit the run to the pinch runner in the player totals. The original batter still gets the hit. One scorecard cell can therefore contain events credited to two players, which is why the substitution mark belongs at the exact base where the runner changed.',
      ],
    },
    {
      id: 'pitching-change',
      kind: 'prose',
      heading: 'How do you mark a pitching change?',
      body: [
        'Write the reliever on a new line in the pitchers section. On the batting grid, draw a line at the first batter he faces. If he enters between batters, put the line before that batter’s cell. If he enters during a plate appearance, note the inherited count inside that batter’s cell instead of implying that one pitcher faced the entire batter.',
        'A reliever who enters during a plate appearance inherits the count. If the batter later walks after the change came at 2–0, 2–1, 3–0, 3–1, or 3–2, the walk and that batter are charged to the preceding pitcher. At the other counts, and for any result other than a walk, they are charged to the reliever. Record the count so the pitching line can be reconstructed correctly.',
      ],
    },
    {
      id: 'defense',
      kind: 'prose',
      heading: 'How do you record several defensive changes at once?',
      body: [
        'Protect the next play first. Write only the new names and positions, then resume scoring. Add the inning details during the next pause. A clean temporary note is better than missing a plate appearance while you try to make every row perfect.',
        'When players move between positions, keep them in their original batting-order rows. Add each new position beside the player’s name. The batting order stays fixed even when the defense moves around the field.',
      ],
    },
    {
      id: 'official-vs-personal',
      kind: 'prose',
      heading: 'Official rule, personal notation',
      body: [
        'Baseball rules decide who entered, who left, and which batting-order spot the substitute occupies. They do not require fans to use one scorecard symbol. Some scorers use heavy lines, some use colors, and some write only the inning beside each new name.',
        'Choose one system that lets you answer three questions later: who entered, whom did he replace, and when did the change take effect? If your card answers all three, the notation works.',
      ],
    },
    {
      id: 'cta',
      kind: 'cta',
      heading: 'See the change without losing your place',
      body: [
        'Substitutions are hardest at the ballpark, where an announcement can disappear under crowd noise.',
        'Tally shows both lineups and the defense entering the half-inning before you score it. A change during the half appears in order with the play feed as you reveal each plate appearance. Later results stay sealed until you open them.',
      ],
      linkText: 'Open today’s games',
      href: '/',
    },
    {
      id: 'faq',
      kind: 'faq',
      heading: 'Common questions',
      items: [
        {
          q: 'Does a pinch hitter change the batting order?',
          a: 'No. The pinch hitter takes the batting-order spot of the player he replaces. If he stays in the game on defense, he continues to bat in that same spot even if his fielding position differs from the removed player’s position.',
        },
        {
          q: 'Who gets the run when a pinch runner scores?',
          a: 'The pinch runner gets the run because he crossed home plate. The player who reached base keeps the hit, walk, hit by pitch, or other result that put him there before the substitution.',
        },
        {
          q: 'What if an announced pinch hitter is replaced before batting?',
          a: 'Record both players. The official score report lists the first player as announced even if a second pinch hitter replaces him before he enters the batter’s box. The first announced player is then unavailable for later use. Put the second pinch hitter below him in the same batting-order row, and note that the first was announced but had no plate appearance.',
        },
        {
          q: 'Must I track every defensive position change?',
          a: 'No. A personal scorecard can record only what matters to you. If you want a complete fielding record, note every change. If you mainly want the story of each plate appearance, record new players and add position changes when they affect a play.',
        },
      ],
    },
    {
      id: 'related',
      kind: 'related',
      heading: 'Keep going',
      items: [
        { text: 'Baseball scorekeeping symbols and position numbers', href: '/learn/scorekeeping-symbols' },
        { text: 'How to score a baseball game', href: '/learn/score-a-baseball-game' },
        { text: 'How to recover when you miss a play', href: '/learn/missed-play-scorekeeping' },
        { text: 'Keeping score at the ballpark', href: '/learn/score-at-the-ballpark' },
      ],
    },
  ],
}
