---
name: improve-prompt
description: Grade a prompt A+ to F, check its claims against the repo, and rewrite it to an A+, split into smaller prompts when it is too big, with a model and effort level for each. Use when the user says "improve prompt", "grade this prompt", "split this prompt", asks which model or effort to use for a prompt, or pastes a prompt and asks to make it better.
---

# Improve prompt

The user gives you a prompt (pasted, or as a file path). Grade it from A+ to F,
then make it an A+. An A+ prompt does one job, on the cheapest model and the
lowest effort that can do that job well. Do these steps in order.

1. **Check the facts.** Check every claim against the repo and `origin/main`
   (run `git fetch` first): paths, file lists, counts, commit hashes, ports,
   scripts, skills and issue numbers. Read every doc the prompt cites. Mark each
   claim correct, wrong or unverified. If there is no repo, skip this step and
   say so.
2. **Look for conflicts.** Find each place where the prompt disagrees with the
   docs it cites, with CLAUDE.md or memory rules, or with itself. Pay most
   attention to conflicts that would trigger one of its own "stop and ask" rules.
3. **Look for gaps.** Check each item: goal and scope, what "done" means,
   test-first, docs and ADR updates, merge or deploy authority, stop and failure
   paths (CI flake, missing data, tool errors), how long to wait, what to verify
   and against which baseline, the handoff, and (for a code-changing prompt in
   a repo that has the ponytail skill) whether it says to use ponytail and to
   finish with `ponytail-review` and `/code-review`. Flag any step that an
   agent could read two ways.
4. **Decide the split.** Split the prompt when one or more of these is true:
   - It asks for more than one deliverable that could ship or be reviewed alone
     (two PRs, two features, a fix plus an unrelated cleanup).
   - It mixes thinking work (research, design, a decision) with doing work
     (implement, migrate, write docs) that follows from it.
   - Its parts need different models: a hard part next to mechanical parts.
   - A `[DECISION: ...]` or a user review sits in the middle, and the rest
     depends on the answer.
   - It is too big for one session: more than about 5 distinct steps, or more
     than about 10 files to change.

   When none is true, keep one prompt. When you split, each prompt must stand
   alone: a fresh agent with no memory of the others can run it. Each prompt
   states what it needs from an earlier prompt (a branch, a file, a merged PR)
   and what it hands to the next. Mark prompts that can run in parallel.
5. **Pick model and effort for each prompt.** Pick the cheapest row that fits
   the hardest step in that prompt.

   | Work in the prompt | Model | Effort |
   |---|---|---|
   | Mechanical: rename, move, format, bump a version, run a script, look up a fact | Haiku 4.5 | low |
   | Clear spec in known code: add a test, small fix with known cause, docs, a data refresh | Sonnet 5.5 | low or medium |
   | Normal feature or fix across a few files, with some judgment | Sonnet 5.5 | medium or high |
   | Design, unknown-cause debugging, cross-cutting refactor, security, code review, an ADR | Opus 5.5 | high |
   | Very hard or high-risk: subtle concurrency, data loss risk, a large migration plan | Opus 5.5 | xhigh or max |
   | Hardest reasoning or long autonomous work, where Opus 5.5 at xhigh is not enough | Fable 5.1 | medium or high |

   API price per million tokens (input / output): Haiku 4.5 $1 / $5, Sonnet 5.5
   $2 / $10, Opus 5.5 $4 / $20, Fable 5.1 $10 / $50. Fable 5.1 costs 2.5 times
   as much as Opus 5.5, so pick it only when a row above cannot do the job.
   Before you move up a model, try the same model at a higher effort. Always
   state the effort: Opus 5.5 defaults to medium, not high.

   Give one line of reason for each pick. If the author named a model, keep it
   unless it is clearly too weak or too costly, and say why you changed it.
6. **Grade it.** Give the grade and one line for each point you took off. Say
   which problems would make the agent stall or do the wrong thing, and which
   are only polish. A prompt that should split but does not, or that runs
   simple work on an expensive model, loses points.
7. **Rewrite it.** Keep the author's structure, voice and house style (in
   bbsbh: ASD-STE100 and the house word list). Do not add scope the author did
   not ask for; a split divides the same scope, it does not grow it. Do not
   make up facts. Where a fix needs a decision from the user, ask it with
   AskUserQuestion before you write the final prompts: one question per
   decision (up to 4 per call), your recommendation first and marked
   "(Recommended)", each option with its trade-off. Then write the answers
   into the prompts as settled facts, and list each decision and its answer
   at the top of your reply. Use `[DECISION: ...]` in a prompt only when the
   user skips a question or AskUserQuestion is not available. Output this
   shape:

   - A run plan table: `#`, what it does, model, effort, depends on, parallel
     with. Include it for a single prompt too (one row).
   - Then for each prompt, a heading `Prompt N of M — <model>, effort <level>`
     and the complete prompt in its own code block, ready to paste.

   **Ponytail.** When the repo has `.claude/skills/ponytail/` and a prompt
   writes or changes code, put this line first in that prompt: `Use the
   ponytail skill at level full. Reuse what the repo already has before you
   write anything new.` Use `lite` when the author wants to choose between
   options, and `ultra` when the author doubts the task needs to exist. Also
   add a last step to that prompt: run the `ponytail-review` skill on the diff,
   apply the cuts it lists, then run `/code-review`. Do not add either to a
   prompt that only researches, decides or writes prose, or to a prompt that
   only reviews. If the repo has no ponytail skill, skip this and do not
   mention it. Ponytail never overrides a repo rule: the spoiler rule,
   test-first and `check-dir-size` come first.
8. **List the changes.** After the prompts, list each change and its reason,
   including why you split (or did not) and why you picked each model.

Do not run the prompt. This skill only grades and rewrites it. If the prompt is
already an A+, say so and show the evidence from steps 1 to 5. Do not invent
changes.

## Cloud sessions

When `CLAUDE_CODE_REMOTE=true` (see `docs/development.md`), nobody can answer you
and there is no `gh` CLI. Change these steps:

- **Step 1.** Check issue and PR numbers with the GitHub MCP tools, not `gh`.
- **Step 7.** Do not use `AskUserQuestion`. Put each open decision in the prompt
  as `[DECISION: ...]`, with your recommendation first.
- **Output.** Put the run plan, the prompts and the change list in your final
  message. Do not commit them unless the task says to.
