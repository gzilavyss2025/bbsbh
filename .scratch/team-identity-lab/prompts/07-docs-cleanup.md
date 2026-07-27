# PR 7 — Docs and cleanup

Read these first, in order:

1. `.scratch/team-identity-lab/PRD.md` — sections §1.3, §1.9, §9.
2. `.scratch/team-identity-lab/implementation-log.md` — **read every PR section**;
   this PR reconciles the docs against what actually landed, which may differ
   from what was planned.
3. `CLAUDE.md`, `src/CLAUDE.md`, `src/lib/CLAUDE.md`.

**Depends on PRs 1-6 being merged.** Base on current `origin/main`.

## Scope

Cleanup only. No behaviour change.

1. **Fix the ADR numbering collision.** `docs/adr/` has two `0025-*` files:
   `0025-admin-editable-copy-store.md` and
   `0025-one-color-team-marks-are-precomputed-knockouts.md`. Renumber one of
   them and **update every reference** — search the whole repo, including
   `CLAUDE.md`, `src/CLAUDE.md`, `src/api/CLAUDE.md`, and inline code comments.
   Both are cited by name in prose, so a missed reference is a real breakage.

2. **Correct the stale scratch doc.**
   `.scratch/gamecard-team-colors/issues/01-solid-tile-colors.md` describes
   `GAMECARD_TILE_COLORS` / `gameCardTileColor()` in the present tense. Those
   were already deleted from `src/lib/teams.js` before this effort began
   (PRD §1.3) — zero hits in `src/`, `scripts/`, `test/`, `e2e/`. Rewrite it as
   a historical record: the hand-picked colour table it preserves is still worth
   keeping, but it must not read as live code. Set its `Status:` line
   appropriately per `docs/agents/triage-labels.md`.

3. **Finish `src/lib/CLAUDE.md`.** Started in PR 1; reconcile it against
   everything that actually landed. It must document:
   - the MLB vs. MiLB colour/logo split and why they stay separate
   - the treatment tables and where they now live (`src/lib/data/*.json`)
   - the fallback chains (colour, and `TeamLogo`'s variant → base → monogram)
   - the jersey-feed vs. static-heuristic boundary, and that **MiLB has no
     uniform feed at all**
   - the theming invariant from ADR-0030: inputs are `(teamId, treatment)` only
   - the 512×512 PNG logo standard and the dev-only upload path

   Keep it lean and follow the repo's tiered-docs convention — detail here,
   one-line pointer from `src/CLAUDE.md`.

4. **Verify the tier pointers.** Confirm `src/CLAUDE.md` points at
   `src/lib/CLAUDE.md`, and that root `CLAUDE.md` is still under its 200-line
   cap (`scripts/check-claude-md.mjs`, run by `npm run lint`). If root
   `CLAUDE.md` needs a mention of this system, keep it to one line — move detail
   down a tier rather than raising the cap.

5. **Retire the planning docs.** Once everything above is reconciled, mark
   `.scratch/team-identity-lab/PRD.md`'s `Status:` line as complete and add a
   closing entry to the implementation log. Leave both files in place — they are
   the record of why this is shaped the way it is.

## Also check

- Any `.scratch/` directory this effort superseded (e.g.
  `.scratch/milb-team-colors/` after PR 5) is in the state PR 5 left it —
  a stub README, not a stale dataset.
- No doc still refers to `/team-color-lab`, `/team-pattern-lab`, or the old
  screen filenames.

## Verification

- `npm run lint && npm test` must pass — the CLAUDE.md leanness check is
  lint-gated.
- Grep the repo for every renumbered ADR reference and confirm zero stale hits.
- No dev server needed; there is no user-visible change.

## Workflow

Per PRD §9: fresh worktree, branch + PR, never push to `main`.

Append a final "PR 7" section to
`.scratch/team-identity-lab/implementation-log.md`, set every status board row
to merged, and note anything deliberately left for a future effort (e.g. the
`JERSEY_TREATMENT_OVERRIDES` season-key issue from PRD §1.5, and the 3
unresolved MiLB colour teams from PR 5).
