# Tally Baseball

**A spoiler-safe second screen for people who keep score by hand.**

[tallybb.com](https://tallybb.com) · installable PWA · no sign-in
needed

Tally Baseball sits next to your paper scorebook. It looks up the game in front
of you and shows what you need to fill the book in: lineups, uniform numbers,
umpires, the bullpen, and the bench. Every number that can give the game away
stays sealed until you tap to reveal it.

The app does not score the game for you. You do that on paper. This is the
lookup tool beside the book — and, when the game ends, a compact baseball
reference you can wander through.

---

## The one promise

**On the surfaces you score from, a sealed number is not on your screen.** It is
not faded out. It is not behind a sticker you can peek under. It is not sitting
in the page, waiting to flash. The app does not fetch it or compute it until you
ask. When an inning re-seals, the number goes away again. The browser tab title
and the game cards stay score-free too.

That rule covers the scoring path: the day's slate, the two team pages, the
innings viewer, and the box score. Everything else about baseball opens live —
season and career stats, player and team pages, leaderboards, and standings. A
stat line is not a score.

Two opt-in switches lift the seal, and you have to ask for both:

- **Scores Unlocked** — a site-wide pass for the day you agree to spoil. Use it
  when you are not scoring and just want to glance at the numbers. It never
  changes what you have revealed by hand.
- **Stamp In** (`/team/{id}/stamp-in`) — one club's played season with every
  result showing, so you can stamp the games you watched. Nothing on the page
  loads until you agree to see it.

---

## Following a game

**Pick your game.** The app opens on the day's slate. Switch between the majors
and the four full-season minor-league levels (AAA, AA, A+, A) with the toggle at
the top, and step a day forward or back. The Brewers sit pinned to the top. Each
card gives you the start time and the game state, but never the score — not even
for a game that ended last week. A readiness pill tells you which pieces your
scorebook needs are posted yet: both lineups, the umpires, and the starting
pitchers.

**Check the teams.** Before first pitch, page through each club: the batting
order with numbers and positions, the starting pitcher with a season line and
throwing hand, the manager, the umpires, the ballpark, the weather, first-pitch
time, and tonight's uniforms. A diamond sketch shows the other team's defensive
alignment. If the lineup is not posted yet, the page shows the full active
roster instead, so you never look at a blank sheet.

**Move through the game one half-inning at a time.** Each half opens with a
cover that reads *"Tap to reveal."* Until you tap, there is no score on the
screen. When your book is caught up, tap once and the whole half opens:

- runs, hits, errors, and runners left on base
- pitch count for the half, plus a running total
- whiffs (swinging strikes) and first-pitch strikes
- the full play-by-play — every plate appearance, the pitch sequence, how each
  out was made, and where the runners finished
- Statcast bests for the half: fastest pitch, hardest-hit ball, and longest fly,
  where the ballpark tracks them

A line score builds across the top as you go, and it doubles as a navigator. Tap
any inning to jump to it. A pitchers table keeps a running tally for both
staffs, and a win-probability chart traces the game's swings up to the exact
point you have revealed.

**Extra innings never leak.** The app shows nine regulation innings up front.
Extras unlock one at a time, and only after you reveal the inning before.
Nothing on screen hints that a game went long before you get there.

**The bullpen and bench stay one tap away.** A collapsible panel lists the
relievers still available with their throwing hands, the bench players who have
not entered, and each team's lineup and defense as they stand entering the half
you are on. It reveals nothing about the score.

**The box score waits for you.** One button opens a full, MLB-style box score,
sealed until you tap: the line score, pitchers of record, three stars, both
batting and pitching lines with every substitution, the defensive alignment, the
game-info footer, and each club's game story from MLB.com.

**A live scorecard, filled exactly as far as you've revealed.** A tab on the
game turns the whole lineup card into a Numbers Game "22" sheet you can fill on
screen, one at-bat at a time, in step with your own reveals. Before first
pitch, the same game gives you a printable pre-pitch scorecard for filling in
by hand, and a shareable preview card with both lineups and the day's matchup —
neither one carries a score.

---

## Exploring the rest of baseball

**Player pages.** Tap any name — in a lineup, a box score, or a leaderboard. You
get the headshot, bio, handedness, draft info, and MLB debut, then this season's
line, a pitcher's pitch mix, the game log, splits against lefties and righties,
and a career register that blends major- and minor-league seasons. A "Path to
the Majors" strip traces every level the player climbed, timelines list every
club and every transaction, and "firsts" link to the game of a first hit or a
first win. A contract history lists each arbitration case, extension, and
free-agent deal by season, with what it paid. Prospects, All-Stars, rehab
assignments, and Injured List stints are all flagged.

**Team pages.** Tap a logo for the club hub: Overview, Roster, Games, Numbers,
Contracts, and Minors. Each tab is its own address and loads only its own data.
You get the record and division rank, a month of schedule, the division
standings, league ranks in every hitting and pitching category, the roster with
WAR, the Injured List, the payroll, and a leaders page for the club. A "Last
Time" card tracks what the club has stopped doing and when it last did it —
its last shutout, its last road-trip-opener win — across a decade of games. A
minor-league club also shows its parent organization, its affiliation history,
and the farm system.

**Standings** open *through yesterday*, so today's games cannot spoil you. One
tap brings in today. You can also scrub back to any earlier date.

**Search** any player or team by name from the footer. "Find a past matchup"
takes two clubs and a season, then lists every game they played. Each one opens
its box score, sealed until you tap.

Standalone reference pages, all reachable from the menu and the slate footer:

| Page | What it gives you |
|---|---|
| Standings | Both leagues, through yesterday by default |
| Postseason Race | The six-team postseason field, narrowed from Standings |
| League Leaders | The majors, one league, one minor-league level, or one organization's whole system |
| Run Value Leaders | Bat, glove, legs, and arm, added up on one scale of runs |
| Situational Records | One record at a time, every club at a level, ranked |
| Salaries | Who is paid the most, and what each club spends |
| Foul Tracker | Season foul-ball boards for batters and pitchers, plus the top foul games |
| Umpire Rankings | Every qualifying plate umpire, ranked by called-pitch accuracy, plus a page per umpire |
| ABS Challenges | The season board for the Automated Ball-Strike challenge system |
| Attendance | Season crowds, by club |
| Bullpen Availability | How much work each staff's relievers have already logged |
| Pace of Play | Game length across the league, tracked over the season |
| Doubleheaders | Every doubleheader this season, and how each club fared |
| Top MLB Prospects | The current Top 100, each row linked to the player |
| Farm System Rankings | Every organization's farm system, ranked |
| Rehab Assignments | Every big leaguer on a minor-league rehab stint, and where |
| Milestone Watch | Career counting stats in reach this season, with projections |
| Awards History | Past award winners |
| Postseason History / Leaders | Series by series, plus all-time postseason leaders |
| Trade Deadline | Deadline moves, by season |
| All Star Game / Legacy | Rosters for the current game, and the history behind it |
| Logo Sheet | A grayscale sheet of every club at one level, to trace into your book |

---

## Pages that are yours

- **Game Log** (`/logbook`) — when a game is final and you have revealed the box
  score, you can press a one-color commemorative **stamp**: the final score,
  both clubs, the date, and the venue. Stamps collect into passport books that
  you arrange by hand, eight to a page. A retrospective adds the collection up —
  clubs seen, your record watching them, and the span of dates you covered.
- **My Tally** (`/profile`) — the club you follow, how this device behaves, and
  what an account carries between devices. It shows no game data at all.
- **My First Scorebook** (`/first-scorebook`) — a retrospective on the
  maintainer's first season of scoring by hand.
- **Game Photos** (`/photos`) — full-resolution editorial photos for a game that
  is already decided. This page sits outside the sealed scope on purpose, so
  open it after you close the book.

---

## Install it on your phone

The app runs in a browser. Add it to your home screen and it opens full-screen,
like any other app.

1. Open the address in **Safari** on your iPhone.
2. Tap **Share**, then **Add to Home Screen**.
3. Launch it from the new icon. No app store, no sign-in.

It updates itself. Reopen it to get the current version.

---

## A note on the minor leagues

Minor-league feeds publish less than the majors. A lineup, the weather, or a
logo is often missing. The app then shows a dash or "not posted yet" instead of
a guess. Look again closer to first pitch and the details usually fill in.

---

## For developers

React 19 and Vite, phone-first, installable PWA. Every device queries
`https://statsapi.mlb.com` directly for game data; `api/` adds a set of
optional Vercel functions for everything else (see Layout, below). There is no
router library and no state library: routing is a small parse/build pair in
`src/lib/route.js`, and fetching goes through one `useAsync` hook.

### Quick start

```bash
npm install
npm run dev       # http://localhost:5173
```

Add `?nointro` to a test URL, so the first-visit welcome modal does not cover
the page.

Do you run more than one dev server at a time? Ports `5173` (dev) and `4173`
(preview) use `strictPort`, so a second server on the same port fails instead of
colliding silently. Take the next numbered slot:

```bash
npm run dev:2     # 5172 — if 5173 is taken
npm run dev:3     # 5171
npm run dev:4     # 5170
npm run dev:5     # 5169
```

Preview does the same: `preview:2..5` → `4172..4169`.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 5173 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built app |
| `npm run lint` | ESLint, plus the repo's guard scripts (caps, casing, typography, contrast, spoiler manifest, directory and file size, …) |
| `npm test` | The `node:test` unit suite over the pure data layer |
| `npm run test:coverage` | The same suite, with per-file coverage |
| `npm run e2e` | Playwright, the browser verification harness |

Lint, the unit suite, and the build gate every pull request into `main`. The
Playwright suite is a verification tool, not a CI gate. For a user-visible
change, also load the route you changed in a browser.

### How the spoiler rule is enforced

The promise at the top of this file is structural. It does not depend on a
convention that people remember:

- **Reveal-only modules** (`src/api/linescore.js`, `src/api/derive.js`) may run
  only inside a reveal render function. `src/api/select.js` is spoiler-free and
  may run anywhere. `spoiler-manifest.json` records the split, and a lint guard
  checks it.
- **`SealBox`** takes its children as a render function and calls that function
  only after the reveal. A sealed value is therefore never built, so it can
  never sit in the DOM. Reveal goes one way, and navigation to a new inning
  remounts the box.
- **The service worker uses `NetworkOnly`** for `statsapi.mlb.com`, so a stale
  cached response can never serve an old score.
- **The reveal mark is a half-index, never a score.** It persists per game in
  `localStorage`, under `bbsbh:reveal:{gamePk}`.

`docs/adr/` holds the reasoning, and the bug that produced each rule. Read the
related ADR before you change reveal logic.

### Layout

```
src/screens/      one file per screen (GameSelect, GameView, InningViewer, …)
src/components/   UI, grouped by area; SealBox.jsx is the reveal primitive
src/api/          the data layer — reveal-only and spoiler-free, split by module
src/lib/          routing, teams, dates, stamps, account helpers
src/tokens/       design tokens; src/styles/ holds the ordered CSS partials
scripts/          data generators (gen-*.mjs) and lint guards (check-*.mjs)
api/              optional Vercel functions, each one inert until configured
test/             node:test unit suite;  e2e/  Playwright specs
docs/             reference docs, and docs/adr/ decision records
public/data/      precomputed JSON from the nightly generators
```

The optional functions in `api/` cover link previews, reveal sync across your
own devices, editable copy, preferences, and the Game Log's books and stamps.
Each one stays inert until you configure its environment, so a plain clone
runs the same as it would with none of them set up. `docs/api/` describes
them.

### Docs map

| File | What it covers |
|---|---|
| `CLAUDE.md` | The project in one pass, plus the rules a contributor must follow |
| `CONTEXT.md` | Domain glossary — the vocabulary the other docs assume |
| `src/CLAUDE.md`, `src/api/CLAUDE.md` | Per-area detail for the UI and the data layer |
| `docs/adr/` | Why each decision was made, and what broke before it |
| `docs/development.md` | The full local workflow |
| `docs/testing.md` | What the suites cover, and the CI gate |
| `docs/MLB_STATS_API.md` | Feed shapes, verified against real games |

### Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Open an issue before you start
anything more than a trivial fix. Work on a branch. Never push to `main`, which
deploys.

---

## Data and affiliation

Game, roster, player, and statistical data come from the public MLB Stats API
and related public sources. Tally Baseball is an independent project. It has no
affiliation with MLB, MiLB, or any club.

## License

[MIT](LICENSE).
