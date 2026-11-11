# #3035 slate-day module — decisions (Gary, 2026-11-11 interview)

1. Shape: pure loader with injected fetchers + thin `useSlateDay` hook.
2. Location: loader in `src/lib/slate/`, with `ladderStops` and `countGamesBySport` behind it;
   `fetchLevelCounts` STAYS in `src/api/slate/` (keeps its spoiler-manifest entry) and is
   injected into the loader like every other fetcher. Hook in `src/hooks/slate/`.
   (Revised after the PR #3051 review: the manifest guard covers only `src/api/`, and
   `src/lib` stays pure.)
3. Fetch scope: core only — bracketSeasonMeta, slate, levelCounts, levelTeams, affiliates
   (+ useOffseason/useWinter/useSeasonMeta phase logic). Enrichment (liveJerseys, resumeLookup,
   prospects, rosterIds) stays in GameSelect or a small extras hook.
4. Offseason: OffseasonSlot takes its `winter` from the slate-day value; the 11 content
   components are untouched.

## Build checklist
- [ ] Failing node test: #2907 seasonRow gate + `pending` stand-in case, fake fetchers.
      Inject the saved-row read (`readSeasonRow`) too: node has no `localStorage`, so
      without it the saved-row path #2907 fixed always reads null and goes untested.
- [ ] Node test: the slate-day value holds no score (issue #3035's spoiler-rule check)
- [ ] Loader in src/lib/slate/ (ladder behind it; fetchLevelCounts injected from src/api/slate/)
- [ ] useSlateDay hook; GameSelect switched over
- [ ] Before/after 390px screenshots: /, /aaa, /07172026, a postseason date (?nointro)
- [ ] lint, test, build
