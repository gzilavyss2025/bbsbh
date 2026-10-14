# Run plan: player page motion (#2073)

This is the run plan for `/orchestrate` Lane 3 (`.claude/skills/orchestrate/SKILL.md`).
It has 37 prompts in 9 waves. Each prompt builds one brief in `slices/`. The rules
every brief follows are in `spec.md`.

## How to start it

1. Open a new cloud session on this repo. Pick **Auto** in the mode menu. Child
   sessions take the parent's mode; in Accept edits every git and npm call waits
   for a tap, and the run stalls until morning.
2. Send: `/orchestrate run the plan in .scratch/player-motion/run-plan.md overnight`.
3. Read the morning report: the last comment on #2073, and the session's last
   message.

The run may need more than one night: about 37 Sonnet sessions, 3 at a time, with a
`/stack-prs` merge after each wave. To continue on a later night, send the same
line. The orchestrator reads the ledger on #2073 and starts at the first wave that
is not merged.

## Standing answers (this run is unattended)

The orchestrator reads these in place of asking (orchestrate, "Unattended run"):

| Question | Answer |
|---|---|
| Is it late in your week? | No. Run the plan as written. Stop for a limit warning as the skill says. |
| Merge each wave? | Yes. When every PR of a wave is green, `/stack-prs` those PR numbers and merge (decision, 2026-10-14). Then start the next wave from the new `origin/main`. |
| Stack a child on an unmerged PR? | No. A row starts only when every row in its "Depends on" is merged. |
| Ledger | Comments on #2073, one per wave: rows, session ids, PRs, stack PR, blocked rows, `[DECISION: ...]` lines. No new issue. |
| Cap | 3 children at once. |
| Time limit | 14 hours from the start of the run. |
| Models | `claude-sonnet-5-5` for every row. No Opus, no Fable. |
| A row fails (red twice, `NEEDS PARENT` that `spec.md` and the brief do not answer, a permission stall) | Mark it and its dependents blocked. Run the rest. |
| A design question comes up | Take the choice in `spec.md` or the brief. Where neither answers it, take the choice nearest the canvas values in the brief, and log a `[DECISION: ...]`. |
| Close #2073 at the end? | No. Say in the report that every row is merged. |
| PR text | Each child PR says `Part of #2073 (slice <id>)`, never `Closes`. |

## Shared files

Two rows that edit the same file run in different waves, except for these
**append-only** files. Rows that only add lines to them may share a wave;
`/stack-prs` keeps both sides of a conflict in them:

- `src/index.css`: one `@import` each (01b, 03a, 05a, 05b).
- `src/screens/animlab/PlayerMotionLab.jsx`: one entry each (05c, 08b, 10, 12c, 17a).
- The `.animlab__frame` freeze list in `src/styles/46-consent-modal.css` (05c, 17a).
- `docs/motion.md`: one paragraph each (01c, 05b).

The waves already keep these apart: `page.css` (06, 07a), `Slot.jsx` (07a, 07b),
`splits/*` and `splits.css` (08a, 08b, 09), the arsenal folder and `arsenal.css`
(11, 12a–12c, 13–15), the Contact folder (17a–19), `mound/*` (10, 04d),
`season/index.jsx` and `pitchlog/index.jsx` (04a, then 20a and 20b), and
`similar.css` (04b, then 20c).

## The table

| # | Brief | What | Model | Effort | Depends on (merged) | Wave |
|---|---|---|---|---|---|---|
| 01a | `slices/01a-motion-tokens.md` | motion tokens and row surfaces | Sonnet 5.5 | medium | — | 1 |
| 01c | `slices/01c-in-view-once.md` | `useInViewOnce`, the one-shot entrance gate | Sonnet 5.5 | medium | — | 1 |
| 03a | `slices/03a-segmented.md` | `Segmented`: the joined 44px control (the part) | Sonnet 5.5 | high | — | 1 |
| 01b | `slices/01b-curves-rise.md` | the JS curves and the player rise sheet | Sonnet 5.5 | medium | 01a | 2 |
| 02a | `slices/02a-stamp-press.md` | the site-wide stamp-press | Sonnet 5.5 | medium | 01a | 2 |
| 05a | `slices/05a-menurail-part.md` | `MenuRail`, the part (markup, pure core, resting look) | Sonnet 5.5 | high | 01a | 2 |
| 06 | `slices/06-shell.md` | Shell: hero and tile stagger, age flip | Sonnet 5.5 | medium | 01a | 2 |
| 03b | `slices/03b-segmented-lab-docs.md` | `Segmented`: the design-lab entry and the docs | Sonnet 5.5 | medium | 03a | 2 |
| 04a | `slices/04a-segmented-swap-logs.md` | Swap the player toggles onto `Segmented`: game logs, Season, Advanced | Sonnet 5.5 | medium | 03a | 2 |
| 04b | `slices/04b-segmented-swap-innings-similar.md` | Swap the player toggles onto `Segmented`: Innings by position, Similar | Sonnet 5.5 | medium | 03a | 2 |
| 04c | `slices/04c-segmented-swap-fouls.md` | Swap the player toggles onto `Segmented`: the two Foul balls cards | Sonnet 5.5 | medium | 03a | 2 |
| 01d | `slices/01d-animlab-room.md` | room on the Animation Lab, and the rise entry | Sonnet 5.5 | medium | 01a, 01b | 3 |
| 02b | `slices/02b-band-press-cleanup.md` | remove the band rules the old press inset needed | Sonnet 5.5 | medium | 02a | 3 |
| 05b | `slices/05b-menurail-motion.md` | `MenuRail` motion (the unfold, the fold, the rise on each pick) | Sonnet 5.5 | medium | 01a, 05a | 3 |
| 07a | `slices/07a-slot-hold-rise.md` | Slot: hold the height, no loading text, rise in | Sonnet 5.5 | high | 01a, 01b, 01c, 06 | 3 |
| 08a | `slices/08a-splits-rise-grow.md` | Splits: rise on view, bars grow, fills glide, club strip scroll | Sonnet 5.5 | medium | 01a, 01c | 3 |
| 13 | `slices/13-flight-loop-camera.md` | Pitch flight: loop, off-screen pause, camera tween | Sonnet 5.5 | high | 01b | 3 |
| 20a | `slices/20a-small-fixes-log-rows.md` | Small fixes: the game-log rows | Sonnet 5.5 | medium | 01a, 04a | 3 |
| 20b | `slices/20b-small-fixes-season-contract.md` | Small fixes: Season (WAR state, focus rings) and Contract (the history fold) | Sonnet 5.5 | medium | 01a, 04a | 3 |
| 20c | `slices/20c-small-fixes-similar.md` | Small fixes: the Similar rows and the Foul balls count cells | Sonnet 5.5 | medium | 01a, 04b | 3 |
| 05c | `slices/05c-menurail-labs.md` | `MenuRail` in `/design-lab` and `/animation-lab` | Sonnet 5.5 | medium | 01d, 05a, 05b | 4 |
| 07b | `slices/07b-jump-hold-stamp.md` | Jump bar: hold the target, stamp the section you land on | Sonnet 5.5 | high | 01a, 07a | 4 |
| 08b | `slices/08b-splits-fold-hover.md` | Splits: Game lines rise, fold cascade, chevron, hover, press, lab entry | Sonnet 5.5 | medium | 08a, 01d | 4 |
| 10 | `slices/10-mound.md` | On the mound: track draw, bar grow, now chip, bar hover | Sonnet 5.5 | medium | 01a, 01c, 01d | 4 |
| 11 | `slices/11-arsenal-menurail.md` | Arsenal menu and panel onto MenuRail; replay on pick; ghost fade | Sonnet 5.5 | medium | 05a, 05b | 4 |
| 16 | `slices/16-plate-menurail.md` | Plate approach onto `MenuRail`; rise on each pick | Sonnet 5.5 | high | 05a, 05b | 4 |
| 17a | `slices/17a-contact-dots-drop.md` | Contact: the dots drop in | Sonnet 5.5 | medium | 01a, 01c, 01d | 4 |
| 09 | `slices/09-splits-menurail.md` | Splits: the pitcher's menu onto MenuRail | Sonnet 5.5 | medium | 05a, 05b, 08b | 5 |
| 04d | `slices/04d-segmented-swap-mound.md` | Swap the player toggles onto `Segmented`: On the mound | Sonnet 5.5 | medium | 03a, 10 | 5 |
| 12a | `slices/12a-arsenal-timeline-clock.md` | Arsenal timeline, part 1: one clock and the side-view beats | Sonnet 5.5 | high | 11, 01b | 5 |
| 17b | `slices/17b-contact-menu.md` | Contact: the batted-ball menu onto MenuRail | Sonnet 5.5 | medium | 05a, 05b, 17a | 5 |
| 12b | `slices/12b-arsenal-timeline-card.md` | Arsenal timeline, part 2: mix bar roll, menu rows, start in view | Sonnet 5.5 | high | 12a, 01c | 6 |
| 18 | `slices/18-contact-flight.md` | Contact: ball flight on tap | Sonnet 5.5 | high | 17b | 6 |
| 12c | `slices/12c-arsenal-timeline-controls.md` | Arsenal timeline, part 3: speed step, scrubber, lab entry | Sonnet 5.5 | medium | 12b, 01d | 7 |
| 19 | `slices/19-contact-playthrough.md` | Contact: play through the balls | Sonnet 5.5 | medium | 18 | 7 |
| 14 | `slices/14-flight-drag.md` | Pitch flight: orbit drag and keys | Sonnet 5.5 | medium | 13, 12c | 8 |
| 15 | `slices/15-flight-canvas-trail.md` | Pitch flight: `<canvas>` trail renderer | Sonnet 5.5 | high | 14 | 9 |

"Parallel with" is every row in the same wave. Inside a wave, start the rows in the
order of the table, 3 at a time.

## Prompts

Orchestrate Lane 3 step 3 adds its own footer (parent session, draft PR, drive to
green, remove `wip`). Use each prompt as written.

### Prompt 1 of 37 (row 01a) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 01a of .scratch/player-motion/run-plan.md: motion tokens and row surfaces.
Use the branch the session gives you. It starts at current origin/main.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/01a-motion-tokens.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 01a)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 2 of 37 (row 01c) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 01c of .scratch/player-motion/run-plan.md: `useInViewOnce`, the one-shot entrance gate.
Use the branch the session gives you. It starts at current origin/main.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/01c-in-view-once.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 01c)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 3 of 37 (row 03a) — claude-sonnet-5-5, effort high

```
Run at high.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 03a of .scratch/player-motion/run-plan.md: `Segmented`: the joined 44px control (the part).
Use the branch the session gives you. It starts at current origin/main.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/03a-segmented.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 03a)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 4 of 37 (row 01b) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 01b of .scratch/player-motion/run-plan.md: the JS curves and the player rise sheet.
Use the branch the session gives you. It starts at current origin/main, which has rows 01a merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/01b-curves-rise.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 01b)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 5 of 37 (row 02a) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 02a of .scratch/player-motion/run-plan.md: the site-wide stamp-press.
Use the branch the session gives you. It starts at current origin/main, which has rows 01a merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/02a-stamp-press.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 02a)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 6 of 37 (row 05a) — claude-sonnet-5-5, effort high

```
Run at high.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 05a of .scratch/player-motion/run-plan.md: `MenuRail`, the part (markup, pure core, resting look).
Use the branch the session gives you. It starts at current origin/main, which has rows 01a merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/05a-menurail-part.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 05a)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 7 of 37 (row 06) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 06 of .scratch/player-motion/run-plan.md: Shell: hero and tile stagger, age flip.
Use the branch the session gives you. It starts at current origin/main, which has rows 01a merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/06-shell.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 06)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 8 of 37 (row 03b) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 03b of .scratch/player-motion/run-plan.md: `Segmented`: the design-lab entry and the docs.
Use the branch the session gives you. It starts at current origin/main, which has rows 03a merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/03b-segmented-lab-docs.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 03b)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 9 of 37 (row 04a) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 04a of .scratch/player-motion/run-plan.md: Swap the player toggles onto `Segmented`: game logs, Season, Advanced.
Use the branch the session gives you. It starts at current origin/main, which has rows 03a merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/04a-segmented-swap-logs.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 04a)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 10 of 37 (row 04b) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 04b of .scratch/player-motion/run-plan.md: Swap the player toggles onto `Segmented`: Innings by position, Similar.
Use the branch the session gives you. It starts at current origin/main, which has rows 03a merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/04b-segmented-swap-innings-similar.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 04b)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 11 of 37 (row 04c) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 04c of .scratch/player-motion/run-plan.md: Swap the player toggles onto `Segmented`: the two Foul balls cards.
Use the branch the session gives you. It starts at current origin/main, which has rows 03a merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/04c-segmented-swap-fouls.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 04c)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 12 of 37 (row 01d) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 01d of .scratch/player-motion/run-plan.md: room on the Animation Lab, and the rise entry.
Use the branch the session gives you. It starts at current origin/main, which has rows 01a, 01b merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/01d-animlab-room.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 01d)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 13 of 37 (row 02b) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 02b of .scratch/player-motion/run-plan.md: remove the band rules the old press inset needed.
Use the branch the session gives you. It starts at current origin/main, which has rows 02a merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/02b-band-press-cleanup.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 02b)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 14 of 37 (row 05b) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 05b of .scratch/player-motion/run-plan.md: `MenuRail` motion (the unfold, the fold, the rise on each pick).
Use the branch the session gives you. It starts at current origin/main, which has rows 01a, 05a merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/05b-menurail-motion.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 05b)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 15 of 37 (row 07a) — claude-sonnet-5-5, effort high

```
Run at high.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 07a of .scratch/player-motion/run-plan.md: Slot: hold the height, no loading text, rise in.
Use the branch the session gives you. It starts at current origin/main, which has rows 01a, 01b, 01c, 06 merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/07a-slot-hold-rise.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 07a)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 16 of 37 (row 08a) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 08a of .scratch/player-motion/run-plan.md: Splits: rise on view, bars grow, fills glide, club strip scroll.
Use the branch the session gives you. It starts at current origin/main, which has rows 01a, 01c merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/08a-splits-rise-grow.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 08a)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 17 of 37 (row 13) — claude-sonnet-5-5, effort high

```
Run at high.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 13 of .scratch/player-motion/run-plan.md: Pitch flight: loop, off-screen pause, camera tween.
Use the branch the session gives you. It starts at current origin/main, which has rows 01b merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/13-flight-loop-camera.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 13)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 18 of 37 (row 20a) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 20a of .scratch/player-motion/run-plan.md: Small fixes: the game-log rows.
Use the branch the session gives you. It starts at current origin/main, which has rows 01a, 04a merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/20a-small-fixes-log-rows.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 20a)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 19 of 37 (row 20b) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 20b of .scratch/player-motion/run-plan.md: Small fixes: Season (WAR state, focus rings) and Contract (the history fold).
Use the branch the session gives you. It starts at current origin/main, which has rows 01a, 04a merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/20b-small-fixes-season-contract.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 20b)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 20 of 37 (row 20c) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 20c of .scratch/player-motion/run-plan.md: Small fixes: the Similar rows and the Foul balls count cells.
Use the branch the session gives you. It starts at current origin/main, which has rows 01a, 04b merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/20c-small-fixes-similar.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 20c)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 21 of 37 (row 05c) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 05c of .scratch/player-motion/run-plan.md: `MenuRail` in `/design-lab` and `/animation-lab`.
Use the branch the session gives you. It starts at current origin/main, which has rows 01d, 05a, 05b merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/05c-menurail-labs.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 05c)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 22 of 37 (row 07b) — claude-sonnet-5-5, effort high

```
Run at high.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 07b of .scratch/player-motion/run-plan.md: Jump bar: hold the target, stamp the section you land on.
Use the branch the session gives you. It starts at current origin/main, which has rows 01a, 07a merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/07b-jump-hold-stamp.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 07b)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 23 of 37 (row 08b) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 08b of .scratch/player-motion/run-plan.md: Splits: Game lines rise, fold cascade, chevron, hover, press, lab entry.
Use the branch the session gives you. It starts at current origin/main, which has rows 08a, 01d merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/08b-splits-fold-hover.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 08b)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 24 of 37 (row 10) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 10 of .scratch/player-motion/run-plan.md: On the mound: track draw, bar grow, now chip, bar hover.
Use the branch the session gives you. It starts at current origin/main, which has rows 01a, 01c, 01d merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/10-mound.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 10)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 25 of 37 (row 11) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 11 of .scratch/player-motion/run-plan.md: Arsenal menu and panel onto MenuRail; replay on pick; ghost fade.
Use the branch the session gives you. It starts at current origin/main, which has rows 05a, 05b merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/11-arsenal-menurail.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 11)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 26 of 37 (row 16) — claude-sonnet-5-5, effort high

```
Run at high.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 16 of .scratch/player-motion/run-plan.md: Plate approach onto `MenuRail`; rise on each pick.
Use the branch the session gives you. It starts at current origin/main, which has rows 05a, 05b merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/16-plate-menurail.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 16)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 27 of 37 (row 17a) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 17a of .scratch/player-motion/run-plan.md: Contact: the dots drop in.
Use the branch the session gives you. It starts at current origin/main, which has rows 01a, 01c, 01d merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/17a-contact-dots-drop.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 17a)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 28 of 37 (row 09) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 09 of .scratch/player-motion/run-plan.md: Splits: the pitcher's menu onto MenuRail.
Use the branch the session gives you. It starts at current origin/main, which has rows 05a, 05b, 08b merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/09-splits-menurail.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 09)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 29 of 37 (row 04d) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 04d of .scratch/player-motion/run-plan.md: Swap the player toggles onto `Segmented`: On the mound.
Use the branch the session gives you. It starts at current origin/main, which has rows 03a, 10 merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/04d-segmented-swap-mound.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 04d)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 30 of 37 (row 12a) — claude-sonnet-5-5, effort high

```
Run at high.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 12a of .scratch/player-motion/run-plan.md: Arsenal timeline, part 1: one clock and the side-view beats.
Use the branch the session gives you. It starts at current origin/main, which has rows 11, 01b merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/12a-arsenal-timeline-clock.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 12a)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 31 of 37 (row 17b) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 17b of .scratch/player-motion/run-plan.md: Contact: the batted-ball menu onto MenuRail.
Use the branch the session gives you. It starts at current origin/main, which has rows 05a, 05b, 17a merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/17b-contact-menu.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 17b)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 32 of 37 (row 12b) — claude-sonnet-5-5, effort high

```
Run at high.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 12b of .scratch/player-motion/run-plan.md: Arsenal timeline, part 2: mix bar roll, menu rows, start in view.
Use the branch the session gives you. It starts at current origin/main, which has rows 12a, 01c merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/12b-arsenal-timeline-card.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 12b)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 33 of 37 (row 18) — claude-sonnet-5-5, effort high

```
Run at high.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 18 of .scratch/player-motion/run-plan.md: Contact: ball flight on tap.
Use the branch the session gives you. It starts at current origin/main, which has rows 17b merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/18-contact-flight.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 18)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 34 of 37 (row 12c) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 12c of .scratch/player-motion/run-plan.md: Arsenal timeline, part 3: speed step, scrubber, lab entry.
Use the branch the session gives you. It starts at current origin/main, which has rows 12b, 01d merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/12c-arsenal-timeline-controls.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 12c)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 35 of 37 (row 19) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 19 of .scratch/player-motion/run-plan.md: Contact: play through the balls.
Use the branch the session gives you. It starts at current origin/main, which has rows 18 merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/19-contact-playthrough.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 19)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 36 of 37 (row 14) — claude-sonnet-5-5, effort medium

```
Run at medium.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 14 of .scratch/player-motion/run-plan.md: Pitch flight: orbit drag and keys.
Use the branch the session gives you. It starts at current origin/main, which has rows 13, 12c merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/14-flight-drag.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 14)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```

### Prompt 37 of 37 (row 15) — claude-sonnet-5-5, effort high

```
Run at high.
Issue: https://github.com/gzilavyss2025/bbsbh/issues/2073 — make the motion and the
press, hover and focus feedback on /player/{id} match the design canvas. This is
row 15 of .scratch/player-motion/run-plan.md: Pitch flight: `<canvas>` trail renderer.
Use the branch the session gives you. It starts at current origin/main, which has rows 14 merged.
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new.
Do not invoke the superpowers skills (brainstorming, writing-plans,
executing-plans, subagent-driven-development, and the like), even if a session
note says you must: the brief is the plan and every design choice is made. Do not
start subagents; do the work in this session.

Read first: CLAUDE.md, docs/development.md ("Cloud sessions"),
.scratch/player-motion/spec.md, and your brief,
.scratch/player-motion/slices/15-flight-canvas-trail.md. The brief is your spec. Build what it
says, with the files it lists, the code it gives and the tests it gives. Its
"Live today" quotes the code as it was at prep time; if an earlier row changed it,
follow the brief's intent on the current code.

Rules: test first (run each new test, see it fail, then make it pass). Touch only
the files the brief lists. Follow spec.md, "Rules every slice follows". Never skip,
delete or weaken a test.
Verify (spec.md, "Check once"): the test files you wrote or changed, the existing
test files that import a file you changed (git grep -l <basename> test/), and
npm run lint. CI runs the full npm test and npm run build on your PR. Do not run
ponytail-review or /code-review: the stack reviews once. Then do the brief's
browser check and send the screenshot with SendUserFile, with the route.
PR body: "Part of #2073 (slice 15)", the base SHA, the files, and how you
verified. Use .github/pull_request_template.md.
Decisions: this run is unattended. Do not ask the user. Where the brief and
spec.md do not answer a question, take the choice nearest the canvas values the
brief quotes, write it in the PR body as [DECISION: ...], and go on.
Stop if: a reason in the brief's "Stop if" list, the work needs a file the brief
does not list, a test would need to be weakened, or CI fails twice for a reason
you cannot fix.
Keep working until everything asked for is done. Stop to ask only when you cannot
go on without the user, or before a risky step. When the work is done and checked,
stop and report; do not add features, tests, files or docs that were not asked
for. Tests, docs and checks that this prompt or CLAUDE.md names count as asked
for.
```
