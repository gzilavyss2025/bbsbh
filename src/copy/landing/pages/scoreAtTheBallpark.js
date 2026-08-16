// The in-person guide. Everything here is the unglamorous, experience-earned
// half of scorekeeping — the part about a seat, a breeze, and a substitution
// nobody announced clearly.
//
// Voice: plain, dry, unhurried. Short sentences, active voice, no nostalgia.
// The app is named once, in the CTA, plus one honest caveat about what stops
// working when the connection does. Overclaiming there would cost the page the
// only thing it has.
//
// STATIC — see the SPOILER RULE note in ../schema.js. Nothing here is derived.

export default {
  slug: 'score-at-the-ballpark',
  metaTitle: 'How to Keep Score at a Baseball Game in the Stands',
  metaDescription:
    'What to bring, where to sit, and how to keep a scorecard going through the substitutions, the crowd noise and the dead wifi at a live baseball game.',
  h1: 'Keeping score at a baseball game in person',
  keywords: [
    'keeping score at a baseball game',
    'what to bring to a baseball game scorecard',
    'scoring a game at the stadium',
    'how to keep score at a live game',
  ],
  schema: ['Article', 'HowTo', 'FAQPage'],
  updated: '2026-08-16',
  sections: [
    {
      id: 'answer',
      kind: 'answer',
      body: [
        'Keeping score at a baseball game in person is easier than keeping score at home in one way and harder in three. The easy part is that the whole field is in front of you, so you know where a ball actually landed and which fielder cut it off, not what a camera behind the pitcher chose to show. The hard parts: the scoreboard does not reliably post substitutions, the announcement that would have told you is lost in crowd noise, and stadium wifi fails in exactly the innings you need it. Plan around those three and a ballpark card is the best one you will keep all season.',
      ],
    },
    {
      id: 'bring',
      kind: 'list',
      heading: 'What do you need to bring to keep score at a game?',
      intro: 'Six things. The last two are the ones people learn about the hard way.',
      items: [
        {
          text: 'A scorecard or a scorebook. The card the team sells inside is often good, but it is one game and it is loose paper. A bound book solves the writing surface, the wind and the storage at once, and keeps this game beside every other one you have scored.',
        },
        {
          text: 'Two pencils. Not one. You will drop the first between innings, it will go under the seat in front of you, and that row will stand up for a beer run before you can reach down. A short pencil with a good eraser beats a mechanical one, which jams in the seventh.',
        },
        {
          text: 'A hard backing or a small clipboard. A loose card on a bare knee gives you wavering lines and a hole where the pencil went through. A folded program works. Check the venue’s bag rules first, because they differ and they change.',
        },
        {
          text: 'A way to check the lineup. This item does the most work. You want both batting orders, and later the substitutions — the one thing you cannot reconstruct from watching is who came in for whom.',
        },
        {
          text: 'Sunscreen and a hat for a day game. Sun on white paper is genuinely hard to read, and a brim solves the glare as much as the burn. Three hours in an afternoon seat is long when both hands are full.',
        },
        {
          text: 'Something to weigh the page down. A binder clip on the outer edge, or a rubber band around the book. Ballpark wind arrives as one gust at the wrong moment, turns the page mid at-bat, and drags graphite across the fifth inning.',
        },
      ],
    },
    {
      id: 'before-first-pitch',
      kind: 'prose',
      heading: 'Before first pitch',
      body: [
        'Copy both lineups down while you still have a signal and the concourse crowd has not arrived. Thirty minutes early, not five. Names, spots one through nine, positions, both starting pitchers. Write the position number beside each name too, so you are not translating in the second inning.',
        'This one habit separates a finished card from an abandoned one. With nine names down on each side, you start every at-bat knowing whose row you are in, and a play you miss is one blank cell you can fill later. Copy names off the scoreboard between pitches instead and you are behind in the first. You miss a play while writing a name, then miss the next one looking up the first. By the fourth the card has more gaps than marks, and that is the card people give up on.',
      ],
    },
    {
      id: 'misses',
      kind: 'list',
      heading: 'The three things you will miss',
      intro: 'Not might. Will. Experienced scorers miss these too; they just have a plan for each.',
      items: [
        {
          text: 'The defensive substitution nobody announces clearly. A new left fielder jogs out between innings, the announcement goes up under a music cue, and the scoreboard does not change. Glance at the field before each half-inning and count. If somebody is new, mark the margin with the inning even without a name — “new LF, top 6” is a question you can answer later.',
        },
        {
          text: 'The mid-inning pitching change where you catch the new pitcher but miss which batter he entered on. You watched the mound conference, you got the name, and then you could not recall whose count was whose. Draw the pitcher-change line across the row you are in right now, before anything else. One row off is a small correction later. Reconstructing it is not.',
        },
        {
          text: 'The hit-or-error call that is not obvious from the upper deck. A ball skips off the shortstop’s glove and from two hundred feet up you cannot tell whether he should have had it. The official scorer sometimes changes the ruling the next day anyway. Pencil in what you believe, circle it lightly, keep going, and reconcile between innings.',
        },
      ],
    },
    {
      id: 'seat',
      kind: 'prose',
      heading: 'Where is the best place to sit to keep score?',
      body: [
        'Behind the plate is the scorer’s seat, and not for the view of the pitcher. The whole field lies in front of you, so you can watch a fielder move before the pitch and still see where the ball lands. The position numbers also fall the way you picture them: 7 on your left, 9 on your right, the infield laid across your view like the diagram in your head. Height matters little — the upper deck behind home scores better than a low seat down the line.',
        'A seat down a foul line distorts fly balls. From the first-base side, a ball to right field comes almost straight at you and depth disappears — a routine fly and a ball off the wall look identical until a fielder reacts. You score body language instead of the ball.',
        'The outfield is hardest, and not because of the distance. Your mental map is reversed. You look back at the plate, so left field is on your right and the diamond runs away from you rather than across you. Every play costs an extra beat of translation, and that is what puts you behind.',
        'One trade nobody mentions: a rail in front of your seat, or a wide flat armrest, is worth more to a scorer than ten rows closer. You need somewhere for the book that is not your lap. Take the rail.',
      ],
    },
    {
      id: 'wifi',
      kind: 'prose',
      heading: 'When the wifi dies',
      body: [
        'Assume it will. A full ballpark is tens of thousands of phones in a few acres, and the middle innings are the worst of it. The pattern is predictable: usable before first pitch, unreliable from about the third through the seventh, better once people start leaving.',
        'So front-load the part that needs a connection. Get both lineups down before first pitch. Then score from what you can see, which is most of it, and leave a blank cell rather than stopping. Between innings, when a bar comes back, fill the gaps and check the substitutions. If the signal never returns, you still have a card.',
        'One honest note about apps, this one included. A web app that installs to your home screen keeps its shell working offline — it opens, and it does not fail at the gate. But live data is live data. Lineups, substitutions and inning totals come over the network, and no app can show you a substitution it never fetched. Get the information early, and treat the rest as a bonus.',
      ],
    },
    {
      id: 'cta',
      kind: 'cta',
      heading: 'Add Tally to your home screen before you go',
      body: [
        'Tally is a free, spoiler-safe companion for the card in your lap. It opens to the day’s games and shows both lineups, every substitution, and the defensive alignment for the half-inning you are scoring — the things a ballpark will not reliably tell you. Inning totals stay sealed until you tap to reveal them, so you can check your own work without a screen announcing the game.',
        'It is a web app, so there is no app store download and nothing to update at the gate. No account. Add it to your home screen on your own wifi, and it is there when you sit down. It is not a data-entry tool and will never ask you to tap in a play. The pencil stays yours.',
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
          q: 'Can I score on my phone instead of paper?',
          a: 'You can, and most people who try it are back on paper within a game. A phone shows two innings at a time, wants a tap for every mark, and goes dark every thirty seconds. Paper shows the whole game at once. Phone for the lineup, paper for the scoring.',
        },
        {
          q: 'Where is the best place to sit for scoring?',
          a: 'Behind the plate, at any height. The whole field is in front of you and the position numbers fall the way you picture them. Down a foul line you cannot judge fly-ball depth; in the outfield your map is reversed.',
        },
        {
          q: 'What do I do if I leave my seat for an inning?',
          a: 'Draw a light vertical line in the margin where you left, and go. Do not rebuild the half-inning from the scoreboard, which gives runs and hits but no idea how they happened. Fill the gap from a box score later, or leave it. A blank half-inning is normal on a real card.',
        },
        {
          q: 'How do I find out about a substitution I missed?',
          a: 'Between innings, compare the nine players on the field to the nine names in your defensive notes. The mismatch tells you the position; a lineup source gives the name and the inning. Do that every half-inning and you will catch a change within an inning of it happening.',
        },
        {
          q: 'Is it rude to keep score?',
          a: 'No. It takes a few seconds per at-bat and no space beyond your own seat. The courtesy owed is the ordinary one: stand when your section stands, and do not ask the row in front to hold still. Most people nearby are curious, and a few will ask what happened in the fourth.',
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
        { text: 'Ballpark passports and stamping what you saw', href: '/learn/ballpark-passports' },
        { text: 'Every scorekeeping symbol, in one reference', href: '/learn/scorekeeping-symbols' },
      ],
    },
  ],
}
