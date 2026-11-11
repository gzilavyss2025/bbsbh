# #3035 slate-day module — decisions (Gary, 2026-11-11 interview)

1. Shape: pure loader with injected fetchers + thin `useSlateDay` hook.
2. Location: loader in `src/lib/slate/`; levelCounts (from `src/api/slate/`) and ladder merge there;
   hook in `src/hooks/slate/`. Keep the spoiler-free manifest entry (path updated).
3. Fetch scope: core only — bracketSeasonMeta, slate, levelCounts, levelTeams, affiliates
   (+ useOffseason/useWinter/useSeasonMeta phase logic). Enrichment (liveJerseys, resumeLookup,
   prospects, rosterIds) stays in GameSelect or a small extras hook.
4. Offseason: OffseasonSlot takes its `winter` from the slate-day value; the 11 content
   components are untouched.

## Build checklist
- [ ] Failing node test: #2907 seasonRow gate + `pending` stand-in case, fake fetchers
- [ ] Loader in src/lib/slate/, ladder + levelCounts merged
- [ ] useSlateDay hook; GameSelect switched over
- [ ] Before/after 390px screenshots: /, /aaa, /07172026, a postseason date (?nointro)
- [ ] lint, test, build
