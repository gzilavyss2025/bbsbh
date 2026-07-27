# PR 4 — MiLB home/away logo art

Read these first, in order:

1. `.scratch/team-identity-lab/PRD.md` — sections §1.7, §1.9, §4.3, §9 govern
   this PR.
2. `.scratch/team-identity-lab/implementation-log.md` — especially PR 3's
   upload contract, which this PR extends.
3. `CLAUDE.md`, then `src/CLAUDE.md`, then `src/lib/CLAUDE.md` (started in PR 1).

**Depends on PR 3** (the upload endpoint and manifest). Base on current
`origin/main` if PRs 1-3 have merged; otherwise base on the latest branch and
say so in the PR body.

## Why this PR exists

`milbTreatmentTile()` hardcodes `logoVariant: 'base'`, so every MiLB affiliate
currently wears the same CDN mark home and away — only the tile tint differs.
The owner wants genuinely different logo art per side, as MLB has.

## Scope

**This PR ships with zero art.** It builds the capability; the owner fills it in
over time through the lab.

1. **New directories** `public/team-logos/milb-home/` and
   `public/team-logos/milb-away/`, **keyed by team id — never abbreviation.**
   PRD §1.7: `TEAM_ABBR` covers only the 30 MLB clubs, and `teamAbbr()` falls
   back to a 3-letter slice of the club name, which collides across MiLB.

2. **Extend `milbTreatmentTile()`** (`src/lib/milbColors.js`) to return curated
   art when it exists, falling back to today's tinted CDN base mark when it does
   not. A team with no art must render exactly as it does today — that is what
   makes partial coverage safe.

3. **Coverage via the manifest, not `onError`.** Read
   `src/lib/data/logo-art.json` (PR 3). Do **not** lean on `TeamLogo`'s
   `onError` fallback for this: with 120 affiliates × 2 sides that would fire
   hundreds of 404s per page. Extend the manifest and its disk-drift test to
   cover the two new directories.

4. **Wire upload** — the MiLB views in the lab get the same drag-and-drop as
   MLB, writing to the id-keyed paths. Extend the endpoint's destination
   allowlist accordingly.

5. **Show coverage in the lab.** With 240 possible files, the owner needs to see
   at a glance which affiliates still have no art. Make that scannable per level.

## Hard boundary — do not cross

MiLB has **no uniform feed**. `docs/uniforms-and-logos.md:29` confirms
`/uniforms/team` returns empty for MiLB. There is no per-game MiLB jersey
signal and none can be built. MiLB stays static Home/Away, two variations, no
exceptions — this is a long-standing deliberate decision, documented in
`src/lib/milbColors.js`'s module header. **Do not invent per-game MiLB uniform
data.**

## Out of scope

Colour data reconciliation (PR 5). Theming (PR 6). Sourcing actual logo art —
that is the owner's ongoing work, not this PR's.

## Verification

- `npm run lint && npm test` must pass.
- Start a dev server. Upload art for **one** affiliate's home side only, then
  confirm: that side renders the new art, that affiliate's away side still
  renders the CDN fallback, and every other affiliate is unchanged.
- Check a real MiLB game's slate card and masthead — confirm no regression for
  the ~119 teams with no art.
- Confirm no 404 storm in the browser console on a MiLB slate.
- Put the clickable local URL (with `?nointro`) in the handoff.

## Workflow

Per PRD §9: fresh worktree, branch + PR, never push to `main`.

**Before opening the PR**, append a "PR 4" section to
`.scratch/team-identity-lab/implementation-log.md` and update the status board.
Record the id-keyed path convention there.
