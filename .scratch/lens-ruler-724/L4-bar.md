Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

# Lens L4 of #724: the bottom bar

## Context

Repo `gzilavyss2025/bbsbh` (Tally Baseball). Issue #724 builds "Lens and Ruler": on a phone, the
scorecard opens zoomed onto the next sealed at-bat under a fixed navy frame. The brief is the issue
comment https://github.com/gzilavyss2025/bbsbh/issues/724#issuecomment-5953254710. **Read all of
it.** This slice is its slice 3 ("The bar"). Where this prompt and the brief disagree, this prompt wins.

**What is already on `claude/lens-ruler`:**
- L2: pure helpers in `src/lib/scorecard/`: `playWords`, `runnerMoves` (+ formatter), `situation`
  (+ formatter), `halfTotals` (+ formatter). Read their headers and tests. Use them. Do not rebuild them.
- L3: lens mode, the frame, the ruler, the compact rail, the measured scroll, the bottom bar **shell**
  with only [Sheet], the whole-sheet view, and ADR-0091. Read ADR-0091 and the lens components in
  `src/components/scoring/lens/`.

**Settled (Gary, 2026-10-02):** a half's end **stops** on "Turn to Bottom N". No auto-turn.

## Workspace

1. `git fetch origin`. Base: `origin/claude/lens-ruler`. Check that L1, L2 and L3 are merged into it:
   `gh pr list --base claude/lens-ruler --state merged --json number,title` must list "Lens L1",
   "Lens L2" and "Lens L3" (L1 also edits `box.css`). If one is missing, stop and tell Gary.
2. `git worktree add ../bbsbh-lens-l4 -b claude/lens-l4-bar origin/claude/lens-ruler`, then
   `npm install`. Do not edit the primary checkout.
3. Dev server: the first free of `npm run dev` (5173), `dev:2` to `dev:5`. Add `?nointro` to every URL.
   If all five ports are taken, run `node scripts/dev-servers.mjs`. Stop (`taskkill /PID <pid> /F`) only
   the servers of `bbsbh-lens-*` worktrees whose PR is already merged into `claude/lens-ruler`. Stop
   nothing else. If still no port is free, stop and tell Gary.
4. **Windows baseline.** This PC runs Windows. Here `npm run lint` fails `check-dir-size` and
   `check-file-size`, and `npm test` fails the three `.cluster`, `.grid` and `.stack` tests, only
   because of `\` in paths. They fail the same way on `origin/main`, and CI (Linux) passes them. Do not
   change code or budgets for them. Run those two guards with the path shim instead. Each must exit 0:
   `node --import=file:///C:/Users/gzilavy/claude-prompts/lens-ruler-724/posix-paths.mjs scripts/check-dir-size.mjs`
   and the same for `scripts/check-file-size.mjs`. Any other failure is yours to fix.

## Build (brief sections 2 "The bottom bar", 3, 4; gotchas G5, G6, G8, G10, G11, G17, G21, G22)

1. **Line A**: plain words, at most 2 lines. At a half's start: "Leading off: #24 Quillen." After a
   tap: the play and the runner moves, from L2's helpers.
2. **Row 2 left: the situation** line from L2. Leave row 2's right side empty: L5 adds the pitcher button.
3. **Row 3 main button**, one of:
   - kraft **"Unwrap #19 Lindqvist"**: calls the **same** `onFrontierTap` (G5). No second reveal path,
     no lens cursor, nothing new stored. The name comes from the clamped frontier card or the lineup
     entering the half (G22). With no name (minor league), "Unwrap the next at-bat".
   - navy **"Turn to Bottom 3"** at a half handoff: calls the existing `flip.onFlip`. Line A:
     "Top 3 is over. Rule it off." Situation slot: the half totals from `halfTotals`, shown only after
     the half commits (G8).
   - at the live edge (G10, ADR-0055): a dashed "Waiting for the play" pill and a 52 × 52 Refresh icon
     button that reuses the page's existing `onReload`. The frame holds a dashed `--graphite` "AT BAT"
     box, **not kraft**. Line A: "Arceneaux is batting · checked 12 s ago" from `lastUpdated`; after a
     Refresh with nothing new, "Checked just now · nothing new yet". No totals.
   - "Loading", disabled, while the feed loads. No kraft anywhere while loading.
4. **The turn chip on the sheet** (G11): `.sc-ab__fliptext` reads `--seal-cover` today. Change it to
   `--navy` with `--text-on-ink`, on the whole-sheet view and on desktop too: the turn is not a seal
   (ADR-0083). `scripts/check-seal-scope.mjs` must pass. Its `ALLOWLIST` lists `.sc-ab__fliptext`
   under `'scorecard/box.css'`. That entry goes stale with this change and the guard then fails, so
   remove it in the same commit. The Unwrap button reads `--seal*` from a new partial, so add that
   partial and the Unwrap selector to `ALLOWLIST`, with a one-line reason. Add nothing else there.
5. **Tap lock** (G6): 700 ms after every reveal and every turn, constant, never dependent on the
   result (ADR-0046). It covers the seal, Unwrap and Turn. While the cell editor is open, reveals do
   nothing. Put `tapLocked(now, lastAt, ms)` in `src/lib/scorecard/` with a test that injects the clock.
6. **The last opened box** keeps a 2 px `--ink-2` inner bracket until the next tap (static in this slice).
7. **Minor league, lineup not posted**: Line A "Lineup not posted yet. Names fill in as they bat."
   Every field falls back to `''`, `null` or `—`.

The app shows all text in caps through `#root *` (G17). Do not fight it. Do not add a caps exemption.

## Caps and folders

- New components in `src/components/scoring/lens/` (split it before about its 10th file). New CSS in
  `src/styles/scorecard/lens.css` or a sibling there. `src/lib/`, `src/hooks/`, `src/styles/` and
  `src/components/scoring/` are full.
- 600-line file cap. `src/screens/Scorecard.jsx` is near it. Never raise a cap.
- `src/lib/scorecard/` fills up across the slices (L2 to L7). Count its files before you add one. At
  about its 10th file, move a group into a subfolder (`check-dir-size` fails at 13).
- Tokens, not raw values. Each new text/background pair goes in `src/lib/design/contrastPairings.js`.
  Kraft (`--seal*`) only on the Unwrap button.

## Tests (write each first, see it fail)

- `tapLocked`.
- The bar's state choice as a pure function: sealed / handoff / live edge / loading / no name. Pin it
  on `test/fixtures/game-823035.trimmed.json` at a few steps.
- **Spoiler test:** at every step of the fixture, the bar's text and state before the tap are the same
  whatever the sealed at-bat's result is. One way: compare the bar output for step k built from views
  clamped at k, and assert it reads no card with `atBatIndex` past the clamp.

## Verify (no e2e)

iPhone 390 × 844, `/07072026/milstl-2/scorecard?nointro`, Incognito for a fresh start. Tap through a
full half and a handoff with Unwrap only. Double-tap Unwrap fast: only one at-bat opens. Open a box's
editor: Unwrap does nothing. If a live game is on, check the Waiting state. Check one minor-league game.

## Rules

- Test first. Never loosen a test. The browser suite is Gary's alone: leave it. Do not push to `main`. Do not merge.
- ASD-STE100 for comments, commits and PR text. Never "playoffs".

## Finish

1. `npm run lint`, `npm test` and `npm run build` pass, apart from the Windows baseline (Workspace
   step 4), and the two shimmed guards exit 0. Read the exit codes.
2. Run the `ponytail-review` skill on your diff and apply its cuts. Then run `/code-review` and fix
   what it confirms.
3. Push. Open a PR into **`claude/lens-ruler`**. Title: "Lens L4: the bottom bar". Body: what, why,
   spoiler-safety, what you checked, "Part of #724".
4. Leave the dev server running. Last message, in plain words for Gary: the PR link, the clickable
   local URL, and what to do: "tap Unwrap through a half; read the two lines; at the end, see Turn to
   Bottom N and the totals; tap Turn".
