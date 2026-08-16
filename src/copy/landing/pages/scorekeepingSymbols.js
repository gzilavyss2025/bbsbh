// The reference page. Mostly tables, on purpose: a scorer looks one mark up
// mid-inning, and a machine reader quotes a real <table> far more reliably than
// it quotes a paragraph.
//
// Scope discipline: this page is notation you WRITE on paper. Statistics you
// READ — OPS, ERA, WAR — belong to the glossary page and must not appear here,
// or the two pages compete for the same query and both lose.
//
// STATIC — see the SPOILER RULE note in ../schema.js. Nothing here is derived.

export default {
  slug: 'scorekeeping-symbols',
  metaTitle: 'Baseball Scorekeeping Symbols and Position Numbers',
  metaDescription:
    'Baseball scorecard abbreviations in one reference: the nine position numbers, the marks for outs, hits, walks, steals and substitutions, and where scorers differ.',
  h1: 'Baseball scorekeeping symbols and position numbers',
  keywords: [
    'baseball scorekeeping symbols',
    'baseball position numbers',
    'what does 6-3 mean in baseball',
    'baseball scorecard abbreviations',
    'what does a backwards K mean',
  ],
  schema: ['Article', 'DefinedTermSet', 'FAQPage'],
  updated: '2026-08-16',
  sections: [
    {
      id: 'answer',
      kind: 'answer',
      body: [
        'Baseball scorekeeping uses a number for each fielding position and a letter or short abbreviation for each kind of play. The nine numbers are 1 pitcher, 2 catcher, 3 first base, 4 second base, 5 third base, 6 shortstop, 7 left field, 8 center field, 9 right field. A play is written as the fielders who handled the ball, in order, joined by hyphens: 6-3 means the shortstop fielded a ground ball and threw to the first baseman for the out. Events that involve no fielder get letters instead — K for a strikeout, BB for a walk, 2B for a double — and a backward K means the batter struck out looking rather than swinging.',
      ],
    },
    {
      id: 'how-built',
      kind: 'prose',
      heading: 'How is baseball scorekeeping notation built?',
      body: [
        'There are only two kinds of mark on a scorecard. Numbers stand for people: the nine defensive positions, plus the batting-order number of whoever drove a run in. Letters stand for events: how the ball was hit, or what happened when it was not hit at all. Almost every mark you will ever write is one of those two, or the two combined. F9 is a letter and a number — a fly ball, caught by the right fielder. E6 is a letter and a number — an error, charged to the shortstop.',
        'The hyphen means the ball travelled. Read 4-6-3 left to right as a sentence: the second baseman fielded it, threw to the shortstop, who threw to the first baseman. Each name in that chain except the last is credited with an assist; the last one records the putout. When one fielder does the whole thing alone there is no hyphen, and many scorers add U for unassisted — 3U, the first baseman fielding a grounder and stepping on the bag himself. A ball caught on the fly is already unassisted, so it is written as a bare number, or a letter and a number, and never with a U.',
      ],
    },
    {
      id: 'positions',
      kind: 'table',
      heading: 'The nine position numbers',
      intro:
        'These never change, on any scorecard, anywhere. Learn them before anything else on this page.',
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
        'The designated hitter has no number, because the designated hitter fields nothing. Write DH beside the name in the lineup and leave it there. The outfield numbers run 7, 8, 9 from left field to right field as you look out from home plate, so 7 is on your left in a seat behind the plate; it runs right to left for the fielders, who face back toward home. And the infield runs 3, 4, 5 around the bases and then doubles back to 6 for the shortstop, which is the one piece of the system that has to be memorized rather than reasoned out.',
      ],
    },
    {
      id: 'outs',
      kind: 'table',
      heading: 'Outs',
      intro:
        'The fielders in order, joined by hyphens, plus a letter for how the ball left the bat. The out number itself — a small 1, 2 or 3 — goes in the cell beside the mark.',
      columns: ['Notation', 'Means', 'Example'],
      rows: [
        ['6-3', 'Ground ball to shortstop, thrown to first base', 'The most common ground-ball out'],
        ['4-6-3', 'Second base to shortstop to first base', 'The standard double play'],
        ['5-4-3', 'Third base to second base to first base', 'Double play started at the hot corner'],
        ['3U', 'First baseman fields it and touches the bag himself', 'U means unassisted'],
        ['1-3', 'Pitcher fields a comebacker and throws to first', 'Assist to the pitcher'],
        ['F9', 'Fly ball caught by the right fielder', 'F for fly'],
        ['L4', 'Line drive caught by the second baseman', 'L for line drive'],
        ['P5', 'Pop-up caught by the third baseman', 'P for pop-up'],
        ['8', 'Putout with no assist, written as the number alone', 'Fly ball to the center fielder'],
        ['K', 'Strikeout, batter swinging', 'A bunt fouled off with two strikes is a strikeout too'],
        ['Backward K', 'Strikeout looking — called strike three', 'Written as a mirrored K'],
        ['SAC', 'Sacrifice bunt — batter out, runner advanced', 'Often written SH, for sacrifice hit'],
        ['SF', 'Sacrifice fly — fly ball caught, runner scores after the catch', 'Usually written with the fielder: SF8'],
        ['DP', 'Double play — two outs on one batted ball', 'Added beside the fielding chain, as 6-4-3 DP'],
        ['TP', 'Triple play — three outs on one batted ball', 'Rare enough to be worth circling'],
        ['K2-3', 'Dropped third strike, catcher throws the batter out at first', 'The strikeout still counts'],
        ['CS2-6', 'Caught stealing — catcher throws to the shortstop covering second', 'A caught stealing is an out like any other'],
      ],
    },
    {
      id: 'reaching',
      kind: 'table',
      heading: 'Reaching base',
      intro:
        'Written in the batter’s cell, usually alongside a line drawn from home plate toward first base.',
      columns: ['Mark', 'Means'],
      rows: [
        ['1B', 'Single'],
        ['2B', 'Double'],
        ['3B', 'Triple'],
        ['HR', 'Home run'],
        ['BB', 'Walk — base on balls'],
        ['IBB', 'Intentional walk'],
        ['HBP', 'Hit by pitch'],
        ['E6', 'Error charged to the shortstop — the number is the position, so E4, E9 and so on'],
        ['FC', 'Fielder’s choice — the ball was fielded, and the fielder chose to retire a different runner'],
        ['ROE', 'Reached on error — the same event as E6, said the other way round'],
        ['CI', 'Catcher’s interference — the batter is awarded first base'],
        ['K+WP', 'Struck out, reached first because the third strike got away from the catcher for a wild pitch'],
        ['K+PB', 'The same, when the pitch was catchable and the catcher missed it — a passed ball'],
        ['KE2', 'The same, when the catcher had the ball and threw it away'],
      ],
    },
    {
      id: 'bases',
      kind: 'table',
      heading: 'On the bases',
      intro:
        'Write these along the side of the diamond the runner advanced on, so the card shows not just that a runner moved but what moved him.',
      columns: ['Mark', 'Means'],
      rows: [
        ['SB', 'Stolen base'],
        ['CS', 'Caught stealing — an out'],
        ['PO', 'Picked off — the pitcher or catcher retired a runner who was not attempting to steal'],
        ['WP', 'Wild pitch — a pitch the catcher could not reasonably handle, and a runner advanced'],
        ['PB', 'Passed ball — a catchable pitch the catcher missed, and a runner advanced'],
        ['BK', 'Balk — an illegal pitcher motion, and every runner is awarded a base'],
        ['DI', 'Defensive indifference — the runner took the base uncontested, and it is not a stolen base'],
        ['OA', 'Out advancing — the runner was retired trying to take an extra base on a play'],
      ],
    },
    {
      id: 'subs',
      kind: 'table',
      heading: 'Substitutions and the lineup',
      intro:
        'A substitute never gets a new row. He inherits the lineup spot he came into, written on a fresh line inside that same row, with the inning noted. That inheritance is what lets a card reconstruct a game months later.',
      columns: ['Mark', 'Means'],
      rows: [
        ['PH', 'Pinch hitter — batted in another player’s lineup spot'],
        ['PR', 'Pinch runner — replaced a runner already on base'],
        ['New pitcher', 'Draw a line across the row after the last batter he faced, then start the reliever on a new line in the pitchers box, with the inning'],
        ['Defensive replacement', 'Write the new player on the next line of the lineup spot he takes over, with his position number and the inning he entered'],
        ['Position change', 'Write the new position number beside the existing name — a left fielder moving to first base becomes 3 from that inning on'],
        ['Double switch', 'Two lineup spots change at once. Record both, in their own rows, before the inning starts'],
      ],
    },
    {
      id: 'disagree',
      kind: 'prose',
      heading: 'Where do scorers disagree about the symbols?',
      body: [
        'Scorekeeping has no governing body for the marks themselves. Official scorers follow the rulebook for what a play IS — hit or error, earned or unearned — but how you write it down is convention, and the conventions vary by scorebook, by country, and by whoever taught you. Here is the honest map of the disagreements you will run into.',
        'Fly balls. Some scorers write F9, some write plain 9, and both are common. The plain-number school argues that the fielding chain already tells you the ball was caught in the air, so the F is noise. The letter school argues that F9 and 9 look different at a glance six months later, which is the point of writing anything down. Neither camp is wrong.',
        'The called third strike. The backward K is the best known mark in the sport, and it is also not universal. Some scorers write Kc for called and Ks for swinging. Some write K for swinging and K with a line through it for looking. If your bound book has its own printed scheme, following it beats importing one.',
        'Where the out number goes. Most scorers put a small 1, 2 or 3 in a corner of the cell. Others put it in the middle of the diamond, and others circle it. The only thing that matters is that it is in the same place in every cell, because the reason to write it at all is that your eye can find it without reading.',
        'Hits. 1B, 2B, 3B and HR are the clearest to a stranger. One, two, three or four short dashes are faster to write and just as unambiguous once you are used to them. A third group draws the line to the base reached and adds the fielder’s number for where the ball landed — 7 for a single to left.',
        'The dropped third strike. This is the messiest corner of the whole system, because one event produces two records: the pitcher gets a strikeout, and the batter is on first base. Some scorers write K+WP or K+PB, some write KE2, some write the strikeout in the cell and the reaching in the margin. If you take one habit from this page, take the habit of writing the K no matter what else you write, because the strikeout is real and a card that loses it will not add up.',
        'The sacrifice bunt. SAC and SH mean the same thing; SH — sacrifice hit — is the older and still official term, and SAC is what most people write. OA drifts too: most scorebooks read it as out advancing, while some computer-based systems use it for other advance.',
        'None of these is an error. A scorecard is a private document that happens to use a shared vocabulary, and the only rule that binds is internal consistency. Pick a convention before the first pitch and hold it for nine innings. Switch conventions in the sixth and you have written a puzzle.',
      ],
    },
    {
      id: 'cta',
      kind: 'cta',
      heading: 'Keep the lineup straight',
      body: [
        'The notation is the easy half. The hard half is knowing who is actually playing right field in the seventh after a substitution nobody announced clearly.',
        'Tally is free, needs no account, and shows both lineups, every substitution, and the defensive alignment for the half-inning you are on — with the inning totals sealed until you tap. You keep score on paper; it just tells you who is out there.',
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
          q: 'What does 6-3 mean in baseball?',
          a: '6-3 is a ground ball to the shortstop, who threw to the first baseman for the out. The 6 is the shortstop and the 3 is the first baseman, and the hyphen means the ball travelled between them. The shortstop is credited with an assist and the first baseman with the putout. Along with K, it is the mark you will write most often.',
        },
        {
          q: 'Why is the shortstop 6 and the third baseman 5?',
          a: 'The numbers were assigned by working around the infield in base order — pitcher, catcher, first, second, third — and then coming back for the shortstop, who is the leftover fielder in that circuit. It looks backwards on the field, where the shortstop stands between second and third. There is no way to derive it; it simply has to be learned, and it becomes automatic within a game or two.',
        },
        {
          q: 'What does a backwards K mean?',
          a: 'A backwards K means the batter struck out looking — he took called strike three without swinging. A normal K means he struck out swinging. Both count identically as strikeouts in every statistic; the distinction is entirely for the scorer, who wants to know later whether a hitter was beaten or frozen. Some scorers use Kc and Ks instead, which is equally correct.',
        },
        {
          q: 'How do I mark a double play?',
          a: 'Write the fielders in the order they handled the ball, then DP. A ground ball to the shortstop, flipped to the second baseman, thrown to first is 6-4-3 DP. Record the out in the batter’s cell and go back to the runner who was retired, mark the same 6-4-3 there, and number both outs. Two cells change on one play, which is the part new scorers forget.',
        },
      ],
    },
    {
      id: 'related',
      kind: 'related',
      heading: 'Keep going',
      items: [
        { text: 'How to score a baseball game', href: '/learn/score-a-baseball-game' },
        { text: 'Choosing a baseball scorebook', href: '/learn/choose-a-scorebook' },
        { text: 'How to read a box score', href: '/learn/read-a-box-score' },
        { text: 'Baseball stats glossary', href: '/learn/stats-glossary' },
      ],
    },
  ],
}
