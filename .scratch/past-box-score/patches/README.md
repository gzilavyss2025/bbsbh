# Patches for ADR-0117

Two patches, made against `claude/stoic-volta-n9euwn` at commit `368b5cb5` (the docs-only
PR #2317). Apply in this order, from the repo root:

```bash
git apply .scratch/past-box-score/patches/A-box-score-opens-by-date.patch
git apply .scratch/past-box-score/patches/B-retire-adr-0110.patch
```

B is built on top of A (both change `src/lib/dates.js` and `CONTEXT.md`), so apply A first.
If another PR has moved a touched file, `git apply --3way` helps; otherwise re-make the hunk.

| Patch | What it does | Checked |
| --- | --- | --- |
| A | `boxScoreOpensByDate` and `slateToday` in `src/lib/dates.js`; the third opener in `BoxScore.jsx`; 7 unit tests; ADR-0101, 0049, 0035 notes; `check-stamp-surfaces` comment; `CLAUDE.md`, `src/CLAUDE.md`, `CONTEXT.md` lines | Alone: `npm run lint` and `npm test` pass |
| B | Retires ADR-0110: `fetchFinalScores` loses its today limit; `photoGameRows` and `highlightsView` lose theirs; ten tests rewritten to the new rule; one new test file; stale comments; ADR-0110 marked retired | A then B: `npm run lint`, `npm test` and `npm run build` pass |

Not in the patches, because they need a browser: the screenshots in `plan.md` step 8.
Not run: e2e (`docs/testing.md`: only when Gary asks).

Test discipline: the A tests were red before the change (import error) and green after, in UTC,
Pacific/Honolulu and Pacific/Kiritimati. In B, the ten old tests pinned the retired rule, and
the ADR names the decision that retires it (Gary, 2026-10-19). Two tests in
`test/player-log-today.test.js` pass before and after, as guards: a live game has no row, and a
cutoff still turns its day away.
