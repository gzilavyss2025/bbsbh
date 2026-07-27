# PR 2 — Jersey audit view and hex copy/paste

Read these first, in order:

1. `.scratch/team-identity-lab/PRD.md` — sections §1.5, §2, §9 govern this PR.
2. `.scratch/team-identity-lab/implementation-log.md` — what PR 1 actually
   landed, including where the lab now lives.
3. `CLAUDE.md`, then `src/CLAUDE.md`.

**Depends on PR 1.** Base on current `origin/main` if PR 1 has merged;
otherwise base on PR 1's branch and say so in the PR body.

## Why this PR exists

The owner suspects he built the logo/colour mapping haphazardly and may be
applying the wrong logo or colour scheme to some jerseys. This PR builds the
tool that answers that question, deliberately **before** any further investment
in art or colour data — what it finds may change what those PRs should do.

## Scope

No data changes. Additive UI plus one small piece of plumbing.

1. **Raw jersey audit view** — a new tab in the Team Identity Lab. One row per
   (club, catalog jersey), showing:
   - the raw `uniformAssetText` and `uniformAssetCode`, verbatim, unmodified
   - the logo treatment it resolves to
   - **how** it resolved — an explicit `JERSEY_TREATMENT_OVERRIDES` entry, or
     `classifyUniformAsset`'s naming heuristic
   - the tile that treatment actually renders, so a mismatch is visible
   - whether curated art exists for that treatment
   - a filter for **"heuristic only"** — the unaudited rows, where a
     misapplication is most likely

   The data is already fetched: `jerseyMatchesFor()` (was
   `src/screens/TeamColorLab.jsx:202` before PR 1's move) already carries both
   `text` and `code`; it just renders the friendly display name instead. This
   is mostly surfacing what is on hand.

2. **Season-staleness banner.** Per PRD §1.5, all 69
   `JERSEY_TREATMENT_OVERRIDES` keys embed `_2026`. At the 2027 rollover they
   all go stale at once and silently fall back to the heuristic. Surface this
   prominently in the audit view — show how many override keys match the
   current season versus how many do not. **Do not fix it here.** If the audit
   shows it is already causing live misapplications, write that up in the
   implementation log and flag it for the owner.

3. **Hex copy/paste**, per the owner's request:
   - click any swatch to copy that single hex
   - a Copy/Paste palette pair per tile that moves the whole set
     (`bar`, `accent`, `onBar`, `bg`, pinstripe) between mockups
   - the clipboard lives in lab-level state persisted to localStorage, so it
     survives navigation between the MLB view and the four MiLB level views
   - **Paste lands in the draft layer, never straight to the store** — it must
     stay reviewable and undoable

## Out of scope

Logo upload (PR 3), MiLB art (PR 4), colour data changes (PR 5), theming
(PR 6). No changes to `classifyUniformAsset` or `JERSEY_TREATMENT_OVERRIDES`.

## Verification

- `npm run lint && npm test` must pass.
- Start a dev server on a free reserved port, open the audit view, and **read
  down the whole MLB list yourself**. Report in your handoff: how many jerseys
  resolve by override vs. heuristic, and any rows where the rendered tile looks
  obviously wrong for the jersey named. That report is the actual deliverable
  here — the owner will act on it.
- Put the clickable local URL (with `?nointro`) in the handoff.

## Workflow

Per PRD §9: fresh worktree, branch + PR, never push to `main`.

**Before opening the PR**, append a "PR 2" section to
`.scratch/team-identity-lab/implementation-log.md`, update the status board,
and record the audit findings there — PRs 3-6 will read them.
