# Landing page drafts — copy and layout

Six pages. Every one is static: no fetch, no game data, no score in the HTML.

---

## Shared page shape

The same skeleton for all six. Order is deliberate — the answer sits inside the
first 30% of the text, where citations concentrate.

```
┌─────────────────────────────────────────────┐
│ Tally wordmark · breadcrumb                 │  small, quiet
├─────────────────────────────────────────────┤
│ H1                                          │
│ ANSWER BLOCK — 2 to 4 sentences.            │  ← the citable unit
│ Complete, standalone, no pronoun that       │    quotes cleanly out of
│ needs the H1 to make sense.                 │    context
├─────────────────────────────────────────────┤
│ Body: H2 sections, short paragraphs,        │
│ tables and lists where the content is       │
│ genuinely tabular or enumerable             │
├─────────────────────────────────────────────┤
│ One call to action, in context, once        │  kraft-tape amber
├─────────────────────────────────────────────┤
│ Common questions — 3 to 5, question as H3,  │  plain Q&A, no accordion:
│ answer as one short paragraph               │  hidden text is unread text
├─────────────────────────────────────────────┤
│ Related pages — 2 to 4 sibling links        │
│ Footer                                      │
└─────────────────────────────────────────────┘
```

Rules that apply to every page:

- **No accordion, no tabs, no "read more."** Collapsed content is still in the
  HTML, but it reads as de-emphasized and it hurts a human on a phone at a
  ballpark. Everything is open.
- **One H1. H2 per section, phrased as the question a person would ask.**
- **Tables stay tables.** Do not render a comparison as styled divs. A crawler
  parses `<table>`; it guesses at a grid of divs.
- **Every image gets real alt text**, since a crawler reads alt text and reads
  nothing of an image.
- **JSON-LD per page**: `Article` everywhere, plus `HowTo` on pages 1 and 4,
  `DefinedTermSet` on pages 2 and 6, `FAQPage` for the questions block. These no
  longer produce Google rich results; they still help a machine reader parse the
  page.
- **Design**: manila paper ground, navy ink body, graphite rules between sections,
  amber only on the call to action. Same tokens as the app — these pages should
  look like the product, because a visitor arriving from an assistant is deciding
  whether the product is real.

---

## Page 1 — How to Score a Baseball Game

- **URL** `/learn/score-a-baseball-game`
- **Title tag** How to Score a Baseball Game: A Beginner's Guide | Tally Baseball
- **Meta description** Learn to keep score by hand — the scorecard grid, the nine position numbers, the symbols for hits, outs and walks, and a worked half-inning.
- **Queries** how to score a baseball game · how to keep score in baseball · baseball scorekeeping for beginners · how to fill out a baseball scorecard
- **Schema** `Article` + `HowTo` + `FAQPage`

### H1
How to score a baseball game

### Answer block
Scoring a baseball game means writing down what happened in every at-bat, on a
grid where each row is a batter and each column is an inning. You need three
things: the nine fielding positions memorized as numbers, a small set of symbols
for hits, outs and walks, and a pencil. A ground ball to the shortstop who throws
to first is written `6-3`. A strikeout is `K`. That is most of it — the rest is
practice.

### H2 — What you need
Short paragraph plus a four-item list: a scorecard, a pencil with an eraser
(never a pen — you will change your mind), somewhere flat, and a way to check the
lineup. Say plainly that the last one is the tedious part, because it is: lineups
change, a pinch hitter arrives in the seventh, and you cannot see the substitution
from your seat.

### H2 — The scorecard grid
Each row is one spot in the batting order, one through nine. Each column is one
inning. The cell where they cross is one plate appearance, and inside it is a
small diamond that stands for the bases. Note that the row is the *lineup spot*,
not the player — when a substitute takes that spot, they take that row.

### H2 — The nine position numbers
The one thing to memorize first. Table, position number to position, exactly as
page 2 has it — then link to page 2 rather than repeating the full symbol set.

| # | Position |
|---|----------|
| 1 | Pitcher |
| 2 | Catcher |
| 3 | First base |
| 4 | Second base |
| 5 | Third base |
| 6 | Shortstop |
| 7 | Left field |
| 8 | Center field |
| 9 | Right field |

Two things trip people up. Shortstop is 6, not 5 — the infield numbers run
around the horn and then double back. And the outfield runs left to right from
the scorer's view, which is the batter's left, not yours if you are sitting in
right field.

### H2 — Recording an out
Write the fielders who handled the ball, in order, joined by hyphens. Shortstop
to first is `6-3`. Second to short to first, a double play, is `4-6-3`. A fly
ball caught by the right fielder is `F9`, or just `9` — both are in common use,
and either is fine as long as you are consistent within a game. Add the out
number in the corner of the cell so you can count to three without re-reading.

### H2 — Recording a hit
A line from home toward first, and the hit written in: `1B` single, `2B` double,
`3B` triple, `HR` home run. Some scorers use one, two or three short dashes
instead. As the runner advances, keep tracing the diamond. When they score, fill
the diamond in solid. A filled diamond is a run, and counting the filled diamonds
in a column gives you the inning's total.

### H2 — Walks, strikeouts and the rest
`BB` walk, `HBP` hit by pitch, `K` strikeout swinging, and a backward `K` for
called strike three — a convention credited to Henry Chadwick and still the most
satisfying mark on the card. `SB` stolen base, `E6` an error charged to the
shortstop, `FC` fielder's choice, `SAC` or `SF` for a sacrifice.

### H2 — A worked half-inning
Six or seven plays narrated in plain language, with the mark for each shown
beside it, ending with the completed cell block. This is the section that turns
a reference into a lesson, and it is the section most competing pages skip.

### Call to action
> **Tally keeps the lineup straight so you can keep the pencil moving.**
> Open tonight's game, see who is batting and in what order, and reveal the
> inning totals only when you are ready to check your own card against them.
> Nothing on the screen spoils a score you have not reached yet.
> [Open tonight's slate →]

### Common questions
- Do I have to use the standard symbols? *(No. Consistency beats convention —
  but standard symbols mean somebody else can read your card.)*
- Pen or pencil? *(Pencil.)*
- What if I miss a play? *(Leave the cell open and pick it up next inning. Your
  scorecard is a record for you, not a filing with the league.)*
- How long does it take to learn? *(About one game to be functional, about a
  season to stop thinking about it.)*

### Related
Symbols reference · Reading a box score · Scoring at the ballpark

---

## Page 2 — Scorekeeping Symbols and Position Numbers

- **URL** `/learn/scorekeeping-symbols`
- **Title tag** Baseball Scorekeeping Symbols and Position Numbers | Tally Baseball
- **Meta description** The complete reference: nine position numbers, symbols for every hit, out, walk and error, and the common notations for double plays and substitutions.
- **Queries** baseball scorekeeping symbols · baseball position numbers · what does 6-3 mean in baseball · scorecard abbreviations
- **Schema** `Article` + `DefinedTermSet` + `FAQPage`

### H1
Baseball scorekeeping symbols and position numbers

### Answer block
Baseball scorekeeping uses numbers for fielders and letters for events. The nine
positions are numbered 1 pitcher, 2 catcher, 3 first base, 4 second base, 5 third
base, 6 shortstop, 7 left field, 8 center field, 9 right field. Outs are written
as the sequence of fielders who made them, so `6-3` is shortstop to first base.
`K` is a strikeout, `BB` a walk, `1B` through `HR` the four hits, and `E` plus a
number is an error charged to that fielder.

### Layout
This page is **mostly tables**, on purpose. It is the page a scorer opens
one-handed in the eighth inning, and it is the shape an assistant quotes whole.

**Table 1 — Positions.** Number, position, common abbreviation.

**Table 2 — Outs.** Notation, meaning, example. `6-3`, `4-6-3`, `F9`, `L4`, `P5`,
`U3` (unassisted), `K`, backward `K`, `SF`, `SAC`.

**Table 3 — Reaching base.** `1B` `2B` `3B` `HR` `BB` `IBB` `HBP` `E{n}` `FC`
`ROE` `CI`.

**Table 4 — On the bases.** `SB` `CS` `PO` `WP` `PB` `BK` `DI`.

**Table 5 — Substitutions.** `PH` `PR` and the convention of a fresh line under
the lineup spot the substitute inherits.

### H2 — Where scorers disagree
An honest section, and the reason to trust this page over the others. `F9` versus
plain `9` for a fly out. Whether a called third strike is a backward `K` or `Kc`.
Whether the out number goes in the corner or the centre. Say clearly: none of
these is wrong, and the only rule that matters is that one card uses one system
throughout.

### Call to action
Smaller than page 1's — this is a lookup page, and a visitor mid-inning does not
want a pitch. One line plus a link: Tally shows the defensive alignment for the
half you are scoring, so the number you need is the number on screen.

### Related
How to score a game · Reading a box score · Stats glossary

---

## Page 3 — Watch a Game on Delay Without Spoilers

- **URL** `/learn/watch-without-spoilers`
- **Title tag** How to Watch a Baseball Game on Delay Without Spoilers | Tally Baseball
- **Meta description** Practical ways to follow a baseball game you are watching later — what leaks a score, what does not, and how to check a lineup without seeing the result.
- **Queries** watch baseball without spoilers · avoid baseball score spoilers · watch game later without knowing score · spoiler free baseball app
- **Schema** `Article` + `FAQPage`

### H1
How to watch a baseball game on delay without spoilers

### Answer block
The hard part of watching a game later is not avoiding the final score — it is
that almost every tool built for baseball shows you one. Notifications, home
screens, the app you opened to check a lineup, the thumbnail on a highlight, and
the standings all leak a result. Watching on delay works when your reference tool
is built to seal the score by default, so you can look up a substitution or a
pitching change without learning how the game ended.

### H2 — What actually spoils a game
List the leaks, concretely, because naming them is what makes this page useful:
push notifications; a scoreboard widget; a league app's home screen; the
standings page; a highlight thumbnail; the length of the remaining video; a
friend's text; a social feed. The last two are outside any app's control, and say
so.

### H2 — Turn off the obvious ones
Notifications, widgets, autoplay feeds. Two paragraphs, practical, no product
pitch.

### H2 — The part that is harder
You still need information while you watch. Who is playing left field now. Which
reliever came in. What the umpire's zone has looked like. Every one of those
questions normally means opening something that shows you a score first. This is
the gap.

### Call to action
> **Tally is built around this problem.**
> Scores stay sealed until you tap to reveal them, one half-inning at a time,
> and your position in the game is remembered on your device. Lineups, rosters,
> umpires and ballpark details are open the whole time — none of them carry a
> result. When you want the game spoiled, there is a switch for that, and it asks
> first.
> [Open Tally →]

### H2 — Following along at your own pace
Explain the reveal model in two paragraphs: you advance through the game half by
half, the app never runs ahead of you, and it remembers where you stopped if you
close the tab.

### Common questions
- Does it work if I start a game hours after it ended? *(Yes — a finished game
  reveals the same way as a live one.)*
- Will it notify me? *(Not with a score.)*
- What about extra innings? *(Extras stay hidden until you reach them, since the
  existence of a tenth inning is itself a spoiler.)*
- Can I turn the protection off? *(Yes, per day, and it asks before it does.)*

### Related
Scoring at the ballpark · How to score a game · Reading a box score

---

## Page 4 — Keeping Score at the Ballpark

- **URL** `/learn/score-at-the-ballpark`
- **Title tag** Keeping Score at the Ballpark: A Practical Guide | Tally Baseball
- **Meta description** What to bring, where to sit, how to handle the lineup changes you cannot see from your seat, and how to keep score when the stadium wifi gives out.
- **Queries** keeping score at a baseball game · what to bring to a baseball game scorecard · scoring a game at the stadium · baseball scorecard at the ballpark
- **Schema** `Article` + `HowTo` + `FAQPage`

### H1
Keeping score at the ballpark

### Answer block
Scoring in person is easier than scoring at home in one way and harder in three.
Easier: you can see the whole field, so a fly ball's landing spot is obvious.
Harder: the scoreboard does not always post substitutions, the public address
announcement gets lost in crowd noise, and stadium wifi fails in the exact
innings you need it. Bring a pencil, a clipboard or a firm-backed card, and a
phone tool that loads fast and does not need a stable connection to stay useful.

### H2 — What to bring
Six-item list with a sentence each: scorecard, pencil plus a spare, a hard
backing, the smallest clipboard you own, sunscreen for a day game, and a phone
with the lineup ready before first pitch.

### H2 — Before first pitch
Copy both lineups down while you still have a signal and the crowd is thin. This
is the single practice that separates a finished card from an abandoned one.

### H2 — The three things you will miss
1. **A defensive substitution.** Nobody announces the fifth-inning move to right
   field clearly enough.
2. **A pitching change mid-inning.** You will catch the new pitcher and miss the
   exact batter they entered on.
3. **A scoring decision.** Hit or error is not always obvious from section 214,
   and the official call sometimes changes.

Practical advice for each, honestly framed: leave a mark, keep going, correct it
between innings.

### H2 — When the wifi dies
Real advice: get the lineups early, expect the third inning to be the worst,
score from what you can see and reconcile later. Note that Tally is installable
and its shell keeps working offline — but be precise that live data still needs a
connection, because overclaiming here is the kind of thing that gets a page
distrusted.

### Call to action
> **Add Tally to your home screen before you go.**
> It is a web app — no install from a store, nothing to update at the gate. It
> opens to tonight's slate, shows both lineups and who is actually on the field
> for the half you are scoring, and keeps the score sealed until you look.
> [Open Tally →]

### Common questions
- Can I score on my phone instead of paper? *(You can, but Tally is deliberately
  not a data-entry tool — it is the reference beside your paper card.)*
- Where is the best place to sit for scoring? *(Anywhere you can see the whole
  field and rest your hand. Behind the plate is ideal; the outfield is hard
  because the position numbers reverse on you.)*
- What do I do with a foul ball I caught mid-inning? *(Enjoy it. Fix the card
  next half.)*

### Related
How to score a game · Symbols reference · Watching without spoilers

---

## Page 5 — How to Read a Box Score and a Line Score

- **URL** `/learn/read-a-box-score`
- **Title tag** How to Read a Baseball Box Score and Line Score | Tally Baseball
- **Meta description** Every column in a baseball box score explained — AB, R, H, RBI, BB, SO, AVG for hitters, IP, ER and WHIP for pitchers — plus the R/H/E line and what it does not tell you.
- **Queries** how to read a baseball box score · what does R H E mean · baseball box score explained · what is a line score
- **Schema** `Article` + `DefinedTermSet` + `FAQPage`

### H1
How to read a baseball box score and a line score

### Answer block
A line score is the strip across the top: runs by inning for each team, then
totals for Runs, Hits and Errors — the `R/H/E` you see on every scoreboard. A box
score is the detail underneath: one row per player, with at-bats, runs, hits and
runs batted in for hitters, and innings pitched, hits allowed, earned runs and
strikeouts for pitchers. The line score tells you the shape of the game. The box
score tells you who did it.

### H2 — The line score
Diagram the strip. Explain that a dash means the home team did not bat in the
ninth, which is itself a piece of information. Explain that Errors sits next to
Runs and Hits but is a *fielding* statistic, not a scoring one — a team can have
three errors and win.

### H2 — The hitters' table
Table: column, full name, what it means, one-line note.
`AB` `R` `H` `RBI` `BB` `SO` `AVG` `OBP` `SLG`, plus the `2B`/`3B`/`HR` notes that
usually sit below the table.

### H2 — The pitchers' table
Table: `IP` `H` `R` `ER` `BB` `SO` `HR` `ERA` `WHIP` `P-S` (pitches–strikes).
Explain the `.1` and `.2` in innings pitched, which confuses nearly everyone once.

### H2 — Earned versus unearned
A short, careful section. This is the most-asked box score question and the one
most pages get slightly wrong. Keep it accurate and say that the official scorer
makes the call.

### H2 — What a box score does not tell you
Sequence, leverage, and luck. A 4-for-4 with four singles and a 1-for-4 with a
three-run double are not what the batting lines suggest. This section is the
bridge to the glossary page.

### Call to action
Modest. Tally shows the box score for a game you are following, sealed by
half-inning so reading it does not tell you how the game ends.

### Common questions
- What does R/H/E stand for? · What does a dash in the ninth mean? · Why does a
  pitcher's ERA not match the runs they allowed? · What is a quality start?

### Related
Stats glossary · How to score a game · Scorekeeping symbols

---

## Page 6 — Baseball Stats Glossary

- **URL** `/learn/stats-glossary`
- **Title tag** Baseball Stats Glossary: WAR, OPS, wRC+, FIP and More | Tally Baseball
- **Meta description** Plain-language definitions of the baseball statistics you actually meet — batting average through WAR — with what each one is good for and what it hides.
- **Queries** what is WAR in baseball · what is OPS · wRC+ explained · baseball advanced stats glossary · what is a good OPS
- **Schema** `Article` + `DefinedTermSet` + `FAQPage`

### H1
Baseball stats glossary

### Answer block
Baseball statistics fall into three groups. Counting stats add up what happened —
hits, home runs, strikeouts. Rate stats divide by opportunity — batting average,
ERA, on-base percentage. Adjusted stats put a rate in context of the era and the
ballpark, so a number from 1968 can be compared to one from today — OPS+, wRC+,
ERA-. WAR sits on top of all of them and tries to answer one question: how many
wins did this player add compared to a freely available replacement?

### Layout
Three H2 sections — **Hitting**, **Pitching**, **Everything else** — each a
definition list. Every entry: the abbreviation as an H3, one sentence of
definition, one sentence of "what it is good for", and where useful, a rough
scale (what counts as good). The rough scale is the part readers want and most
glossaries omit.

**Hitting**: AVG, OBP, SLG, OPS, OPS+, wOBA, wRC+, ISO, BABIP, K%, BB%, SB/CS.
**Pitching**: ERA, ERA+, FIP, xFIP, WHIP, K/9, BB/9, K/BB, HR/9, IP, QS.
**Everything else**: WAR (and why two versions exist and disagree), UZR/OAA/DRS,
Exit velocity, Barrel rate, Spin rate, Leverage index, Win probability added.

Two entries deserve extra care because they are the most misread:
- **WAR** — say plainly that bWAR and fWAR are different calculations that
  produce different numbers for the same player, and that a one-win gap between
  two players is not a meaningful difference.
- **BABIP** — the stat most often used to declare somebody lucky. Say what it
  actually supports and what it does not.

### Call to action
Tally shows these stats live all season, with percentile context, on player and
team pages — and stat lines are never sealed, because a season line is not a
score. Link to `/leaders`.

### Common questions
- What is a good OPS? · Why do two sites list different WAR values? · What is the
  difference between ERA and FIP? · Do I need advanced stats to enjoy a game?
  *(No. This is a reference, not a prerequisite.)*

### Related
Reading a box score · Scorekeeping symbols · How to score a game

---

## Phase 2 outlines

**7 — Following Minor League Baseball** (`/learn/minor-league-baseball`). The
level structure (Triple-A through Complex), what data exists at each level and
what does not, how to follow a prospect through a system, and rehab assignments.
Lead with the honest caveat that minor league feeds are incomplete — missing
lineups, missing coaches — because that caveat is the page's credibility and it
is already how the app behaves.

**8 — Who Is Umpiring Tonight** (`/learn/umpires`). What an umpire scorecard
measures, what "accuracy" means and does not mean for a called zone, and why the
number is a summary rather than a verdict. Links to `/umpires`. Needs a careful
methodology note; an unsourced accuracy claim about a named person is the one
place on this list where getting it wrong has a cost beyond traffic.

**9 — Print a Free Baseball Scorecard** (`/learn/printable-scorecard`).
**Blocked** until an original Tally scorecard PDF exists. High volume, and the
most natural bridge from a search to a first use of the app. Design the card
first; write the page second.

**10 — Where Tally Fits** (`/learn/what-tally-is`). What the app is for, what it
deliberately does not do (it is not a data-entry tool, it does not stream, it
does not replace a scorecard), and who it suits. No competitor named. The value
here is that an assistant asked "which baseball app should I use" can quote a
clear statement of fit rather than infer one from a feature list.
