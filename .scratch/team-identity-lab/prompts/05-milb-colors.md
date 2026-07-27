# PR 5 — MiLB colour reconciliation and fallback collapse

Read these first, in order:

1. `.scratch/team-identity-lab/PRD.md` — sections §1.2, §2, §5, §9 govern this
   PR. **§5 is the specification. Follow it exactly.**
2. `.scratch/team-identity-lab/implementation-log.md`.
3. `CLAUDE.md`, `src/CLAUDE.md`, `src/lib/CLAUDE.md`.

**Depends on PR 1** (the JSON store pattern). Base on current `origin/main` if
PRs 1-4 have merged; otherwise base on the latest branch and say so.

## Read this before you start

The original framing of this work said "merge the `.scratch/milb-team-colors`
research into `MILB_RESEARCHED_PAIRS`." **That merge is a no-op and you should
not attempt it.** Verified 2026-07-27 (PRD §1.2): the stash and the live table
agree on **all 115 shared entries with zero hex disagreements**. The live table
already *is* the research.

The real work is the 5 gaps, the metadata the live table dropped, the fallback
collapse, and retiring the stash.

## Scope

1. **Build `src/lib/data/milb-colors.json`** — the 115 live pairs unchanged,
   plus the stash's `third` (present on 100 of 120), `confidence`, `source`,
   and `note`.

2. **The 5 gaps — do not invent hexes.** Per PRD §5, exactly:
   - **6325 Columbus Clingstones** → promote the hand-tuned lab bg
     `#f58b6d`/`#000000`.
   - **546 Portland Sea Dogs** → promote lab bg `#e03a3e`. This resolves the
     documented two-source navy conflict toward the sportsfancovers reading.
     **The owner approved this specific call.** Flag `confidence: low` and
     preserve the conflict note verbatim.
   - **482 Corpus Christi, 553 Knoxville, 1956 Somerset** → stay unresolved.
     Their lab bgs are `#FFFFFF`/`#D0D0D0`, the neutral placeholder, not a
     researched colour. Mark `found: false` so the lab flags them visibly.

   Carry forward the known-bad flags on live entries **106 Erie SeaWolves**
   (mislabeled source) and **3410 Richmond** (pre-2026 identity).

3. **Collapse the two fallback mechanisms** into one chain, shared by both the
   tint and treatment-tile paths (PRD §5.1):

   ```
   milbColorPair(teamId)
     1. own researched pair            (milb-colors.json)
     2. parent org's TEAM_COLOR_PAIRS  (via MILB_PARENT_ORG)
     3. NEUTRAL_FALLBACK_PAIR
   ```

   `MILB_PARENT_ORG` **stays** — it is script-generated and step 2 needs it.
   What collapses is the resolution logic, not the data.

4. **Retire the stash** — delete `.scratch/milb-team-colors/milb-colors.json`.
   Keep a short `README.md` stub pointing at the new file and preserving the
   methodology and confidence-level definitions. That provenance is worth
   keeping and does not belong in the data file.

## ⚠️ This PR changes what users see

Today `teamTintColor` jumps straight to the parent org and never sees the
affiliate's own colour — a Durham Bulls headshot currently tints **Rays navy**.
After this it tints **Bulls blue**. This affects every MiLB headshot,
`PitcherNotice`, and `OffDaySection` in the app.

The owner approved this as an improvement. **But you must verify it visually
before opening the PR**, and call it out explicitly in the PR body.

## Out of scope

Theming (PR 6). Logo art (PRs 3-4). Do not re-research MiLB hexes beyond the
promotions specified above.

## Verification

- `npm run lint && npm test` must pass.
- **Add unit tests for all three steps of the fallback chain**, including
  specifically that an affiliate *with* its own colour no longer falls through
  to its parent org. That is the behaviour change — pin it.
- Start a dev server, open a real MiLB game (`docs/test-games.md` has verified
  gamePks), and check headshots on the lineup page against the same page before
  the change. Confirm the tint reads as the affiliate's own identity.
- Check one of the 3 still-unresolved teams renders the neutral placeholder,
  not a wrong invented colour.
- Put the clickable local URL (with `?nointro`) in the handoff.

## Workflow

Per PRD §9: fresh worktree, branch + PR, never push to `main`.

**Before opening the PR**, append a "PR 5" section to
`.scratch/team-identity-lab/implementation-log.md` and update the status board.
Record which 3 teams remain unresolved so a future pass can pick them up.
