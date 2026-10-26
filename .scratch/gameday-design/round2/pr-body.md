## Summary

Round 2 of the Gameday design round (#2568), design work only. The round 2 artifact's source goes in `.scratch/gameday-design/round2/`, with the tools that make its real data from gamePk 824716. The README gets a "Round 2: what Gary locked" section. No app code changes (`src/`, `api/`, `test/`, `e2e/` untouched). `prototype/` stays as round 1 published it.

Artifact (private to Gary): https://claude.ai/artifact/KQnaidLRwyBnVJYXrg9AYa

## Issue

- Part of #2568
- Part of #2566

## Changes

- `round2/`: layout B at the four sizes in the app's tokens; the new `--stage-*` palette; the checkpoint (#2572); the ADR-0123 steps; the zone map; the breakpoints; the swing keyframes (the follow-through as three frames).
- `tools/extract2.mjs`, `facts2.mjs`, `zones.mjs`, `preview2.sh`: new data tools. `extract.mjs` takes an optional list of at-bat indexes. The shot tools launch `/opt/pw-browsers/chromium`.
- `README.md`: round 2 decisions, findings, what is open, and the round 2 source.
- `.gitignore`: `round2/preview.html`.

## Spoiler-safety

- [x] This change doesn't touch a scoring surface (design files only; the wireframes keep the spoiler rule: one sealed height, the checkpoint reads only a half at or under the reveal mark).

## Verification

- [x] `npm run lint` passes
- [ ] CI `lint-and-build` is green
- [x] Every tab of the artifact rendered in the container's Chromium at 1440 × 900 and 390 × 763, with no console errors and no sideways scroll at 390.

## Files touched

- `.gitignore`
- `.scratch/gameday-design/README.md`
- `.scratch/gameday-design/round2/*`
- `.scratch/gameday-design/tools/extract.mjs`, `extract2.mjs`, `facts2.mjs`, `zones.mjs`, `preview2.sh`, `pageshot.mjs`, `shoot.mjs`, `frames.mjs`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_019NugEVnjgCnnSJezRcs7cr
