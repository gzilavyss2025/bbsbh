# design-sync notes

Read `docs/design-sync.md` first. This file holds what a re-sync must know.

- **Do not run the stock converter** (`package-build.mjs`). This repo is an app, not a package: it has no `dist/` entry
  and no component exports. `config.json` carries `pkg`, `globalName` and `shape` only so the tool accepts it.
  The real build is `node .design-sync/build/run.mjs`.
- **The project has no `_ds_sync.json`.** The anchor is the repo's own `.design-sync/sync-manifest.json`: the build prints the files that differ from it (`docs/design-sync.md`, "What changed since the last upload"). It is the hashes of a build, not proof of what the project holds; when in doubt, upload in full.
- **Upload order:** write `_ds_needs_recompile`, then the files, then `_ds_needs_recompile` again. The design tool
  re-indexes on that file and writes `_ds_manifest.json` and `_adherence.oxlintrc.json` itself. Never write those two.
- **The preview cards are the only components.** The manifest lists zero components on purpose.

## Re-sync risks

- **The player cards are saved copies** (`.design-sync/captures/`). They drift from the app each time a player
  module changes. Re-capture with `--capture` after a change to `src/screens/player/next/` or
  `src/styles/player-next/`. They carry one batter's and one pitcher's real figures on the capture day.
- **Capture needs a dev server on port 5173 and live MLB data.** If the statsapi call fails, a card is missing and the
  script prints `card not found`. Keep the old capture.
- **Font files come from `node_modules/@fontsource/`.** A Fontsource version bump may change file names. The build
  fails on a missing file. All four families are OFL 1.1; keep the licence files with the fonts.
- **The build stops on source drift.** `css.mjs` replaces exact text in `src/tokens/typography.css`, `fonts.css`
  and `section-head.css`. If a repo edit changes that text, the build names the line. Update the replacement.
- **Usage lines are hand-written** in `usage-data.json`. A new token with no line stops the build.
- **Known contrast flags** (kept exact from the source): `graphite-soft` on card paper 3.10:1, `accent-negative` on a
  picked row 4.37:1, `clay` on `clay-soft` 4.28:1. `seal-deep` is the 8-digit value `#97673395`.
- **Not done:** the identity-lab logo links (Vercel Blob) are not in the README yet. Gary has not sent them.
