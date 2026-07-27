# PR 3 — Logo upload pipeline (MLB)

Read these first, in order:

1. `.scratch/team-identity-lab/PRD.md` — sections §1.8, §3.3, §3.4, §4, §9
   govern this PR.
2. `.scratch/team-identity-lab/implementation-log.md` — what PRs 1-2 landed,
   especially PR 2's audit findings (they may tell you which art is wrong and
   needs replacing first).
3. `CLAUDE.md`, then `src/CLAUDE.md`.

**Depends on PR 1** (the `devDataSave()` allowlist middleware). Base on current
`origin/main` if PRs 1-2 have merged; otherwise base on the latest branch and
say so in the PR body.

## Why this PR exists

Today, adding or replacing a team logo means hand-dropping a file into
`public/team-logos/{treatment}/`. The owner wants to drag a PNG onto a tile in
the lab and see it live.

## Scope

1. **Adopt the standard** from PRD §4.1 — 512×512 transparent PNG, 400 KB cap.
   This was derived empirically: 93 of the 94 existing files already comply.
   Downscale the sole outlier, `public/team-logos/alternate/TEX.png`
   (1280×1280), to 512×512 as part of this PR. Existing `.svg` files (tracked by
   `ALT_LOGO_SVG` in `teams.js`) stay as they are — the standard governs new
   uploads.

2. **New dev endpoint `/__dev/team-logo`** on PR 1's closed-allowlist
   middleware. It must validate:
   - PNG magic bytes
   - **exactly** 512×512 — read big-endian uint32 at bytes 16-24 of the IHDR
     chunk. **No image library.** No new dependency.
   - size under the cap
   - destination resolved from an **allowlist of treatment directories**, and
     the club abbreviation resolved through `teamAbbr` — never from a raw
     request path

   The path allowlist is a security boundary. There must be no way for a
   request body to write outside `public/team-logos/{allowed treatment}/`.

3. **Drag-and-drop onto any tile** in the lab. Vite serves `public/` directly in
   dev, so the write is live immediately — re-request the tile with a
   `?v={counter}` cache-buster so the browser does not serve the old image.
   Show clear inline errors for each rejection reason (wrong format, wrong
   dimensions, too large) — the owner needs to know *why* a file bounced.

4. **Coverage manifest `src/lib/data/logo-art.json`**, written by the upload
   endpoint itself. Add a unit test asserting the manifest matches what is
   actually on disk, so a hand-added or hand-deleted file cannot drift.

5. **Keep it dev-only** — all four isolation layers from PRD §3.4 apply to this
   endpoint exactly as they do to the JSON stores. Extend the post-build
   `dist/` check to cover it.

## Out of scope

MiLB home/away art (PR 4 — this PR only covers the existing MLB treatment
directories). Colour data (PR 5). Theming (PR 6).

## Verification

- `npm run lint && npm test` must pass.
- Unit-test the PNG validator directly: a valid 512×512 PNG, a wrong-size PNG,
  a JPEG renamed `.png`, an oversized file. All four must behave correctly.
- Start a dev server and **actually upload a file** — replace one club's
  alternate mark, confirm it appears live in the lab without a restart, then
  confirm `git status` shows exactly one changed file and the manifest entry.
- Confirm the tile still renders correctly on the real consumers (slate card,
  in-game masthead).
- Put the clickable local URL (with `?nointro`) in the handoff.

## Workflow

Per PRD §9: fresh worktree, branch + PR, never push to `main`.

**Before opening the PR**, append a "PR 3" section to
`.scratch/team-identity-lab/implementation-log.md` and update the status board.
Document the upload contract there — PR 4 builds directly on it.
