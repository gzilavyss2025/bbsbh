# Prompt 2a — old-game pages: thin eras

**Model: Sonnet 5.5, high** (rung 4 in `.claude/skills/improve-prompt/SKILL.md`,
step 5). It changes several screens, and its first step is a survey that needs
judgment. It changes no seal. Graded and rewritten with `/improve-prompt` on
2026-10-06.

**Decided (Gary, 2026-10-06):** the "no play-by-play" notice shows only for a season
before 1960. A Final game from 1960 onward with 0 plays is almost always a forfeit, and
a notice there would hint at the result before a reveal.

---

Use the ponytail skill at level full. Reuse what the repo already has before you write
anything new.

Old games already open on the existing game route, `/{MMDDYYYY}/{matchup}/{section}`.
Make them degrade with care: say plainly what the record does not hold, and never show
data from the wrong year. Do not add a page. Do not touch a seal.

**Done means:** no card on the three test games shows false data; each missing part has
one plain line or hides itself; a current-season game looks exactly as before; lint,
tests and build pass; and a draft PR holds the survey table and the screenshots.

## Find the work

1. Run `git fetch origin main`. Make a task branch from current `origin/main`.
2. Check open PRs for changes to `src/screens/GameView.jsx`, `src/screens/TeamInfo.jsx`,
   `src/screens/InningViewer.jsx`, `src/screens/BoxScore.jsx`, `src/api/select.js` or
   `src/components/umpire/UmpiresCard.jsx`. Name any you find in the PR body. If one
   changes the same lines you need, stop and say so.

## Read first (no edits yet)

- `CLAUDE.md`, `src/CLAUDE.md`, `src/api/CLAUDE.md`, `test/CLAUDE.md`,
  `docs/agents/writing-style.md`, and "Cloud sessions" in `docs/development.md`.
- "Browser harness" in `docs/testing.md`. A hook refuses `npm run e2e`,
  `npm run visual` and `playwright test` unless Gary asks for them. Do not run them.
- `.scratch/old-games/plan.md`, section 3, "2. Game page", and its table.
  `.scratch/old-games/findings.md`, Step 3 (why `abstractGameState` cannot be trusted)
  and Step 4 ("What the 42 games contained").
- DRAFT `docs/adr/0101-an-old-game-seals-like-a-new-one-and-a-feat-is-a-result.md`,
  section 1. It is why this prompt must not change a seal.
- ADR-0078: a league ships only if its data cannot make the app state something false.
  The same test applies to an era.

## The three test games

`findings.md` and prompt 15b checked each against the live API. Build each route with
`gamePath` (`src/lib/route.js`); do not type it by hand.

| Era | Game | Route | gamePk | Known facts |
| --- | --- | --- | --- | --- |
| 1901 to 1949 | PHA@BOS, game 1, 1927-07-04 | `/07041927/phabos/lineup1` | 102436 | No plays (0 in all 15 sampled games before 1941). No umpires. Box lines and the park are present. |
| 1950 to 1959 | BRO@NYY, 1956-10-08 (World Series, Larsen) | `/10081956/bronyy/lineup1` | 67524 | Umpires: 0 to 2 in this era. Plays: some 1950s games have them. Check this one. |
| 1960 onward | DET@CWS, game 2, 1979-07-12 (a forfeit) | `/07121979/detcws-2/lineup1` | 177426 | `detailedState` `Forfeit`, 0-0, an empty linescore. It keeps its innings pages (the 1960 rule in Step 2). |

## Step 1. Survey (change nothing)

1. Start the dev server (`npm run dev`, port 5173). Load each test game's `lineup1`,
   `lineup2`, `top1` and `boxscore`, with `?nointro` on every URL. Take a screenshot of
   each with a throwaway Playwright **script** in your scratchpad that launches the
   preinstalled Chromium. Do not use `npm run e2e` or `playwright test`.
2. The browser may not reach `statsapi.mlb.com`. If it cannot, save each game's feed and
   schedule with `curl` (it goes through the proxy) to your scratchpad, and serve them
   with `page.route`, as `e2e/fixtures/mock-api.js` does. Commit none of these files.
3. Write a table: one row per card or section, one column per game. In each cell put:
   - **fine**: true data, or the card hides itself;
   - **empty**: nothing useful, but nothing false;
   - **false**: data that is not true for this game: today's data, or another season's.

   Check first the cards that read data beyond the feed: the lineup page's roster
   fallback (`fetchTeamRoster` in `TeamInfo.jsx`), weather, broadcast, managers,
   uniforms, prospects, rookies, former teammates, career matchups, workload, callouts
   and the club logos. `selectGameSeason(feed)` gives the game's own season.
4. **Stop gate.** If more than 3 cards are **false**, or the fixes would change more
   than 8 files, stop here. Open the draft PR with the table and the screenshots only,
   and say which fixes you propose. Gary splits the work.

## Step 2. Fix

Keep each fix small. Work in this order.

1. **One selector for "played".** Add one exported selector to `src/api/select.js`
   (spoiler-free: it reads no score). A game is played when
   `gameData.status.detailedState` is `Final` or `Completed Early`. Do **not** use
   `selectIsFinal`: it reads `abstractGameState`, which says `Final` for postponed and
   cancelled games too (`findings.md`, Step 3). Every fix below asks this selector.
2. **False cards.** A card that shows data from another season must read the game's own
   season. If its source has nothing for that season, the card hides. Never show a
   present-day roster on an old game.
3. **No umpires.** `UmpiresCard` returns `null` when `officials` is empty. On a played
   game, show one line instead: "Umpires are not in the record for this game." Keep
   `null` for a game that has not been played: its umpires may post later.
4. **No batting order** on a played game: show the box lines and one line, "The batting
   order is not in the record for this game." Do not fall back to a roster.
5. **No plays**, only when the game is played, has 0 plays, **and its season is before
   1960**:
   - The home lineup page's "Innings ›" button goes to the box score instead.
   - A direct load of a half-inning section (`/top1` and others) shows one line, "There
     is no play-by-play in the record for this game", and a link to the box score. It
     renders no `SealBox`.
   - A game from 1960 onward keeps its innings pages exactly as today, plays or not.
   - A game that has not started keeps its innings pages.
6. **Logos.** If an old club shows today's mark, fix it only if the fix is small and uses
   data the repo already has. Otherwise open an issue with the GitHub tools and link it
   in the PR.

Every new string follows the casing guard (`scripts/check-caps.mjs`) and the token rules
in `src/CLAUDE.md`: semantic CSS variables, never raw hex.

## Do not

- Do not change a `SealBox`, `revealedThrough`, `effectiveReveal` or the box score's
  reveal. ADR-0101 keeps every seal on an old game exactly as on a new one.
- Do not show a score, a run total or an inning count outside the box score's seal. The
  forfeit's sealed pages must look like any other sealed game's pages.
- Do not add a feat label (prompt 2b). Do not change routes.

## Tests

Pure and offline (`test/CLAUDE.md`). Write each test first and watch it fail.

- "Played": `Final` and `Completed Early` are true; `Postponed` with `abstractGameState`
  `Final` is false; `Forfeit` is false; a game not started is false.
- "No plays" notice: a 1927 played game with 0 plays is true; a 1979 forfeit is false; a
  1975 played game with 0 plays is false (1960 rule); a 1956 game with plays is false.
- Each season check that fixes a false card: one game from 1927 and one from the current
  season.

## Verify

- `npm run lint; echo "exit=$?"` and `npm test; echo "exit=$?"`, in the foreground. Both
  must exit 0. `npm run build` must pass.
- Take the screenshots again for the sections you changed, plus one current-season game
  (sealed, `?nointro`). The current-season game must look exactly as before. Send the
  screenshots to Gary with `SendUserFile`.
- Run the `ponytail-review` skill on your diff and apply the cuts it lists. Then run
  `/code-review` and fix what it finds. Run lint and tests again after.

## Commit, PR

- Commit to your task branch. Push with `git push -u origin <branch>`. Open a **draft**
  PR. Follow the repo's PR template.
- The PR holds: the Step 1 table, each fix, what you did not fix and why, any issue you
  opened, and the screenshots.
- Spoiler-safety: say that no seal changed, that the new selectors read no score, and
  that the 1960 rule keeps a modern forfeit's pages sealed as before.
- Do not push to `main`. Do not merge. Gary merges.

## Rules

- ASD-STE100 and the house word list ("postseason", never the other word).
- Never delete, skip or loosen a test to get green.
- If a command fails twice for the same reason, stop and report it. Do not widen the PR.
- Out of scope: the feat label and the reader (2b), the shelf (3), the callout (4),
  Retrosheet plays for old games (gzilavyss2025/bbsbh#1525),
  gzilavyss2025/bbsbh#1527 and gzilavyss2025/bbsbh#1570.
