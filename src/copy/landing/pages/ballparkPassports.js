// The ballpark-passport page. Two halves: the physical MLB BallPark Pass-Port,
// and Tally's Game Log as a companion to it.
//
// TONE, and it is the whole brief. The Pass-Port is somebody else's good thing.
// Every claim about it here was checked against mlbballparkpassport.com, and
// this page is written to send readers there. Tally has NO affiliation with the
// Pass-Port program, with Pass-Port Sports, LLC, or with MLB, and nothing here
// may suggest one. A Tally stamp is a personal record. It is never a validation,
// never official, and never a substitute for a stamp a person at a ballpark
// presses into a book for you. If a fact cannot be verified on the official
// site, it is left out or written as "varies by ballpark."
//
// The Game Log half is written from docs/game-log.md and ADR-0036/0041 only.
// Physical verbs: minted, pressed, placed, filed. Never saved or synced.
//
// STATIC — see the SPOILER RULE note in ../schema.js. Nothing here is derived.

export default {
  slug: 'ballpark-passports',
  metaTitle: 'MLB Ballpark Passports and How to Get Your Book Stamped',
  metaDescription:
    'What an MLB ballpark passport is, how the validation stamp works, where to get your book stamped at the park, and how to keep the same record on a phone.',
  h1: 'Ballpark passports and keeping a record of the games you saw',
  keywords: [
    'MLB ballpark passport',
    'ballpark passport stamp book',
    'how to get ballpark stamps',
    'visiting all 30 MLB ballparks',
    'keeping track of baseball games attended',
  ],
  schema: ['Article', 'FAQPage'],
  updated: '2026-08-16',
  sources: [
    { name: 'MLB BallPark Pass-Port — How It Works', href: 'https://mlbballparkpassport.com/how-it-works/' },
    { name: 'MLB BallPark Pass-Port — Our Story', href: 'https://mlbballparkpassport.com/our-story/' },
    { name: 'MLB BallPark Pass-Port — Book and Backstamping', href: 'https://mlbballparkpassport.com/product/the-mlb-ballpark-pass-port/' },
    { name: 'MLB BallPark Pass-Port — Official site', href: 'https://mlbballparkpassport.com/' },
  ],
  sections: [
    {
      id: 'answer',
      kind: 'answer',
      body: [
        'A ballpark passport is a bound book you carry to games and have stamped at each stadium you visit, the way a travel passport is stamped at a border. The best known one is the MLB BallPark Pass-Port, created by Tim Parks, with stamped visits reaching back to 2012. It holds four pages for each of the 30 big-league ballparks, with a validation box on each spread waiting for that park’s stamp. You take the book to an official validation station — the book lists the station for each park — and ask for the rubber dated ink validation stamp. Validations are free for Pass-Port holders. The stamp is the proof; the book is the record.',
      ],
    },
    {
      id: 'how-it-works',
      kind: 'prose',
      heading: 'What is the MLB BallPark Pass-Port, and how does it work?',
      body: [
        'The book is a physical object and behaves like one. It is made of leather-quality material with reinforced stitching, on a six D-ring binder so pages can be added as ballparks are built. There is a fold-out national map of all 30 clubs with a mileage chart, four pages for each ballpark, and on those pages a seating chart, game-day facts, a journal page, and the stamp validation box. A vinyl pouch holds ticket stubs, and there are stickers to mark where you sat and which parks you have reached. None of it needs a battery, and the map is the part people spread out on a kitchen table in February.',
        'Getting a stamp is the simple half. You take the book to an official validation station — the Pass-Port lists the stations on pages six and seven — and ask for the rubber dated ink validation stamp. In practice that desk is guest services or the team store, and it varies by ballpark. The stamp carries the date, so a book that has been to Wrigley Field four times says so four times, in four different hands. Validations are free for Pass-Port holders, and you have to be holding an official Pass-Port book to get one.',
        'If you started going to ballparks before you started collecting stamps, the program sells a back-stamping service: order it alongside a book, list the visits you made, and those earlier games come back stamped. It covers 2012 to the present. The line has grown past the one book, too — there are separate Pass-Ports for the minor leagues, for spring training, and for baseball attractions beyond the 30 parks. The books are sold at mlbballparkpassport.com and at the Baseball Hall of Fame shop, among other places. Tally has no connection to the program. We just think it is a good thing that exists.',
      ],
    },
    {
      id: 'field-advice',
      kind: 'list',
      heading: 'How do you get your ballpark passport stamped?',
      intro:
        'None of this is official guidance — practice varies by ballpark, and the Pass-Port’s own instructions are the ones to follow. It is what tends to go wrong, and how to avoid it.',
      items: [
        {
          text: 'Go early, or between innings. Getting stamped takes under a minute, but the desk is not always staffed the moment you want it, and a line of people asking about a broken seat is a line you are now standing in.',
        },
        {
          text: 'Guest services is usually the reliable desk. It is staffed for the whole game and it is used to being asked odd questions. Start there.',
        },
        {
          text: 'Some parks stamp at the team store instead. The book lists the validation station for each ballpark. Read that page before you go rather than walking the concourse asking.',
        },
        {
          text: 'Ask before the last inning. Desks close, staff go home, and the stamp you were going to get on the way out is the stamp you drive home without.',
        },
        {
          text: 'Keep the book flat and dry. A rain delay and a canvas bag are a bad combination, and wet ink offsets onto the facing page.',
        },
        {
          text: 'Do not assume every park participates. Spring-training sites and minor-league parks are their own thing — the program sells separate books for them — and any given front office may not be set up for it. Ask, and be fine with the answer.',
        },
      ],
    },
    {
      id: 'what-a-stamp-is-for',
      kind: 'prose',
      heading: 'What a stamp is actually for',
      body: [
        'A stamp records nothing about the baseball. It does not know who won, who pitched, or whether the game was any good. It is a date and a place, pressed by a stranger who was at work that day.',
        'That is the whole value of it. A scorecard says what happened. A stamp says you were there. The two answer different questions, and the second is harder to answer later than people expect — a season blurs, and the game you would swear was in June turns out to have been in August, against a different club, in a park you have since been back to twice.',
        'The collection is also not a task. There is no prize for 30 parks and nothing is wasted if you stop at nine. Some people work through the map methodically and enjoy that; most end up with a book that follows where work sent them and where their family lives, which is the more honest record anyway. The stamp is not the point. The record is.',
      ],
    },
    {
      id: 'on-a-phone',
      kind: 'prose',
      heading: 'How do you keep track of the games you attended on a phone?',
      body: [
        'Tally has a Game Log, and it was built as a passport book on purpose. It is not a replacement for a Pass-Port and it should not be read as one. A Pass-Port is a physical object that somebody at a ballpark stamps for you, in front of you, and that is a thing a phone cannot do. Tally’s stamps are not official, not validated, and not connected to any MLB program. They are a record you keep for yourself.',
        'It works like this. You reveal a game’s box score in Tally, the way the rest of the app works — sealed until you ask. Once the game is final you can stamp it, and the stamp is minted with the final score, the two clubs, the date and the venue on it. A stamp is minted once the game is final, so the score on it never changes. Fresh stamps wait in a tray until you tap a spot on a page to place them, and the page holds eight. Each one lands with a slight tilt, so a full page reads as pressed by hand rather than laid out by a grid.',
        'The arrangement is yours, which is what makes it a book rather than a list. You choose which page a game goes on and where on the page it sits, and you can pick a stamp up and move it later. You can hold more than one book — a season in one, a road trip in another — each with its own name and cover, and a stamp is filed into whichever book was open when you placed it. A retrospective adds the collection up: the clubs you saw, your record watching them, the span of dates you covered. There is no completion state and nothing to finish. It is free, it runs in a browser, and it works alongside a paper book rather than instead of one.',
      ],
    },
    {
      id: 'cta',
      kind: 'cta',
      heading: 'A passport of the games you’ve scored',
      body: [
        'Tally’s Game Log holds a stamp for every game you sat with — the score, the clubs, the date, the ballpark — and you decide where each one goes on the page.',
        'Take the leather book to guest services for the real stamp. Keep this one for the games there is no desk to stamp: the away games, the ones you watched from a kitchen, the nine innings you scored on paper in your own hand.',
      ],
      linkText: 'Open your Game Log',
      href: '/logbook',
    },
    {
      id: 'faq',
      kind: 'faq',
      heading: 'Common questions',
      items: [
        {
          q: 'What is the MLB BallPark Pass-Port, and who runs it?',
          a: 'It is a bound stamp book for fans visiting big-league ballparks, created by Tim Parks, with stamped visits reaching back to 2012. It holds four pages for each of the 30 parks, a fold-out national map, a pouch for ticket stubs, and a validation box on each ballpark’s page. It is sold at mlbballparkpassport.com and at the Baseball Hall of Fame shop, among other places. Tally is not affiliated with it in any way.',
        },
        {
          q: 'Does a ballpark stamp cost anything?',
          a: 'No. All validations are free for Pass-Port holders — you buy the book once, and the stamps themselves are free at the park. You do have to be holding an official Pass-Port book to be validated.',
        },
        {
          q: 'Can I get games I already went to stamped?',
          a: 'Yes, through the program’s back-stamping service. You order it alongside a book and list the visits you made, and they come back stamped. It covers 2012 to the present. Full details are on mlbballparkpassport.com.',
        },
        {
          q: 'Do minor-league parks stamp a passport?',
          a: 'Do not assume it. The program sells separate Pass-Ports for the minor leagues and for spring training, and practice varies from park to park. Check the book you are carrying for its validation stations, and ask at guest services when you arrive.',
        },
        {
          q: 'What if guest services is closed when I get there?',
          a: 'You go home without it, which is the ordinary way a stamp gets missed. Ask early rather than on the way out — desks close before the ball game does. If you miss it, the visit is not lost: note the date, and ask about the back-stamping service the next time you order from the program.',
        },
        {
          q: 'Do I need a physical book to keep track of games?',
          a: 'No, though the physical book is the better keepsake, and nothing on a phone matches a stamp a stranger pressed for you. Tally’s Game Log is a free version of the same idea — a stamp for each game you saw, arranged by hand in books you name. It is a personal record, not an official validation, and there is no reason not to keep both.',
        },
      ],
    },
    {
      id: 'related',
      kind: 'related',
      heading: 'Keep going',
      items: [
        { text: 'Keeping score at the ballpark', href: '/learn/score-at-the-ballpark' },
        { text: 'How to score a baseball game', href: '/learn/score-a-baseball-game' },
        { text: 'Choosing a baseball scorebook', href: '/learn/choose-a-scorebook' },
        { text: 'Watching a game without spoilers', href: '/learn/watch-without-spoilers' },
      ],
    },
  ],
}
