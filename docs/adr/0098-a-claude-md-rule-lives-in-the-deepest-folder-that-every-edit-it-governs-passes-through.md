# A CLAUDE.md rule lives in the deepest folder that every edit it governs passes through

**Status:** Accepted
**Date:** 2026-10-05
**Source:** the CLAUDE.md audit of 2026-10-05 (owner decisions 1 to 6)

## Context

A nested CLAUDE.md loads the first time Claude reads a file in its folder. It then
stays in context for the session. Claude Code documents this for the reads and for
the stay. It does not say whether the files of the parent folders load too. The
plain reading is yes, so this ADR plans for it. A session in `src/lib/` pays for the
root file, `src/CLAUDE.md`, and `src/lib/CLAUDE.md`.

The seven files had grown in the wrong places:

- `src/CLAUDE.md` held about 245 lines that govern one subfolder only (the team hub,
  My Tally, the passport book, site search, the CSS rules). Every `src/` session paid
  for them.
- `src/lib/CLAUDE.md` was about one subsystem, club identity, but loaded for all 22
  folders under `src/lib/`.
- `src/components/CLAUDE.md` had 74 lines and 30,038 characters. The line cap could not
  see three table rows that held 13,559 characters.
- Catalogs inside the files rotted: the guard list in `scripts/` missed 13 of 28
  guards, and the store table in `src/lib/` missed stores. About 45 facts were
  wrong across the seven files.
- The same rule sat in two or three files, and two copies disagreed on the `SealBox`
  remount key.

## Decision

1. **A rule goes to the deepest CLAUDE.md that every edit it governs passes through.**
   If edits in two sibling folders need the rule, it stays in their common parent.
   The result is 23 nested files: 17 new ones in feature folders (`api/`,
   `src/screens/team/`, `src/screens/profile/`, `src/styles/`, `src/lib/data/`,
   `src/api/{around-the-game,boxlines,expresslane,transactions}/`, and
   `src/components/{boxlines,chrome,logbook,offseason,passport,playbyplay,transactions,ui}/`).
2. **Reference and history leave the CLAUDE.md files.** Lists, schemas, measurements,
   and how-it-works go to `docs/` (`docs/components.md`, `docs/box-lines.md`,
   `docs/identity-lab.md`, `docs/scripts/tooling.md`). An incident story keeps one clause
   next to its rule. The full story goes to the ADR or to `docs/`, or it is cut when
   the rule already says what to do.
3. **One copy of each rule.** The other places get a one-line pointer or nothing.
4. **Nested CLAUDE.md files only.** Path-scoped rules (`.claude/rules/*.md`) are not
   used. They would be a second mechanism with no guard and no place in the tier list.
5. **The guard counts characters and finds the files itself.**
   `scripts/check-claude-md.mjs` caps each file at 80 characters per line of its line
   cap (root 16,000, nested 20,000) and walks the tree for nested files. A new file
   cannot skip the caps. Line budgets still only go down.
6. **Code comments that cite a moved section are re-pointed.** Comment text only.

## Consequences

- Root `CLAUDE.md` goes from 200 to about 180 lines. It lists every nested file.
  `scripts/check-claude-md-facts.mjs` checks that list.
- `src/CLAUDE.md` and `src/lib/CLAUDE.md` stay above the 250-line ceiling. Each keeps a
  budget, now 255 and 264 lines (before: 450 and 385).
- A cost the plan accepts: 17 more small files to keep current. The root bullet and the
  facts guard are the check that none goes missing.
- The load figures for the unconfirmed case (ancestors load) are in the PR description.
  If ancestors do not load, the `src/lib/` and `src/api/` sessions save more.
