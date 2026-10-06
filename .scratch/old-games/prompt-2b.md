# Prompt 2b — the feat label inside the box score's seal; accept ADR-0101

**Model: Opus 5.5, high** (rung 7 in `.claude/skills/improve-prompt/SKILL.md`, step 5).
It puts a result on a scoring surface. A spoiler-rule change never goes below rung 7.
Graded and rewritten with `/improve-prompt` on 2026-10-06.

---

Use the ponytail skill at level full. Reuse what the repo already has before you write
anything new.

Show a feat label on a game's box score when the game had a no-hitter, a cycle or a
triple play. The label names the result, so it may exist in the DOM only after the box
score's seal is open. Add the reader for `public/data/notable/`, and move ADR-0101 from
DRAFT to Accepted.

**Done means:** the label shows on an opened box score of a feat game and is absent from
the DOM while that box score is sealed; nothing new is persisted; a game with no feat
looks exactly as before; lint, tests and build pass; ADR-0101 is Accepted; a draft PR
holds the screenshots and the DOM check.

## Find the work

1. Run `git fetch origin main`. Make a task branch from current `origin/main`.
2. Check open PRs for changes to `src/screens/BoxScore.jsx`, `src/screens/boxscore/`,
   `src/api/spoiler-manifest.json` or ADR-0101. Prompt 2a may have one. If an open PR
   changes the same lines you need, stop and say so.

## Read first (no edits yet)

- `CLAUDE.md`, `src/CLAUDE.md` ("UI-side spoiler enforcement"), `src/api/CLAUDE.md`,
  `test/CLAUDE.md`, `docs/agents/writing-style.md`.
- ADR-0001, ADR-0002, ADR-0026, ADR-0048, ADR-0049, ADR-0083, and DRAFT
  `docs/adr/0101-an-old-game-seals-like-a-new-one-and-a-feat-is-a-result.md`.
- `src/screens/BoxScore.jsx`: the `SealBox` and its three openers (the day pass, a stamp,
  a remembered tap), and `BoxScoreBody`. `src/screens/boxscore/HitChartCard.jsx` is the
  pattern for a card that lives in its own file beside the box score.
- `src/api/staticJson.js`, `src/api/spoiler-manifest.json` (the `reveal-only` class and
  how `importers` paths are written), `docs/api/static-data.md`.
- `scripts/lib/notable/merge.mjs`: `ALLOWED_KEYS` is the row shape. A row holds
  `gamePk`, `officialDate`, `gameType`, `gameNumber`, `away` and `home` (`id`, `abbr`,
  `name`, `runs`), `side`, and by kind `pitchers` (no-hitter), `player` (cycle),
  `shortened` and `lost` (no-hitter, written only when true).
- "Browser harness" in `docs/testing.md`. A hook refuses `npm run e2e`, `npm run visual`
  and `playwright test` unless Gary asks for them. Do not run them.

## Hard limits

- **`src/screens/BoxScore.jsx` is at a size ceiling**: 1,191 lines against 1,200 in
  `scripts/check-file-size.mjs`. Add at most an import and a mount there. Never raise
  the ceiling. Everything else goes in the new component.
- **Change no seal input.** Do not touch `forceRevealed`, `onReveal`,
  `revealedThrough`, `effectiveReveal` or `bbsbh:boxreveal:{gamePk}`. The label rides the
  reveal that exists. Under the day pass, a stamp or a remembered tap it shows, because
  the box score is open; it writes nothing.
- **Fetch only after the reveal.** The component that fetches the files mounts inside
  the reveal render, so nothing about a feat is fetched, held or rendered while the box
  score is sealed.
- **Colour.** Style the label with `--marker`, never a `--seal*` token (ADR-0083,
  `check-seal-scope.mjs`). No raw hex. No `.toUpperCase()` (`check-caps.mjs`).

## Build

1. **The reader:** `src/api/notable/notable.js` (one file is enough). It loads the three
   files through `staticJson` and exports a pure function, `featsForGame(docs, gamePk)`,
   that returns the label lines for one game. Each line:
   - no-hitter: "No-hitter" and the pitchers' names; "Combined no-hitter" when there is
     more than one pitcher; add "shortened" or "lost" when the row is marked;
   - cycle: "Cycle" and the player's name;
   - triple play: "Triple play" and the name of the club in the field.

   A game can have more than one feat. Return them all, no-hitters first.
2. **The manifest:** add `notable/notable.js` as `reveal-only`. Its `importers` list
   names `screens/boxscore/FeatLabel.jsx` and nothing else. Write the `why` in one line.
3. **The component:** `src/screens/boxscore/FeatLabel.jsx`. It takes the gamePk, loads
   the docs, and renders the lines, or nothing for a game with no feat or a failed load.
   It renders no score: the box score beside it already shows that.
4. **The mount:** one line in `BoxScoreBody` (inside the reveal render), near the top of
   the opened sheet. `FeatLabel.jsx` must have exactly one importer: `BoxScore.jsx`.
   If an existing guard can pin that with a one-line entry, add it. Do not write a new
   guard script; if none fits, say so in the PR.
5. **Docs:**
   - `docs/api/static-data.md`: a reader entry for `public/data/notable/`.
   - `src/CLAUDE.md`, "UI-side spoiler enforcement": one line that the feat label
     renders only inside the box score's reveal (ADR-0101).
   - ADR-0101: change the status to Accepted with today's date. Add a short "As built"
     section: the reader's class and its one importer, where the label mounts, and that
     it fetches only after the reveal. Note D14 from `.scratch/old-games/decisions.md`
     (the "no play-by-play" notice shows only before 1960) under section 1's half-inning
     row.

## Tests

Pure and offline (`test/CLAUDE.md`). Write each test first and watch it fail.

- `featsForGame`: each kind; "Combined no-hitter" with five pitchers (the 2021-07-07
  case); "shortened"; "lost"; a game with a cycle and a triple play; a game with none;
  a missing or empty file.
- The unit suite cannot render a `SealBox`. Check the DOM in Verify instead.

## Verify

1. `npm run lint; echo "exit=$?"` and `npm test; echo "exit=$?"`, in the foreground. Both
   must exit 0. `npm run build` must pass.
2. **The DOM check.** Start `npm run dev` (port 5173). With a throwaway Playwright
   **script** in your scratchpad that launches the preinstalled Chromium (not
   `playwright test`), load each box score below with `?nointro` on a fresh browser
   profile:
   - before the tap, assert the page HTML holds no "Cycle", "Triple play" or
     "No-hitter" text and that no request went to `/data/notable/`;
   - tap the seal; assert the label shows.

   | Game | Route | Expect after the tap |
   | --- | --- | --- |
   | 2025-07-12 PIT@MIN (gamePk 777134) | `/07122025/pitmin/boxscore` | "Cycle", Byron Buxton |
   | 2025-08-12 LAD@LAA (gamePk 776763) | `/08122025/ladlaa/boxscore` | "Triple play", Los Angeles Angels |
   | Any 2025 game not in the files | its `boxscore` route | no label; the sheet looks as before |

   If prompt 1c has merged, add Larsen (1956-10-08, `/10081956/bronyy/boxscore`). Build
   each route with `gamePath` (`src/lib/route.js`). If the browser cannot reach
   `statsapi.mlb.com`, save the feeds with `curl` and serve them with `page.route`, as
   `e2e/fixtures/mock-api.js` does. Commit none of these files.
3. Take screenshots of the sealed and the opened box score for the cycle game. Send them
   to Gary with `SendUserFile`.
4. Measure the three files' total size, raw and gzipped. If 1c has merged and they pass
   100 KB gzipped together, say so in the PR and propose a smaller shard. Do not build it.
5. Run the `ponytail-review` skill on your diff and apply the cuts it lists. Then run
   `/code-review` and fix what it finds. Run lint and tests again after.

## Commit, PR

- Commit to your task branch. Push with `git push -u origin <branch>`. Open a **draft**
  PR. Follow the repo's PR template.
- The PR holds: the DOM check results for each game, the screenshots, the file sizes,
  and the guard note from Build step 4.
- Spoiler-safety: tick the second box. Say that the label renders only inside the box
  score's reveal, that its data is fetched only after the reveal, that no seal input
  changed, and that nothing new is persisted. Name ADR-0101.
- Do not push to `main`. Do not merge. Gary merges.

## Rules

- ASD-STE100 and the house word list ("postseason", never the other word).
- Never delete, skip or loosen a test to get green.
- If a command fails twice for the same reason, stop and report it. Do not widen the PR.
- Out of scope: a perfect-game mark (not decided), the shelf (prompt 3), the callout
  (prompt 4), a label anywhere outside the box score, gzilavyss2025/bbsbh#1525,
  gzilavyss2025/bbsbh#1527 and gzilavyss2025/bbsbh#1570.
