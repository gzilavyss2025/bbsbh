`scripts/lib/abs-challenges.mjs` is **497 lines against the 600-line cap**. Four new export cuts (inning by role, the out-of-challenges board, streaks, the after-a-win cut) will not fit, and `scripts/lib/` is at its own directory budget of 35, so new sibling files are not the answer either.

This issue does the split ALONE, with no new derivations.

## What to do

Make `scripts/lib/abs/` and move the two halves into it:

- `abs/rows.js` — `roleFor`, `umpireCallFor`, `buildRow`, `challengeRowsForGame` (one game's feed to rows)
- `abs/export.js` — `ROLES`, `MISS_BANDS`, `LAST_EARLY_INNING`, `challengerGain`, `summarizeLevel`, `buildExport` (rows to JSON)
- `abs/index.js` — re-exports, so `gen-abs-challenges.mjs` and `test/abs-challenges.test.js` change one import path each

Keep the discipline the current header states, and carry the paragraph across: the database stores FACTS, every split is computed at export time, and ranking lives in the reader, not here.

## Acceptance

- `node scripts/gen-abs-challenges.mjs --export-only` writes a `public/data/abs-challenges.json` that is **byte-identical** to the committed one except `generatedAt`. Diff it and say so in the PR
- `test/abs-challenges.test.js` passes unchanged apart from its import line
- `npm run lint` passes, including `check-dir-size` and `check-file-size`, verified by exit code
