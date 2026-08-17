// Recovery advice for the moment every new scorer meets: the game moved faster
// than the pencil. The page keeps official scoring separate from reconstruction.

export default {
  slug: 'missed-play-scorekeeping',
  metaTitle: 'What to Do When You Miss a Play While Keeping Score',
  metaDescription:
    'Recover a baseball scorecard after you miss a play: protect the batting order, mark the gap, use play-by-play, and correct the card without falling behind.',
  h1: 'What to do when you miss a play while keeping score',
  keywords: [
    'missed a play keeping score baseball',
    'fix baseball scorecard',
    'how to catch up baseball scorekeeping',
    'check official scoring baseball play',
    'beginner baseball scorekeeping mistakes',
  ],
  schema: ['Article', 'FAQPage'],
  updated: '2026-08-16',
  sources: [
    { name: 'MLB Glossary — Official Scorer', href: 'https://www.mlb.com/glossary/rules/official-scorer' },
    { name: 'MLB Glossary — Ordinary Effort', href: 'https://www.mlb.com/glossary/rules/ordinary-effort' },
    { name: '2026 Official Baseball Rules', href: 'https://mktg.mlbstatic.com/mlb/official-information/2026-official-baseball-rules.pdf' },
  ],
  sections: [
    {
      id: 'answer',
      kind: 'answer',
      body: [
        'If you miss a play while keeping score, leave that cell open, write a small question mark, and record the batter, runners, and number of outs after the play. Then score the next pitch. Reconstruct the missing play during the next pause from the official play-by-play, the ballpark scoreboard, or a broadcast replay. Do not stay on the missed play while the game continues; preserving the batting order and current base state prevents one gap from becoming a lost inning.',
      ],
    },
    {
      id: 'first-response',
      kind: 'list',
      heading: 'The thirty-second recovery',
      items: [
        { text: 'Mark the unfinished cell with a small question mark. Do not erase the whole box.' },
        { text: 'Write where each runner is now and how many outs there are.' },
        { text: 'Confirm the next batter in the order and resume with the next pitch.' },
        { text: 'Return to the gap during a mound visit, pitching change, or inning break.' },
      ],
    },
    {
      id: 'protect-state',
      kind: 'prose',
      heading: 'Protect the game state before the details',
      body: [
        'A scorecard is easier to repair when the next batter, the occupied bases, and the out count are correct. Those facts tell you where the game is now. The exact fielding chain tells you how it got there, and you can add that chain later.',
        'For example, if you can confirm that the runner from first is out, the batter is safe at first, and the play added one out, write those facts first. Add the fielding chain and the batter’s official result later. The runner may have been forced out while the batter reached on a fielder’s choice; those descriptions can apply to the same play. Do not guess an error from the shape of the result.',
      ],
    },
    {
      id: 'sources',
      kind: 'table',
      heading: 'Best sources for rebuilding a missed play',
      columns: ['Source', 'Use it for', 'Limit'],
      rows: [
        ['Official play-by-play', 'Batter result, runner advances, fielders and substitutions', 'The text can update after an official scoring change'],
        ['Ballpark scoreboard', 'Current batter, base state, outs and hit-or-error ruling', 'It may not show the full fielding sequence'],
        ['Broadcast replay', 'Who touched the ball and how runners moved', 'Announcers can describe a ruling before it is official'],
        ['Public-address announcement', 'Pinch hitters, pinch runners and defensive changes', 'Crowd noise can hide part of the announcement'],
        ['Your neighboring scorer', 'A quick fielding number or substitution', 'Personal notation can differ from yours'],
      ],
    },
    {
      id: 'official-ruling',
      kind: 'prose',
      heading: 'Wait for the ruling when hit or error is unclear',
      body: [
        'The official scorer, not the umpire or broadcaster, decides whether a batter reached on a hit or an error. That ruling can change after the play. Write a question mark or a light temporary mark if the decision is not posted yet.',
        'An error uses the standard of ordinary effort for a fielder at that position, with the field and weather taken into account. It is not simply any ball that a defender touched and failed to stop. If you keep personal totals, use the official ruling when it becomes available so your batting and fielding totals match the official record.',
      ],
    },
    {
      id: 'corrections',
      kind: 'prose',
      heading: 'How to correct the card cleanly',
      body: [
        'With pencil, erase only the wrong symbol and redraw the base path that the correction affects. With pen, use one thin strike-through and write the correction beside it. Do not cover the whole cell with ink; you may need its corners later for an out number, an RBI note, or another runner advance.',
        'If the repair does not fit, use an asterisk and put the full play in the margin. Long rundowns, interference, and several substitutions in one pause often read better as a short note than as a perfect knot of symbols inside one square.',
      ],
    },
    {
      id: 'missing-inning',
      kind: 'prose',
      heading: 'What if you miss several batters or a whole inning?',
      body: [
        'Start again with the current batter and game state. At the next long break, work through the official play-by-play in order and fill one plate appearance at a time. Check that the number of completed plate appearances matches the lineup rotation before you total the inning.',
        'A blank stretch does not ruin the scorecard. A personal card records how you followed the game, and a margin note can say that you reconstructed an inning later. Accuracy matters more than pretending you never looked away.',
      ],
    },
    {
      id: 'cta',
      kind: 'cta',
      heading: 'Catch up without seeing the whole score',
      body: [
        'Tally lets you return to the half-inning you are scoring. Reveal one plate appearance at a time to rebuild the missing sequence, while the lineup and defense entering that half remain available for reference.',
        'Later plate appearances and the rest of the game stay sealed, so fixing one gap does not expose what happened next.',
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
          q: 'Is it cheating to check play-by-play while keeping score?',
          a: 'No. A personal scorecard is not an exam. Use play-by-play to confirm a ruling, a substitution, or a fielding sequence that you missed. Your job is to make a useful record of the game, not to prove that you heard every announcement.',
        },
        {
          q: 'Should I guess hit or error so I can keep moving?',
          a: 'Use a temporary question mark instead. The official scorer decides hit or error, and the ruling can change. Record the base state and outs, then add H or E when the decision appears.',
        },
        {
          q: 'What should I record first after a confusing play?',
          a: 'Record the new out count, every occupied base, and the next batter. Those facts preserve the current game state. Add the exact fielders, assists, and runner-advance causes when the action stops.',
        },
        {
          q: 'Does a messy correction ruin a scorecard?',
          a: 'No. Corrections are part of scoring a live game. Use one clear mark, keep the original cell readable, and move a long explanation to the margin. A scorecard that followed the game is more valuable than a clean page with missing plays.',
        },
      ],
    },
    {
      id: 'related',
      kind: 'related',
      heading: 'Keep going',
      items: [
        { text: 'How to score a baseball game', href: '/learn/score-a-baseball-game' },
        { text: 'How to record baseball substitutions', href: '/learn/score-baseball-substitutions' },
        { text: 'Baseball scorekeeping symbols and position numbers', href: '/learn/scorekeeping-symbols' },
        { text: 'Keeping score at the ballpark', href: '/learn/score-at-the-ballpark' },
      ],
    },
  ],
}
