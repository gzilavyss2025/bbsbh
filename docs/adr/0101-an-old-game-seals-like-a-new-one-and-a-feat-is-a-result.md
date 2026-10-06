# An old game seals like a new one, and a feat is a result

**Status:** Accepted (2026-10-06). Gary chose this design (D1 in
`.scratch/old-games/decisions.md`, 2026-10-06). Accepted with the feat label that builds it.
**Date:** 2026-10-06
**Extends:** ADR-0081 (a length is not a result; a season record is a labelled door).
**Relies on:** ADR-0002 (the `SealBox` render function), ADR-0049 (the box score you
opened stays open), ADR-0080 (a game is offered on who played in it).

## Context

Three planned features read old games: a shelf of notable performances (no-hitters,
cycles, triple plays), old-game pages, and a callout that names the last time a rare play
happened. The plan and its measurements are in `.scratch/old-games/plan.md` and
`findings.md`.

Two facts shape the seal.

1. **Old games already open on the game route.** `/{MMDDYYYY}/{matchup}/{section}` has
   no year floor (`urlDateToApi` in `src/lib/route.js`). The schedule gives each club's
   abbreviation of that season (1927: `PHA`, `NYG`; 1956: `BRO`). `FirstScorebookPage`
   and `PostseasonSeriesPage` already print old scores in the open and link into the
   sealed `boxscore` section. So an old-game page is the scoring surface the app
   already has. It is inside the spoiler rule's scope.
2. **A feat names the result.** "No-hitter" tells a reader that one club had no hits.
   "Cycle" is one batter's whole line. "Triple play" is one play's outcome. ADR-0081
   rule 1 asks whether a fact is a result. A length is not. A feat is.

**The hard case is a reader who may already know the game.** Don Larsen's 1956 perfect
game is famous. A reader who taps it on the shelf has just read "perfect game". The app
cannot know what a reader knows, and it cannot know how a reader arrived. A shared link,
a typed URL and a shelf link all reach the same address.

## Decision

**An old game seals exactly like a new one. Age, arrival and a URL flag never open a
seal. A feat label is a result: on a scoring surface it renders only inside a reveal,
and off one it sits behind a labelled door.**

### 1. What is open and what is sealed on an old-game page

| Item | State | Rule |
| --- | --- | --- |
| Title, teams, date, park | Open | They say who played (ADR-0080). The matchup is in the URL, so a seal on it would claim a protection the page cannot give. |
| Lineups, umpires | Open | As on every game page. |
| Score, line score, box score | Sealed | The box score's `SealBox` (ADR-0002). A tap writes `bbsbh:boxreveal:{gamePk}` (ADR-0049). |
| Feat label | Sealed | It renders inside the box score's reveal function, beside the box. |
| Half-inning pages | Sealed | As today, and only where the feed has plays. The "no play-by-play" notice shows only for a season before 1960 (D14): from 1960 on, a played game with no plays is almost always a forfeit, so a notice before the reveal hints at the result. |

The three existing openers keep their meaning with no change: the day pass (ADR-0026)
opens any date while it runs; a stamp opens its game (ADR-0048); a remembered tap opens
its box score (ADR-0049). This ADR adds no fourth opener.

### 2. The app does not guess what a reader knows

The page asks once, with one tap. ADR-0049 remembers the answer on every device the
reader owns, so a reader who knows the game pays one tap, once. The two errors are not
equal. A reader who knew the game and had to tap has lost one second. A reader who did
not know it and saw the score cannot get the seal back.

A gate that reads how the reader arrived is a gate on the door, and ADR-0042, part 2,
already says that such a gate has a hole in it.

### 3. The shelf is a labelled door

The shelf is a standalone open page outside the scoring flow, like the postseason
history page. Its rows name the feat and the final score in the open. That is the
page's job. ADR-0081
rule 3 applies: the door into the shelf says, before it opens, that it shows results.
The door persists, reveals and consents to nothing. Each row links into its game's box
score, which opens sealed.

### 4. The index that names feats is reveal-only by import

The feat index is a list of results. Its reader in `src/api/` is classified
`reveal-only` in `spoiler-manifest.json`, with an importer allowlist: the shelf page,
the box score's reveal module, and the callout builder. This follows `boxscore.js`,
which is reveal-only and lists the open `PostseasonSeriesPage.jsx`. A slate card, a
lineup page or a game-picking card (gzilavyss2025/bbsbh#1527) that imports it fails
`npm run lint`. That is the point. A deal from a list of feats would deal on what
happened, which ADR-0080 rules out.

### 5. The callout speaks after the reveal, and only about years it can vouch for

A triple play or a cycle note renders on the revealed play card. A no-hitter note
renders in the box score's Final roll-up, never during the game. A "last time" claim
stays inside the years where the index has measured recall. When the last found event is
older than that, the note says "the first since at least {year}". The note always
names the club. It adds the player and the league only when that line is notable. It
does not link the earlier game yet (gzilavyss2025/bbsbh#1570); when it does, the link
opens that game sealed, under this ADR.

## As built

- **The reader.** `src/api/notable/notable.js` reads the three `public/data/notable/` files.
  `spoiler-manifest.json` classes it `reveal-only`, with one importer:
  `screens/boxscore/FeatLabel.jsx`. The shelf and the callout builder join that list when
  they ship (section 4).
- **The label.** `FeatLabel.jsx` mounts in `BoxScoreBody`, below the Game Log stamp at the
  top of the opened sheet. `BoxScoreBody` renders only inside the box score's `SealBox`
  reveal render, so the label is absent from the DOM while the box score is sealed.
  `check-stamp-surfaces.mjs` pins `BoxScore.jsx` as the one importer of `FeatLabel.jsx`.
- **The fetch.** The component fetches the files when it mounts, so nothing about a feat is
  fetched, held or rendered before the reveal. No seal input changed, and the label persists
  nothing. Under the day pass, a stamp or a remembered tap it shows, because the box score
  is open.

## Alternatives considered

### A. Open by arrival

A link from the shelf or a callout carries a flag. The page reads the flag and opens the
box score as a render-only override, as Stamp In does for its page (ADR-0042).

Rejected. Stamp In's consent sits on the page and is stored per device. A flag in a URL
travels. A reader who shares the link shares the override with a reader who never saw
the shelf. This is the gate-on-the-door hole again.

### B. Open by age

A game before a cutoff year renders open, because old games are history and history is
open (ADR-0034, "The cutoff is opt-in now").

Rejected. ADR-0034 opened stat lines and pages outside the scoring flow. A game page is
inside it. An age cutoff would also block gzilavyss2025/bbsbh#1525 (score a classic
game). A reader who wants to score the 1986 World Series by hand would get the score
first, and a second switch would be needed to seal it again. Any cutoff year is a guess.

### C. Seal the teams too (rejected early)

A blind old game, with the clubs hidden until a tap. Rejected. The matchup is in the
address, and the address is how the app names a game (`gamePath` in
`src/lib/route.js`). A seal on a value the URL bar shows protects nothing.

## Consequences

- No new game page and no new seal. The work is a degrade path for thin eras and one
  label inside a seal that exists.
- A reader taps once to see a famous score they already know. ADR-0049 makes that a
  one-time cost.
- The feat index cannot drift onto a scoring surface without a reviewed allowlist
  change.
- gzilavyss2025/bbsbh#1525 and gzilavyss2025/bbsbh#1527 inherit this seal unchanged.
  #1527 must deal on who played (ADR-0080), so it cannot use the feat index.
