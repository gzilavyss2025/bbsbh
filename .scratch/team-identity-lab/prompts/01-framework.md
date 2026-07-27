# PR 1 — Lab framework, JSON stores, and dev write-back

Read these three files first, in order, before doing anything else:

1. `.scratch/team-identity-lab/PRD.md` — the full plan and every verified
   finding. Sections §1, §2, §3 and §9 govern this PR.
2. `.scratch/team-identity-lab/implementation-log.md` — what has landed so far.
3. `CLAUDE.md`, then `src/CLAUDE.md`.

The PRD's §1 findings were verified against the code on 2026-07-27. **Trust
them — do not re-derive them.** In particular: the dev write-back mechanism
already exists (`vite.config.js:29-84`), and you are generalizing it, not
inventing one.

## Scope

This is PR 1 of 7. It is a **pure refactor — the rendered output of every
screen must be pixel-identical before and after.** No user-visible change.

1. **Consolidate the three lab screens** (`src/screens/TeamColorLab.jsx`,
   `MilbTeamColorLab.jsx`, `TeamPatternLab.jsx`) into
   `src/screens/identity-lab/`, per PRD §3.1. One shell, one draft store, one
   copy of each editor, one `teamAnchorId`. Each lab becomes a profile
   descriptor. Keep the treatment sets and `colorsFor` per-dimension — do not
   force parity where the data genuinely differs.
2. **Rename** to Team Identity Lab at `/identity-lab`. Replace the five old
   routes outright (`/team-color-lab`, `/team-color-lab-{aaa,aa,higha,a}`,
   `/team-pattern-lab`) — they are unlisted and linked from nowhere, so no
   redirect. Update `src/lib/route.js` (including its authoritative route list
   header comment) and `src/App.jsx`.
3. **Move the tunable tables from `.js` into `src/lib/data/*.json`**, per PRD
   §3.2. Static imports — Vite bundles them synchronously, so no call site
   becomes async. The `.js` modules keep all their prose and resolver
   functions; only the raw data literal moves. Preserve every per-entry comment
   as a `"name"` and/or `"note"` field.
4. **Generalize `uniformNamesDevSave()` into `devDataSave()`**, per PRD §3.3 —
   one plugin, a closed allowlist of `{ route → file, validator }`. The
   allowlist is a security boundary: there must be no path from a request body
   to an arbitrary filesystem location. Wire the lab's Save to it.
5. **DEV-gate every lab screen** in `App.jsx` and add the four production
   isolation layers from PRD §3.4, including the post-build `dist/` check in
   CI.
6. **Write ADR-0029** recording the write-back mechanism. Next free number is
   0029 — there is a numbering collision at 0025 which PR 7 cleans up, leave it
   alone here.
7. **Start `src/lib/CLAUDE.md`** documenting the colour/logo data model, and add
   a one-line pointer from `src/CLAUDE.md` per the repo's tiered-docs
   convention.

## Out of scope

Logo upload (PR 3), MiLB art (PR 4), colour reconciliation (PR 5), theming
(PR 6). Do not fix the `JERSEY_TREATMENT_OVERRIDES` season-key issue
(PRD §1.5) or the `alternate-4` non-bug (PRD §1.6).

## Verification

The bar is **no rendering change**. Before you start, screenshot a few
representative tiles from each of the three current labs. After, confirm they
are identical. Also confirm the real consumers still render correctly — the
slate card tile (`GameCard`), the in-game masthead (`GameView`), the WPA chart
(`WinProbChart` via `BoxScore`).

- `npm run lint && npm test` must pass.
- Add unit tests for the middleware validators and the JSON store shapes.
- Start a dev server on a free reserved port and check `/identity-lab?nointro`
  plus the home slate. Put the clickable URL in your handoff.

## Workflow

Per PRD §9: fresh worktree off current `origin/main`
(`git worktree add ../bbsbh-identity-lab-framework -b claude/identity-lab-framework origin/main`),
branch + PR, never push to `main`. A PreToolUse hook blocks edits in the primary
checkout.

**Before opening the PR**, append a "PR 1" section to
`.scratch/team-identity-lab/implementation-log.md` and update its status board
row. That file is how the next context recovers state.

If you find the PRD is wrong about something, fix the PRD in this same PR and
note it in the log.
