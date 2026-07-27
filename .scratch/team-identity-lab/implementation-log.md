# Implementation log — Team Identity Lab

**This file is how a fresh context recovers state.** Read `PRD.md` first for the
plan, then this file for what has actually landed.

Every PR appends a section here **before** opening the PR. Do not rewrite
earlier sections — append.

## Status board

| PR | Title | Status | Branch | PR # |
| --- | --- | --- | --- | --- |
| 0 | Plan + handoff docs | **merged?** | `claude/team-identity-lab-plan` | — |
| 1 | Lab framework + JSON stores + write-back | not started | — | — |
| 2 | Jersey audit view + hex copy/paste | not started | — | — |
| 3 | Logo upload pipeline (MLB) | not started | — | — |
| 4 | MiLB home/away logo art | not started | — | — |
| 5 | MiLB colour reconciliation | not started | — | — |
| 6 | Theming + uniform display | not started | — | — |
| 7 | Docs + cleanup | not started | — | — |

Update the row **and** append a section below when a PR opens or merges.

---

## Open questions / decisions still owed by the owner

- None outstanding. The two judgement calls (MiLB tint change, Portland Sea
  Dogs navy) were approved during planning — see `PRD.md` §2 items 5 and 6.

## Things deliberately left alone

- **`JERSEY_TREATMENT_OVERRIDES` season-key staleness** (`PRD.md` §1.5). A real
  latent bug, out of scope. PR 2 surfaces it; if the audit shows it is already
  causing live misapplications, raise it with the owner rather than fixing it
  inline.
- **`alternate-4` has no art directory** — verified correct, not a bug
  (`PRD.md` §1.6). Do not "fix".
- **`MILB_PARENT_ORG`** stays. It is script-generated and the fallback chain
  needs it (`PRD.md` §5.1).

---

## PR 0 — Plan + handoff docs

Landed the PRD, this log, and the seven per-PR prompts under
`.scratch/team-identity-lab/`. No source changes.

Findings that contradicted the original framing are recorded in `PRD.md` §1 —
the write-back mechanism already existed, the MiLB colour "merge" is a no-op
(0 hex disagreements across 115 shared entries), `GAMECARD_TILE_COLORS` was
already deleted, and `TeamInfo` is the lineup page rather than the club hub.

---

<!-- Append new PR sections below this line. Template:

## PR N — <title>

Branch: `claude/<slug>` · PR: #<n> · Merged: <date or "open">

### What landed

### Deviations from the PRD
(If none, say "None." If the PRD was wrong, fix the PRD in the same PR and note it here.)

### Verification
(Commands run, routes checked, dev-server URL used.)

### Notes for the next PR

-->
