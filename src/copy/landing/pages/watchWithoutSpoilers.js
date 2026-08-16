// The spoiler page. This is the one page where Tally itself is the answer to
// the question the reader typed, so the cta is allowed to be the longest on the
// site — and for exactly that reason every claim in it has to be literally true.
//
// Voice: a person solving an annoying problem, not a brand. No hype, no
// fear-mongering. The device-level advice stands on its own for a reader who
// never opens the app.
//
// STATIC — see the SPOILER RULE note in ../schema.js. Nothing here is derived.

export default {
  slug: 'watch-without-spoilers',
  metaTitle: 'How to Watch a Baseball Game on Delay Without Spoilers',
  metaDescription:
    'A practical guide to watching a baseball game hours late without learning the score: what leaks it, what to turn off, and how to follow lineups safely.',
  h1: 'How to watch a baseball game on delay without spoilers',
  keywords: [
    'watch baseball without spoilers',
    'avoid baseball score spoilers',
    'watch game later without knowing the score',
    'spoiler free baseball app',
    'how to avoid MLB scores',
  ],
  schema: ['Article', 'HowTo', 'FAQPage'],
  updated: '2026-08-16',
  sections: [
    {
      id: 'answer',
      kind: 'answer',
      body: [
        'To watch a baseball game on delay without spoilers, turn off notifications for every sports and news app on your devices, take any score widget off your lock screen and home screen, and stay away from standings pages, channel guides and highlight thumbnails until you have finished watching — a standings row and a video title both carry the result. The harder half is that almost every tool built for baseball leads with the score: you open a league app to check who is playing second base, and the number is on the screen before your question is answered. So the practical problem is not avoiding the internet. It is finding one place to look up lineups, substitutions and umpires mid-game that keeps the result sealed until you ask for it.',
      ],
    },
    {
      id: 'leaks',
      kind: 'list',
      heading: 'What actually spoils a baseball game before you watch it?',
      intro:
        'Worth reading once. Most people get caught by something further down this list than they expect.',
      items: [
        {
          text: 'Push notifications. The obvious one. A final-score alert lands on the lock screen while the phone is face down, and you read it later when you pick the phone up anyway.',
        },
        {
          text: 'A lock-screen or home-screen widget. Worse than a notification, because it does not need to arrive. It is simply there, updated, every time the screen lights up.',
        },
        {
          text: 'A league app’s home screen. Opening it for any reason — a lineup, a start time, a stat — puts today’s scoreboard in front of you first, and there is usually no way in that avoids it.',
        },
        {
          text: 'A standings page. It looks harmless and it is not. A team’s record includes tonight’s game the moment it ends, so one row of a standings table tells you whether your club won.',
        },
        {
          text: 'A highlight thumbnail. Video sites offer you a clip from the game you are watching, and the still frame or the title carries the result. So does the length of the reel.',
        },
        {
          text: 'The remaining length of the video you are watching. A broadcast running twenty minutes long tells you it went to extras. A scrubber near the end while the game is tied in the eighth tells you something too.',
        },
        {
          text: 'A live-updating scoreboard in a TV channel guide. Cable and streaming guides print in-progress and final scores beside the listing, and you will see one while hunting for the channel.',
        },
        {
          text: 'Social feeds. Any timeline you scroll during the game will eventually hand you the result, usually as a reply to something unrelated. Muted words help and do not solve it, because a photo of a celebration has no words in it.',
        },
        {
          text: 'A friend’s text message. No app controls this one. The only fix is telling people, once, that you are watching late tonight — and accepting that somebody will forget.',
        },
      ],
    },
    {
      id: 'obvious',
      kind: 'prose',
      heading: 'How do you avoid MLB scores on your own devices?',
      body: [
        'Start with notifications, and be thorough rather than clever. Turn off alerts for every sports app on the phone, not just the one you use most, and check the news apps too — they carry sports alerts and nobody remembers enabling them. A focus mode covering the hours you plan to watch is a good second layer, because it catches the app you forgot.',
        'Then remove the widgets. A sports widget on a lock screen or a home screen shows a live score without being opened, which makes it the leak that survives every other precaution. Take it off for the season rather than for the night. Do the same for a smart-watch complication and for any tab you keep pinned in a browser, since a pinned tab reloads itself and updates its title.',
        'Last, calm down anything that plays or refreshes on its own. Turn off autoplay in your video app so the next suggestion does not open with a highlight. Mute the obvious terms on your social accounts — both team names, both city names, the word “walkoff” — and treat that as a filter, not a wall. Not scrolling at all until you have finished the game works better than any block list.',
      ],
    },
    {
      id: 'harder',
      kind: 'prose',
      heading: 'The part that is harder',
      body: [
        'Now the real problem. Watching a game on delay is not passive, especially if you are keeping score. You need information constantly: who is playing left field now, which reliever just came in, what the batting order looks like after a double switch, who is umpiring behind the plate. A broadcast tells you some of that once, quietly, and then moves on.',
        'Every normal way of answering those questions shows you a score first. The league app opens on a scoreboard. A team site puts the day’s result in the header. A search for a player’s name returns a card with the game state in it. You wanted the name of a left fielder and you were handed the eighth-inning score, and there is no undoing that.',
        'So the question is not really “how do I avoid spoilers.” It is “where do I look things up mid-game without being told how it ends.” That is a narrower problem, and it is the one the rest of this page is about.',
      ],
    },
    {
      id: 'cta',
      kind: 'cta',
      heading: 'Tally is a scoreboard that waits for you',
      body: [
        'Tally is a spoiler-free baseball app for people watching on delay and people keeping score by hand. It is free, it needs no account, it runs in any browser, and it installs to a phone home screen. It does not stream video and it is not a data-entry tool — you watch the game somewhere else, and the paper stays yours.',
        'What it does is invert the usual order. Scores and inning totals are sealed. They are not on the screen when you open a game, and they are not hidden behind a blur — the number is not there until you tap to reveal it, one half-inning at a time. Everything that is not a result stays open: both lineups, every substitution, the rosters, the umpiring crew, ballpark details, season and career statistics, standings and leader boards. A stat line is not a score, so Tally leaves it alone. You can read a batter’s season numbers in the fourth without being told what he did tonight.',
        'That is the whole idea. Check who came in to pitch, read his career numbers, find out who is umpiring at first base, and go back to the broadcast without having seen a run total you did not ask for.',
      ],
      linkText: 'Open Tally',
      href: '/',
    },
    {
      id: 'pace',
      kind: 'prose',
      heading: 'Following along at your own pace',
      body: [
        'You move through a game half-inning by half-inning. When the top of the third finishes on your screen, you tap to reveal what happened in the top of the third, and the app shows that and nothing after it. It never runs ahead of you. If you stop watching in the fifth, the app knows five innings, the same as you do.',
        'Your position is remembered on the device, so closing the tab costs you nothing. Come back tomorrow and the game is where you left it, still sealed from that point on. If you sign in, that position follows you between your own devices, which matters if you start on a phone and finish on a laptop.',
        'Extra innings are held back until you reach them. This is easy to get wrong: the existence of a tenth inning is itself a spoiler, because it tells you the ninth ended level. So a game shows nine innings until you have revealed through the ninth, and the tenth appears only then, one at a time after that. It is the smallest detail here and it is the one that keeps the rest honest.',
      ],
    },
    {
      id: 'unseal',
      kind: 'prose',
      heading: 'When you want it spoiled',
      body: [
        'Sometimes you do want the score. You fell asleep in the sixth and you are not going to finish. You are checking a result from three weeks ago. A friend asked. A tool that cannot be turned off is a tool people stop trusting, so there is a switch: Scores Unlocked, which unseals the scores for a day you choose to spoil.',
        'It asks first. You say which day you are willing to see, and it opens that day. Nothing is unsealed on your behalf and nothing is unsealed by accident — the consent is the feature, not a formality attached to it. Days you have not agreed to spoil stay as they were.',
      ],
    },
    {
      id: 'faq',
      kind: 'faq',
      heading: 'Common questions',
      items: [
        {
          q: 'Does this work for a game that ended hours ago?',
          a: 'Yes, and that is the main case it was built for. A finished game behaves the same as a live one: the innings are sealed, and you reveal them at whatever pace you are watching.',
        },
        {
          q: 'Will it send me a notification about the score?',
          a: 'No. Tally does not send notifications at all, which means it cannot be the thing that spoils you from a lock screen. You still need to turn off alerts from other sports and news apps, because that is outside anything Tally can reach.',
        },
        {
          q: 'Can I turn the protection off?',
          a: 'Yes. A site-wide switch called Scores Unlocked will unseal the scores for a day you name, and it asks you to confirm that day first. It is opt-in and it is reversible.',
        },
        {
          q: 'Does it work on a phone?',
          a: 'It was designed for a phone first. It runs in a mobile browser with nothing to install, and you can add it to your home screen so it opens like an app. No account is needed. Signing in is optional, and its only effect is carrying your place in a game between your own devices.',
        },
        {
          q: 'What about the standings page — is that not a spoiler?',
          a: 'Standings, leader boards, and season and career statistics stay open in Tally the whole time, because a stat line is not a score. That is a real trade-off worth knowing: a team record does move once a game ends. Mid-game, stay on the game, the lineups and the player pages, which carry no result.',
        },
      ],
    },
    {
      id: 'related',
      kind: 'related',
      heading: 'Keep going',
      items: [
        { text: 'How to score a baseball game', href: '/learn/score-a-baseball-game' },
        { text: 'Keeping score at the ballpark', href: '/learn/score-at-the-ballpark' },
        { text: 'How to read a box score', href: '/learn/read-a-box-score' },
        { text: 'The baseball statistics glossary', href: '/learn/stats-glossary' },
      ],
    },
  ],
}
