Status: ready-for-agent

# Build the cross-game photo index so photos can be pulled by player and by team

## Why this exists

PR #487 shipped the per-photo half of this — every photo now carries a `kind`
and a `focus` (subject player + team), and `photosForPlayer`/`photosForTeam` in
`src/api/gamePhotos.js` are the query primitives. What is missing is anything
that spans games: today each lookup needs `fetchGamePhotos(gamePk)` per game, so
one player's season would be ~160 content-endpoint calls plus a shape probe per
asset.

Read `.scratch/game-photos-by-subject/PRD.md` first — §3 records decisions
already settled (subject-not-everyone-in-frame; the `data-visualization` vs
`condensed-game` split; the available-but-unwired `guid`→`playId` join) and §4
the open questions. Do not re-derive the classification; its evidence is in the
`src/api/gamePhotos.js` module header.

## Shape of the work

Cost-driven precompute, the pattern `src/api/CLAUDE.md` documents:

1. `scripts/gen-game-photos.mjs` (nightly, `.github/workflows/update-nightly-data.yml`)
   walking each day's finals, reusing `classifyPhotoAsset` rather than a second
   copy of the rules — same discipline as `gen-rehab.mjs` mirroring
   `detectRehabAssignment`.
2. `public/data/game-photos.json` keyed by personId and teamId, storing the
   `mlb/{id}.jpg` segment only (`original`/`thumb` are pure functions of it).
3. Move the `fl_getinfo` shape probe into the generator — that is the main win,
   since it removes the per-page-view fan-out PR #487 accepted for accuracy.
4. Reader in `gamePhotos.js` alongside the live path; the runtime then just
   reads `kind` off the file.

## Watch out for

- **Size.** Check whether it needs the out-of-precache treatment in
  `vite.config.js` that `vs-team-splits.json` and `rookies.json` have.
- **Spoiler rule.** A photo narrates the outcome; `/photos` is the deliberate
  unsealed exception and `GamePhotosStrip` only renders inside the box score's
  seal. Any NEW surface (e.g. a player-page section) needs that question
  answered before it ships — the player page already gates its Milestone/Foul
  cards on `asOf`, and a photo carries the same risk a final score does.
- **Append-only?** Decide explicitly. An old game's photo set is effectively
  immutable once the game is final, so the `gen-rookies.mjs` append-only stance
  probably applies — but a still can be swapped in late (MLB re-thumbnails
  clips hours after a game; observed live during PR #487, a game's asset count
  went 31 → 40 within the hour and 6 assets changed classification).
