# Wire voice audit (2026-11-03)

Source: every note pinned in test/wire-templates.test.js and test/wire-call-templates.test.js
(real players: Sproat, Rutschman, McGee, Longoria, Suárez, Perkins, Dobnak, Naylor...).
Not yet done: a pass through /wire-lab presets on a dev server (do it at build time).

## How newspapers write a transactions note (AP agate, MLB.com, beat columns)
- Name, age in commas: "Sproat, 25, ..." — not "The 25-year-old".
- One fact per clause, numbers not adjectives: "is 2-5 with a 5.12 ERA in 22 starts".
- Drop what the headline already says ("before the call", "before the move", "in the majors").
- Current season is "this season"; years only for other seasons.
- Present tense for state ("has one option left"), past for what happened.
- Short verbs: "was 1-for-4", "gave up four earned runs in three innings".
- Numbers under 10 spelled out in prose (AP): "four earned runs", "three homers".

## Problems found
Long (over ~30 words): first call-up (45), Suárez debut+clubs (31), Sproat option (37),
Rutschman third stint (30), McGee "had been with ... and in that time he" (24, padded).
Stock phrases repeated on every row:
- "before the call" / "before the move" / "before the trade" (5 templates)
- "The NN-year-old" opens every minor-deal, trade, cut, arrival, first call-up
- "He has N minor-league option(s) left." verbatim on every option and cut
- "It is his Nth ..." (IL stints, trips up, first call)
- "in 2026" where the season is the current one
Not beat-writer voice: "outside affiliated ball", "did not get into a game on this trip",
"The move clears a 40-man roster spot, and he stays in the organization",
"made his major league debut in 2014 and has played 13 seasons".
