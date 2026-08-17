// The buying guide. Editorial, not advertising: every brand gets an honest
// paragraph and a named trade-off, and the page declares no winner and takes no
// affiliate position.
//
// Voice: a beat writer who owns four of these books. Plain, dry, unhurried.
// The app is mentioned once, in the cta, as the reference beside the book.
//
// ACCURACY. Brand facts here were checked against each maker's own site in
// August 2026. Prices and stock move, so price bands are stated loosely and
// never as figures. If you update a brand paragraph, re-check the source first —
// a stale detail on a buying guide is worse than no detail.
//
// STATIC — see the SPOILER RULE note in ../schema.js. Nothing here is derived.

export default {
  slug: 'choose-a-scorebook',
  metaTitle: 'How to Choose the Best Baseball Scorebook for Fans',
  metaDescription:
    'What differs between baseball scorebooks — cell size, binding, page count, pitch grids — with a fair look at Numbers Game, Bob Carpenter, Eephus League and two more.',
  h1: 'Choosing a baseball scorebook',
  keywords: [
    'best baseball scorebook',
    'baseball scorebook for fans',
    'Bob Carpenter scorebook',
    'Eephus League scorebook',
    'Numbers Game scorebook',
    'how to choose a baseball scorecard',
  ],
  schema: ['Article', 'FAQPage'],
  updated: '2026-08-16',
  sources: [
    { name: 'Bob Carpenter’s Baseball Scorebook — Features', href: 'https://bcscorebook.com/pages/features' },
    { name: 'Numbers Game — Scorebooks', href: 'https://www.numbersgame.co/' },
    { name: 'Numbers Game — #22 Scorebook specifications', href: 'https://www.numbersgame.co/products/scorebook-22' },
    { name: 'Eephus League — The Halfliner', href: 'https://eephusleague.com/product/the-halfliner/' },
    { name: 'THIRTY81 Press — Travel Scorebook', href: 'https://thirty81press.com/products/traveler-scorebook' },
    { name: '7-2 Double Play — Square Scorebook', href: 'https://www.72doubleplay.com/square-scorebook/' },
  ],
  sections: [
    {
      id: 'answer',
      kind: 'answer',
      body: [
        'The best baseball scorebook for a first-time scorer is a fan-oriented bound book with generous cells, a substitution line in every lineup spot, and pages for forty games or more. Four things decide the rest: room per at-bat, whether the binding folds flat on a stadium seat, how many games the book holds, and whether the grid asks you to track every pitch. If you know you want pitch-by-pitch detail, buy a printed pitch grid. If you do not know yet, buy the plain cell — adding detail to a big empty box is easy, and ignoring a grid is not.',
      ],
    },
    {
      id: 'differs',
      kind: 'prose',
      heading: 'What actually differs between scorebooks?',
      body: [
        'Every scorebook prints the same grid: nine lineup rows down, innings across. What separates a bought book from a free card is a short list of physical decisions, and the makers disagree about all of them.',
        'Cell size is the first. A cell holds a diamond, the fielders who touched the ball, how the runner advanced, and the out number. A sheet that fits fifteen innings across a letter page gives cells the size of a postage stamp. One that fits ten or eleven gives you room to be untidy, which is what happens in a close sixth inning. A printed ball-and-strike grid in every cell is a gift to scorers who want a pitch count and a tax on everyone else.',
        'Whether the book opens flat matters more than anything on the cover. Double wire-O binding folds all the way back on itself; a glued spine will not. A two-page spread gives both teams equal room, while a single page per team means flipping between half-innings, which costs you plays.',
        'The rest is quiet but real. One substitution line per lineup spot is the minimum and two is better. Paper weight matters: 80-pound text stock takes pencil without ghosting, and a thin sheet smudges. So does size — an 8½-by-11 page opens to seventeen inches, more than most seats allow.',
      ],
    },
    {
      id: 'questions',
      kind: 'list',
      heading: 'Questions to ask before you buy',
      intro: 'People who end up unhappy bought the wrong shape, not the wrong brand.',
      items: [
        {
          text: 'How many games will I really score? Count last season’s games, add a few for televised ones, and buy near that number.',
        },
        {
          text: 'Where will I be scoring? A stadium seat is the hardest case, and it argues for a smaller page and a binding that folds back.',
        },
        {
          text: 'Do I want a pitch count? If yes, buy a printed pitch grid and accept smaller play cells. If no, buy the roomiest plain cell you can find.',
        },
        {
          text: 'How much do substitutions matter? Two slots per lineup spot handle a long game and six relievers. One will have you writing in the margin.',
        },
        {
          text: 'Am I keeping these? A book for the shelf is worth better paper. A book you are learning on is worth the cheapest thing that opens flat.',
        },
      ],
    },
    {
      id: 'brands',
      kind: 'prose',
      heading: 'The books people actually buy',
      body: [
        'Five small makers come up again and again, all in the same band — around twenty to fifty dollars.',
      ],
    },
    {
      id: 'brand-carpenter',
      kind: 'prose',
      heading: 'Bob Carpenter’s Baseball Scorebook',
      body: [
        'Carpenter called big-league games for four decades and built the book he wanted for the booth. Radio holds two hundred games and TV a hundred, both on an 8½-by-11 page running to fifteen innings, with boxes for the defensive alignment, the bench, the bullpen, umpire positions and a running team-record tracker. The Fan edition holds a hundred games on a shorter 8½-by-7 page, runs to thirteen innings, and trades those boxes for an inning-by-inning scoreboard. All three have a lay-flat binding. Fan is the cheapest of the three; the broadcast books sit above it.',
        'This is the most complete grid of the five, and the one to buy if you want to record who is on the field as well as what they did. The trade-off is density and commitment: those boxes are a lot for nine games a summer, and even the Fan book is a hundred games at once.',
      ],
    },
    {
      id: 'brand-numbers-game',
      kind: 'prose',
      heading: 'Numbers Game',
      body: [
        'The #22 is a 9-by-11 landscape book, wire-bound along the top edge, hand-assembled in Wisconsin under a letterpressed cover. It runs eleven innings with nine lineup slots and nine pitcher slots, and prints shading and columns for pitch trackers without forcing that on anyone else. It comes in four lengths — thirty, forty, fifty or eighty-one games — so you buy the number you will actually score. Every lineup slot carries two substitution lines. There is also a pocket-sized forty-game book, and an eleven-game folding Rally Book new for 2026.',
        'It is the easiest book here to right-size, and beautifully made. Two trade-offs: eleven innings covers almost every game and not the one you will remember, and these are small print runs that sell out, so buying one can mean a wait.',
      ],
    },
    {
      id: 'brand-eephus',
      kind: 'prose',
      heading: 'Eephus League',
      body: [
        'The Halfliner is the Eephus League book in current production, and the design-led entry in the category. It holds eighty-one games, a full half-season, on a 7½-by-9¾ page kept under letter size so it travels, double wire bound. The grid runs to twelve innings and gives every lineup spot two substitution slots. The cover is embossed and the book is made in the USA.',
        'If you want the object as much as the record, this is the one. The trade-off is that it assumes you already score: it ships without instruction, and eighty-one games is a long shelf life for a casual fan with no shorter version to step down to.',
      ],
    },
    {
      id: 'brand-thirty81',
      kind: 'prose',
      heading: 'THIRTY81 Project',
      body: [
        'THIRTY81 comes at this from the ballpark-travel side. It gives away printable scorecards for all thirty major league parks, in a plain diamond grid and a balls-and-strikes version — the obvious choice if you are collecting parks. The Traveler Scorebook is compact at 5½ by 8½, double-O wire bound, fifty games, on 80-pound text stock inside gusseted kraft covers that form a pouch front and back. A third edition is in development.',
        'The small page is the point and also the trade-off: cells this size reward small handwriting and punish anyone without it. The pouch and the per-park cards are lovely, and neither is a scoring feature.',
      ],
    },
    {
      id: 'brand-72',
      kind: 'prose',
      heading: '7-2 Double Play',
      body: [
        'This is the custom option. The Square Scorebook is an unusual 8½-by-8½, sixty games, hand-assembled with a heavy cover and double wire-O binding. It can be ordered with water-resistant Rite in the Rain paper. The maker says the paper resists droplets, warns that some inks dry slowly, and recommends testing your writing tool on the cover sheet. The grid runs to fourteen innings. Covers and binding position are chosen through an online builder. A pocket-sized Small Ball book joined the line for 2026, and it holds sixty games too, by dropping the inning numbers and the stat tallies.',
        'Not everyone gets on with the square page, and it does not slide into a bag pocket the way a 5½-by-8½ book does. Hand assembly means lead times, and the builder asks for a decision where other makers hand you a book.',
      ],
    },
    {
      id: 'printed',
      kind: 'prose',
      heading: 'Is a free printed scorecard good enough?',
      body: [
        'A free card from the team is enough more often than the people selling books will tell you. If you score three or four games a summer it does the job, and it has the lineup printed on it, which no bound book can offer. Score on those for a season. What annoys you — cells too small, the card creases, nowhere to put a pinch hitter — is the specification for the book you buy.',
        'A bound book earns its price on three things: a firm surface, which a loose card on a knee never gives you; the games kept together in order; and cells sized by a scorer rather than by someone laying out a program around ads.',
      ],
    },
    {
      id: 'cta',
      kind: 'cta',
      heading: 'Whichever book you buy, the lineup problem is still yours',
      body: [
        'No scorebook can tell you that the shortstop moved to second base in the seventh, or who bats fifth after a double switch. That is the part of scoring by hand that paper cannot solve.',
        'Tally is a free, spoiler-safe companion for exactly that. It shows both lineups and the defense entering the half-inning before you score it. A change during the half appears in order as you reveal the play feed. Later results stay sealed until you open them. It runs in a browser, installs to a phone home screen, asks for no account, and takes no entry — it is not a data-entry tool. You keep score on paper. It sits open beside the book.',
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
          q: 'How many games does a scorebook hold?',
          a: 'Anywhere from about eleven to two hundred. Fan books cluster between thirty and eighty. Broadcaster books go higher, because a professional scores every night.',
        },
        {
          q: 'Do I need a pitch-count grid?',
          a: 'No, and many fans who buy one stop using it by June. It is worth having if you want to know a starter is at 84 pitches through six. It costs you room in the cell where the play goes.',
        },
        {
          q: 'What size book works in a stadium seat?',
          a: 'A page around 5½ by 8½ or 7 by 9 is comfortable. An 8½-by-11 page opens to seventeen inches, wider than most seats and all of your neighbor’s patience. Whatever the size, insist the binding folds back.',
        },
        {
          q: 'Pen or pencil?',
          a: 'Start with a 0.5 mm mechanical pencil if you want easy corrections. Use a fine pen if you prefer a permanent record, but test it on the paper first for smearing and bleed-through.',
        },
      ],
    },
    {
      id: 'related',
      kind: 'related',
      heading: 'Keep going',
      items: [
        { text: 'How to score a baseball game', href: '/learn/score-a-baseball-game' },
        { text: 'Every scorekeeping symbol, in one reference', href: '/learn/scorekeeping-symbols' },
        { text: 'Pen or pencil for scorekeeping?', href: '/learn/pen-or-pencil-baseball-scorekeeping' },
        { text: 'Keeping score at the ballpark', href: '/learn/score-at-the-ballpark' },
        { text: 'Ballpark passports and park collecting', href: '/learn/ballpark-passports' },
      ],
    },
  ],
}
