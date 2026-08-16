// Equipment advice for the repeated "what do you write with?" question. It
// gives selection criteria, not affiliate recommendations or a single winner.

export default {
  slug: 'pen-or-pencil-baseball-scorekeeping',
  metaTitle: 'Pen or Pencil for Baseball Scorekeeping?',
  metaDescription:
    'Choose a pen or pencil for a baseball scorebook by line width, paper, correction needs and writing feel. Includes a simple ballpark kit.',
  h1: 'Pen or pencil for baseball scorekeeping?',
  keywords: [
    'pen or pencil baseball scorekeeping',
    'best pencil for baseball scorebook',
    'best pen for baseball scorekeeping',
    'baseball scorekeeping supplies',
    'what to bring to keep score at a baseball game',
  ],
  schema: ['Article', 'FAQPage'],
  updated: '2026-08-16',
  sections: [
    {
      id: 'answer',
      kind: 'answer',
      body: [
        'Use a 0.5 mm mechanical pencil if you are new to baseball scorekeeping: it fits small cells, needs no sharpener, and lets you correct a ruling or a crowded substitution. Use a fine ballpoint or gel pen if you already know your notation and want a permanent page. The best tool is the one that writes a clean line on your scorebook’s paper without smearing or showing through. Test it on a back page before the game, and always bring a spare.',
      ],
    },
    {
      id: 'comparison',
      kind: 'table',
      heading: 'Pencil and pen compared',
      columns: ['Tool', 'Best for', 'Trade-off'],
      rows: [
        ['0.5 mm mechanical pencil', 'Beginners, small cells and frequent corrections', 'Light marks can fade or smudge'],
        ['0.7 mm mechanical pencil', 'Larger cells and a darker, stronger line', 'Can crowd a compact scorecard'],
        ['Fine ballpoint pen', 'Fast, permanent scoring with little drying time', 'A changed ruling needs a correction mark'],
        ['Fine gel pen', 'Dark, smooth lines and color coding', 'Some inks smear or bleed on thin paper'],
        ['Erasable pen', 'Pen feel with limited correction', 'Heat and friction can affect the ink; test the paper first'],
        ['Wooden pencil', 'A traditional feel and flexible line weight', 'Needs a sharpener and changes width as the point wears'],
      ],
    },
    {
      id: 'why-pencil',
      kind: 'prose',
      heading: 'Why pencil is the safest first choice',
      body: [
        'A scorecard changes as the game becomes clear. The official scorer can change a hit to an error. A stadium announcement can correct a substitution. You can also discover that your first mark left no room to record both outs in a double play. Pencil lets you repair the record without turning one cell into a map of crossed-out ink.',
        'A mechanical pencil keeps the same line width through nine innings. A 0.5 mm point suits most printed cards. Move to 0.7 mm if you press hard, break lead often, or use a scorebook with large cells.',
      ],
    },
    {
      id: 'why-pen',
      kind: 'prose',
      heading: 'Why choose a pen?',
      body: [
        'Pen produces a dark, permanent record and never needs sharpening. It also makes a finished book feel like a game artifact instead of a worksheet. A fine point matters more than the brand. Thick ink fills the corners where outs, runs, and runner advances must share one cell.',
        'Pen does not require a perfect card. Use one clean strike-through for a correction and write the new ruling beside it. A readable correction preserves the story of the game better than a torn page or a patch of correction fluid.',
      ],
    },
    {
      id: 'colors',
      kind: 'prose',
      heading: 'Should you use several colors?',
      body: [
        'Color can make a dense page easier to scan. One simple system uses one color for ordinary results, one for outs, and one for unusual advances or substitutions. More colors also create more decisions while the ball is live.',
        'Start with one writing tool. Add a second color only after you can explain what that color always means. Consistency helps more than decoration.',
      ],
    },
    {
      id: 'ballpark-kit',
      kind: 'list',
      heading: 'A small ballpark scorekeeping kit',
      items: [
        { text: 'Two identical pencils or pens. A backup prevents one broken point from costing a plate appearance.' },
        { text: 'A separate eraser if you use pencil. Small mechanical-pencil erasers disappear quickly.' },
        { text: 'One rubber band or clip to control loose pages in the wind.' },
        { text: 'A small plastic bag for a sudden shower or a wet cup holder.' },
        { text: 'Your notation key on a bookmark or the inside cover until the symbols become automatic.' },
      ],
    },
    {
      id: 'cta',
      kind: 'cta',
      heading: 'Keep the phone out of the scorebook',
      body: [
        'Tally is a companion for paper scoring, not a replacement for it. Use it to check the lineup, substitutions, and defensive alignment while your scorebook stays in your hands.',
        'Every inning total stays sealed until you tap, so the reference does not tell you the result before you record it.',
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
          q: 'What pencil size is best for a baseball scorebook?',
          a: 'Start with a 0.5 mm mechanical pencil. It is narrow enough for most scorecard cells and common enough to replace anywhere. Use 0.7 mm if your book has larger cells or you break thin lead often.',
        },
        {
          q: 'What point size should I use for a scorekeeping pen?',
          a: 'Use the finest point that writes cleanly on your scorebook paper without scratching or skipping. Test it on a back page because point labels and actual line widths vary by pen and paper.',
        },
        {
          q: 'Are erasable pens good for scorekeeping?',
          a: 'They can be, especially if you like dark lines but still want corrections. Test the ink on your exact paper. Friction and high heat can make some erasable ink fade, which matters in a scorebook left in a hot car.',
        },
        {
          q: 'How many pen colors should I use?',
          a: 'One is enough. Two or three can help if each has a fixed purpose. A system that makes you choose among six colors while a play unfolds is more likely to slow you down than help you read the card later.',
        },
      ],
    },
    {
      id: 'related',
      kind: 'related',
      heading: 'Keep going',
      items: [
        { text: 'Choosing a baseball scorebook', href: '/learn/choose-a-scorebook' },
        { text: 'Keeping score at the ballpark', href: '/learn/score-at-the-ballpark' },
        { text: 'Baseball scorekeeping symbols and position numbers', href: '/learn/scorekeeping-symbols' },
        { text: 'How to score a baseball game', href: '/learn/score-a-baseball-game' },
      ],
    },
  ],
}
