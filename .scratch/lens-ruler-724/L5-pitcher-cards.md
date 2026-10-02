Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

# Lens L5 of #724: the Entering card, the new-pitcher notice and the pitcher sheet

## Context

Repo `gzilavyss2025/bbsbh` (Tally Baseball). Issue #724 builds "Lens and Ruler": on a phone, the
scorecard opens zoomed onto the next sealed at-bat under a fixed navy frame, with a bar below. The
brief is the issue comment https://github.com/gzilavyss2025/bbsbh/issues/724#issuecomment-5953254710.
**Read all of it.** This slice is the pitcher and leadoff part of its slice 5, plus item 7 of its
section 6. The carry strip is **not** in this slice (L6 does it). Where this prompt and the brief
disagree, this prompt wins.

**This is the spoiler-sensitive slice.** When a pitching change becomes visible is the core of it
(G9, G19). Get the timing exactly right and prove it with tests.

**Already on `claude/lens-ruler`:** L2 helpers (`src/lib/scorecard/`), L3 lens layout and ADR-0091,
L4 bar (`src/components/scoring/lens/`) with row 2's right side left empty for you, and the tap lock.

## Workspace

1. `git fetch origin`. Base: `origin/claude/lens-ruler`. Check that L4 is merged into it:
   `gh pr list --base claude/lens-ruler --state merged --json number,title` must list "Lens L4".
   If not, stop and tell Gary.
2. `git worktree add ../bbsbh-lens-l5 -b claude/lens-l5-pitcher origin/claude/lens-ruler`, then
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

## Read first

ADR-0003, 0010, 0016 ("What one step contains"), 0046, 0088. `src/api/select.js`
(`selectPrePitchChanges` at about line 584, `selectIsFreshPitcher` at about 736),
`src/api/battingorder.js` (`lineupEntering`), `src/api/defense.js` (`defenseEntering`),
`src/api/playbyplay/notificationCards.js` (`pitchingChangePitcher`),
`src/components/inning/HalfInning.jsx` (how it decides `isFreshPitcher` and `relief={inning > 1}`),
`src/components/playbyplay/PitcherNotice.jsx` (`PitcherNotice`, `PitcherPhoto`),
`src/components/playbyplay/pitcherCard/PitcherCard.jsx`, `src/lib/pitcherCard/card.js`
(`entryFlag`, `restLabel`).

## Build

1. **`frontierArmChange(...)`** in `src/lib/scorecard/` → `{ pitcher, fresh }` or `null`. Test first.
   It takes the feed, so it is **caller-gated**: write the gate into its header and its tests.
   - Leadoff: `selectPrePitchChanges` for the half at `revealedThrough + 1` (G9: pass the real mark).
   - Mid-half: the `pitching_substitution` note that **trails the last revealed step** (ADR-0016). It
     is in view once that step is revealed, so the notice shows right after the tap that retires the
     batter before the new arm. That is correct, not a peek.
   - A change **between pitches** of an at-bat (`midAtBat`) leads the next step. It must not show before
     the next tap.
   - Tests pinned on real captured games: one case for each of the three. Find games with these
     events in `docs/test-games.md` or in the fixtures under `test/fixtures/`. If no captured game has
     a `midAtBat` change, say so in the PR and test that case with a minimal hand-built feed, in the
     shape of `test/fixtures/mini-game.js`. Build it inside your test; do not edit `mini-game.js`
     (other suites pin on it).
   - Spoiler test: at every step, the result never names a pitcher whose entry lies past the gate.
2. **The dock**: one card at a time, top at frame bottom + 13 px, 16 px side insets. The notice wins
   over the Entering card.
3. **Entering card** (brief section 2): at a leadoff with no new pitcher. "Entering Bottom 3", the
   pitcher line, the defense line ("No defensive changes." when none). It goes away after the first
   tap of the half.
4. **New-pitcher notice**: a `<button>` on the tier-1 notice ground, the same as `.pitchernotice--pbp`.
   Headshot or `PitcherPhoto` fallback, "Now pitching for the {club}", name, jersey, hand, the
   `entryFlag` flag, and "Arsenal · last time out ›". It goes away after his first batter. A tap opens
   the pitcher sheet.
5. **Pitcher button** in bar row 2 right: "Pitching · {Surname} ›", 44 px tall. It opens the sheet.
6. **Pitcher sheet**: slides up from the bottom (no motion yet, L7 adds it), top 92 px, holds
   `PitcherCard` as it is, mounted only when the sheet opens (it fetches by itself), with a sticky
   navy "Back to the box". Label "Now pitching" only for the fresh arm at his first batter, else
   "Pitching" (the `isFreshPitcher` rule from `HalfInning.jsx`). `relief` uses the same rule as
   `HalfInning.jsx`. While the sheet is open, the seal, Unwrap and Turn do nothing.
7. Minor league: every field degrades to `''`, `null` or `—`. The card already drops the arsenal below
   AAA.

## Caps and folders

New components in `src/components/scoring/lens/` (split it into a subfolder before about its 10th
file). CSS in `src/styles/scorecard/`. `src/lib/`, `src/hooks/`, `src/styles/` and
`src/components/scoring/` are full. 600-line file cap. Never raise a cap. Tokens, not raw values.
`src/lib/scorecard/` fills up across the slices: at about its 10th file, move a group into a
subfolder (`check-dir-size` fails at 13).
New text/background pairs go in `contrastPairings.js` (brief G16 lists the notice-ground pairs; use
the ratios `check-contrast` measures). No kraft on the cards or the pitcher button (G11).

## Docs

If the timing rule needs words beyond ADR-0016, add a short section to ADR-0091 (do not make a new
ADR). Update `src/CLAUDE.md` only if a pointer is missing.

## Verify (no e2e)

iPhone 390 × 844, Incognito. Start with the anchor game `/07072026/milstl-2/scorecard?nointro`: its
captured feed has 4 `pitching_substitution` events. Pick a mid-inning one.
Tap to the batter before the change: after that tap, and not before, the notice shows. Open the sheet
from the notice and from the pitcher button. Check a half that starts with a new pitcher, and one that
does not (Entering card). Check one minor-league game.

## Rules

- Test first. Never loosen a test. The browser suite is Gary's alone: leave it. Do not push to `main`. Do not merge.
- ASD-STE100 for comments, commits and PR text. Never "playoffs".

## Finish

1. `npm run lint`, `npm test` and `npm run build` pass, apart from the Windows baseline (Workspace
   step 4), and the two shimmed guards exit 0. Read the exit codes.
2. Run the `ponytail-review` skill on your diff and apply its cuts. Then run `/code-review` and fix
   what it confirms.
3. Push. Open a PR into **`claude/lens-ruler`**. Title: "Lens L5: Entering card, pitcher notice and
   pitcher sheet". Body: the three timing cases and their tests, the games and URLs you checked,
   "Part of #724".
4. Leave the dev server running. Last message, in plain words for Gary: the PR link, the clickable
   local URL (at the step just before a pitching change), and what to tap and see.
