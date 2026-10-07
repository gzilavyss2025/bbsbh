---
name: design-retry
description: Look at a design attempt that came out wrong, ask Gary what felt off, find the likely cause, and write a clearer prompt to try again with the repo's design rules and a better model and effort. Use when the user says "design retry", "that design came out wrong", "I don't like what it made", "try that again", or feels discouraged about design output. It writes a prompt only; it does not redo the work. For a new idea with no attempt yet, use design-brief.
---

# Design retry

A design attempt came out wrong. Most of the time the prompt is the cause, not the model.
You find which part of the prompt failed and write a better one. You do not redo the work,
reset the branch, or edit the code. Write in ASD-STE100 (`docs/agents/writing-style.md`).
Read `../design-brief/references/design-rules.md` first.

Gary is not a developer. Use plain words. Ask with `AskUserQuestion`, up to 4 questions
per call, your recommendation first and marked "(Recommended)".

1. **Ask first, before you read the diff.** His reaction is the evidence, and the diff
   can change it. One call, four questions:
   - *What went wrong?* Allow more than one: spacing or layout, colour or contrast, type,
     "feels generic", motion, "ignored how the rest of the app looks", "changed too much",
     "broke something".
   - *How far off is it?* Close (fix details), wrong direction, or wrong size of job.
   - *What does right look like?* A screen already in the app, a block in `/design-lab`, an
     outside reference, or "I will know it when I see it".
   - *What can you show me?* A route, a screenshot, or neither.
2. **Gather what happened.** Fetch (`git fetch`) first. Then collect:
   - the original prompt (ask Gary to paste it, or find it in the session);
   - the branch and `git diff origin/main...HEAD --stat`, then read the changed files;
   - the model and effort used (ask Gary, or read the status line);
   - the route. With a route, start the dev server (the `run` skill) and look at it. In a
     cloud session use `.claude/skills/run/shot.mjs`. Do not run the e2e suite.
   Treat another agent's unfamiliar changes as theirs. Do not reset, stash or reformat.
3. **Find the cause.** Match Gary's answers and the evidence to this table. Name at most
   two causes.

   | Cause | Evidence | What the new prompt does |
   |---|---|---|
   | No direction in the brief | Gary says "generic" or "wrong direction"; prompt said "make it nicer" | Adds a propose-3-or-4-directions step, then builds one |
   | Missed a repo rule | Raw hex, a third control type, a native `title=`, a rank with `#`, a missing `.screen` | Adds the rules that apply, by name and path |
   | Fell back to its default look | Cream and serif type that fights the navy and mono scorebook | Names the tokens and a screen to copy |
   | Too big for one pass | Many files, many partials, mixed old and new | Splits into slices of about 5 files |
   | Nothing checked the result | No route, no screenshot, no link in the handoff | Adds the dev-server route and what to look at |
   | Rung too low | Shallow result on a hard visual problem, or Haiku or low effort | Moves up one rung (`improve-prompt`, step 5) |
   | Rung too high, no gain | Opus at max, still generic | Moves down, and spends on direction and checking instead |
   | Scope crept | Other pages changed | Adds a "do not touch" list |

4. **Write the retry.** Output, in this order:
   - **What I think happened.** Two to four plain lines. Say which cause and what you saw.
   - **Keep or undo.** What from the first attempt is worth keeping, and a clean way to
     keep it (a branch name or a commit). Never suggest `reset` or `stash` on shared work.
   - **The retry prompt.** Complete, in a code block, built like a `design-brief` prompt:
     goal and route, what stays, the direction, tokens and screens to copy, only the rules
     that apply, how to check, what done means, when to stop and ask. Name the exact thing
     that went wrong the first time so the agent does not repeat it.
   - **Model and effort.** From the ladder in `improve-prompt` step 5, one line of reason.
     Change the rung only when the cause table says so.
5. **Offer, never do.** If the cause was a repo rule that no doc states, offer to add one
   line to the nearest nested `CLAUDE.md` or to the memory, through a task branch and a PR.
   If Gary wants the prompt graded, offer `improve-prompt`.

## Cloud sessions

When `CLAUDE_CODE_REMOTE=true` there is no `gh` CLI. In a session Gary is watching, use
`AskUserQuestion` as written. In a child or unattended session, ask your questions inside
the output as `[DECISION: ...]` lines, your recommendation first, and write the retry
prompt so it works for the recommended answers.
