# Design-system program: stop migrating, freeze, ship

Advisor memo for Gary. 2026-10-09. Measured on `origin/main` at `c43e10493`.

## Summary

1. The parts are built and in use: Stack 93, Cluster 56, Grid 16 JSX sites, plus Card, Table, Pill and the rest. That was the valuable half. **(measured)**
2. The migration of old rules is now a treadmill. In 8 days it moved about 114 rules. New code added grids faster than the slices removed them. **(measured)**
3. The cheap rules are gone. The finders list 1 safe Stack candidate and 1 safe Cluster candidate. Everything left is hand work. **(measured)**
4. The real cost is not the CSS. It is the rule "no team-page work until #1179 and #1180 close". It blocks #1107, #1154, #1437, #1510, #1775 and #1776. **(measured, roadmap #1198 §5)**
5. Three of the four "stuck" decisions are already made. They wait only on bookkeeping or on that rule. **(measured)**

**Recommendation: declare #1180 done today. Add one ratchet guard so the old pattern cannot grow. Cut #1179 to a layer scale plus a "no new width" guard, with no breakpoint sweep. Then lift the team-page rule. About one day of agent work, four PRs.**

## 1. What the program buys you

| Goal | Do you feel it? | My view |
| --- | --- | --- |
| Agents write new screens faster and the same way | **Yes.** Every new screen is agent-written. | Done. It comes from the parts plus a rule for new code, not from moving old rules. |
| Fewer layout bugs | **Some.** The bug you had was layering (`e2e/inning-modal-stacking.spec.js`, cited in #1179). | A gap in a 2023-era wrapping row causes no bug. The z-index scale does prevent bugs. |
| One place to change a gap | **No.** You have not asked to change a gap site-wide. | Polish. The section-gap trace shows pages use 0, 20, 24, 32, 40 and 58px between sections on purpose (`layout.md`, "Section gap pilot, second run"). One token cannot describe that. |
| A "complete" system | **No.** Nobody sees it. | This is the trap. Completeness is an engineer's itch, not a user benefit. |

## 2. Where the effort does not pay back

**Pace (measured).** 30 slices landed: Stack S1–S17, Cluster C1–C11, Grid G1–G2 (`layout.md` migration log). They moved about 67 Stack rules, 37 Cluster rules and 10 Grid rules (log tables; `test/cluster-migration.test.js:1`). That is about 3.8 rules per slice and about 16 rules per day from 2026-10-02 to 2026-10-08. Design-system commits on `main`: 31 on 10-01, 22 on 10-05, 53 on 10-07, 17 on 10-08 (`git log origin/main --no-merges | grep slice|token swap|dashed|#1180|#1156…`). The program started about 2026-09-18 (same command).

**The treadmill (measured).** Census then (`layout.md`, 2026-10-01) and now (`node .scratch/design-system/layout/census.mjs`):

| Pattern | 2026-10-01 | 2026-10-09 | Change |
| --- | ---: | ---: | ---: |
| `flex-direction: column` | 381 | 356 | −25 |
| `flex-wrap: wrap` | 163 | 147 | −16 |
| `display: grid` | 301 | 328 | **+27** |

In scope, 756 rules stay. New features (series primer, OVR, ABS card) added more hand-written grids than G1 and G2 removed. **Inference:** without a guard, the migration never ends, at any pace.

**The safe pool is empty (measured).** `stack-candidates.mjs` lists 23 candidates, 1 safe (`.projection__list`). `cluster-candidates.mjs` lists 22, 1 safe (`.scout__scenebar`). The rest are dynamic sites, wrong tags or extra rules. Each one now costs a hand edit, a geometry run and a log entry. **Inference:** cost per rule goes up from here, and the value per rule goes down (lab pages, admin pages, one-off rows).

| Item | What it costs | What it buys | Verdict |
| --- | --- | --- | --- |
| Migrate every wrapping row and stack | 30 slices so far, 756 rules left | Nothing you can see. "Zero geometry difference" is the success test, so success is invisible by design. | **Stop.** |
| Three parts | ~3 small components | Agents use them: 165 sites | Keep. Correct choice. |
| The shared checker (`test/helpers/layoutMigration.js`, 328 lines) + 3 tests | Each slice edits a `MIGRATED` table | Stops a migrated rule from coming back | Keep. Sunk cost, cheap to run. Add no more rows. |
| Per-slice geometry diff (`geom.mjs`, `diffgeom.mjs`, `synth.mjs`, 648 lines of scratch tools) | Often half of a slice; noise fixes (`FREEZE`, `BLOCKIMG`) | Real safety for a blind agent | Keep the tools for #1179. Stop using them for migration. |
| Many tiny PRs + `/stack-prs` rounds | 8 stack rounds on 10-07/10-08 alone (PRs #1723–#1806) | Clean revert per family | Over-applied. A revert of a 3-rule slice was never needed in the log. |
| Per-family slices and the 1,125-line `layout.md` log | Log writing in every slice | An audit trail nobody reads after merge | Replace with one short ADR. |
| 29 lint guards (`scripts/check-all.mjs`) | `npm run lint` takes 70s (measured, one run) | Each one caught a real class of bug | Fine. But a guard per migration is the wrong habit; a ratchet is the right one. |

## 3. The finish line

**"Done" for the design system:**

1. New code uses the parts. A ratchet guard fails CI if the count of hand-written column, wrap or auto-fit rules in `src/styles/` (outside `system/` and the bespoke scoring sheets) goes UP. Same pattern as `check-caption-budget`.
2. A layer scale exists and every `z-index` above 3 reads a token (#1179, part 2).
3. Screen widths: the set is named in `src/tokens/layout.css`, and a guard rejects a width that is not already in use. No sweep.
4. #1180, #1655 and #1179 close. The team-page rule in #1198 §5 is lifted the same day.

**Stop:** dedicated migration slices; snapping off-step gaps; section-gap pilots; per-slice log entries.

**Leave in its own namespace, on purpose:** off-step gaps (6, 10, 18, 20px), two-value grids, fixed-count and named-area grids (Gary's own 2026-10-01 decision 4 already says this for 259 grids), every scoring surface, lab and admin pages.

**Migrate only when touched:** if a PR edits a rule for another reason, it may move that rule onto a part. No geometry diff for that; the PR's normal check covers it.

**Delete or archive:** the migration log in `layout.md` (move the decisions to one ADR: "layout parts are for new code; old rules move only when touched"). Do NOT delete the migration tests: test discipline (CLAUDE.md, "Test discipline").

## 4. Decisions on you, one word each

| Issue | State today | My recommendation | Your word |
| --- | --- | --- | --- |
| #1471 section gap | **Already decided** 2026-10-06: option 3 (comment on #1471). Still open. | Close #1471 and draft PR #1457. | "Close" |
| #1775 boxes inside cards | **Already decided** 2026-10-08: flatten all four (comment on #1775). Blocked only by the team-page rule. | Flatten the other panels and wells too, by default. Show you a screenshot, not a mock-up first. | "Flatten" |
| #1776 report look | **Already decided** 2026-10-08: look A (comment on #1776). Blocked only by the team-page rule. | Build A with #1775. Park C. | "A" |
| #1179 breakpoints | Not decided. 26 distinct widths, 267 `@media` lines; 740px is 93 of them (measured, grep). | Name 740 as the one wide step. Keep the other widths as they are, listed in a grandfather list. Guard: no NEW width. No sweep. | "Freeze" |
| #1179 layers | Not decided. 127 `z-index` uses; about 29 are above 3 (measured, grep). | Five tokens (`raised`, `sticky`, `overlay`, `modal`, `toast`); map the ~29. | "Yes" |
| #1655 off-step rows | "Decide per rule" (issue body). | Leave all in their namespace. No snap. | "Leave" |
| Team-page rule | Set 2026-09-24, confirmed 2026-10-06 (#1198 §5). | Lift it when the four "done" points pass. | "Lift" |

## 5. The direction: freeze, ratchet, close, ship

| # | Slice | Model | Effort |
| --- | --- | --- | --- |
| D1 | Close #1471 and #1457. Write the short ADR. Shrink `layout.md` to a pointer. | Haiku | 30 min |
| D2 | Layout ratchet guard (reuse `census.mjs` logic, budget = today's count, shrink-only) + one line in `src/components/ui/CLAUDE.md`: new layout uses the parts. | Sonnet | 1–2 h |
| D3 | #1179 layers: tokens in `src/tokens/layout.css`, map the ~29 uses, guard rejects raw > 3. | Sonnet, high | 2 h |
| D4 | #1179 widths: comment table + guard with a grandfather list. Zero CSS change. | Sonnet | 1 h |
| — | Close #1180, #1655, #1179. Lift the rule in #1198. | you | 5 min |
| D5 | #1775 + #1776 flattening. Case 1 (`.wcall`, `.favormeter`) sits in the seal scope. | Opus for case 1; Sonnet for the team-hub cases | half a day |
| D6 | #1107 team page one-scroll, the work you actually want. | per its own spec | — |

**Total to "done": about one day of agent time, four PRs, one `/stack-prs` round. (Inference, from the slice pace above.)** For comparison: 756 rules at the best pace seen (16 per day, on the easy rules) is more than 45 days, and the easy rules are gone. **(Inference.)**

**Spoiler rule:** nothing here moves a value into the DOM. D2–D4 are CSS and guards. `check-seal-scope` and `check-spoiler-manifest` still run. The scoring surfaces stay excluded. D5 case 1 is inside a reveal: render a revealed half in Chromium before merge, as #1775 already says.

**Biggest risk:** two ways to do layout live on, and agents copy the code next to them. **Catch it cheaply:** the D2 ratchet. It fails CI the first time a new hand-written stack lands, at zero ongoing cost. **Second risk:** the layer mapping puts a menu behind the sticky header. Catch: render the site menu, a modal and the innings viewer at 390px, and ask for `e2e/inning-modal-stacking.spec.js` once.

## 6. Where I disagree (my opinion)

- **The team-page rule (2026-09-24, confirmed 2026-10-06).** This is my main objection. It ties the product to an open-ended refactor with no countable end. The program felt slow because the visible work waited on the invisible work. Gate team work on the four "done" points, not on "#1180 closes".
- **Decision 2 of 2026-10-01, `--space-section` = 16px.** The trace later showed no page except the team hub spaces sections at 16px. The token describes a convention the app does not have. Keep it (the Roster tab uses it), but drop "one section gap" as a goal.
- **Decision 5 of 2026-10-01, snap odd gaps.** Every snap is a visible change with no user benefit, and it forces a visual check. I would never snap in a migration. (In practice no slice has snapped yet, so this costs nothing to reverse.)
- **"One part per PR / one family per PR" as a rule.** Right for the first slices, when the cascade was new. After S7 it was ceremony: the log records no revert of a single slice.
- **I agree with:** Grid for auto-fit only (decision 4), Cluster `align` and `rowGap`, Sheet and Ledger only (Q1), leaving lab and admin pages alone (Q5). Those were good scope cuts. Apply the same instinct to the migration itself.

## Sources and method

- Commands (run 2026-10-09): `node .scratch/design-system/layout/census.mjs`; `stack-candidates.mjs`; `cluster-candidates.mjs`; `grep -rE '<Stack[ >]'` etc. over `src`; `grep` of `@media` widths and `z-index` in `src/styles`; `git log origin/main --no-merges` with a design-system keyword filter; `npm run lint` (exit 0, 70s).
- Files: `.scratch/design-system/layout.md` (census, decisions 2026-10-01 and 2026-10-05, migration log S1–S17, C1–C11, G1–G2, section-gap pilots); `.scratch/design-system/card-collapse/decisions.md` (Q1–Q6); `test/cluster-migration.test.js:1`; `test/grid-migration.test.js`; `test/helpers/layoutMigration.js`; `scripts/check-all.mjs`; `src/components/ui/CLAUDE.md` (`layout/`).
- Issues: #1198 (§2, §5, §7), #1180 and its 9 comments, #1655, #1471 (+ comment), #1775 (+ comment), #1776 (+ 2 comments), #1179. PR list: #1690–#1819.
- Not read in full: #1107, #1108, #1154 bodies (I used their state from #1198 only); ADR texts (I found no ADR for Stack, Cluster or Grid by grep). The per-day rule count is from the log tables, not from a diff of each PR.
