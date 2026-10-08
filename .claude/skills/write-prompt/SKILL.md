---
name: write-prompt
description: Write a prompt from a thin idea, or edit and polish one that already exists. Interviews the user one question at a time when the idea is thin, checks every claim against the repo, grades the result A+ to F, splits it when it is too big, and picks a model and effort level for each part. Use when the user says "write a prompt", "write me a prompt for", "improve prompt", "grade this prompt", "split this prompt", asks which model or effort to use, or pastes a prompt and asks to make it better.
---

# Write prompt

The user gives you one of two things: a thin idea (a sentence or two), or a prompt that
already exists (pasted, or as a file path). Turn either into an A+ prompt. An A+ prompt
does one job, on the cheapest model and the lowest effort that can do that job well.
Do these steps in order. Step 0 is for a thin idea. Skip it for a prompt that is already
written, and go to step 1.

0. **Interview (thin idea only).** A prompt can only hold the intent you give it. The
   model cannot see what the user left unsaid, so get it out before you write.
   - Read first. Open the files, docs, ADRs and open PRs the idea touches. Ask the user
     only what the repo cannot answer.
   - Ask with `AskUserQuestion`, one question per call. Put your recommended answer first
     and mark it "(Recommended)". Give each option its trade-off.
   - Cover, in this order, and stop as soon as the prompt can stand alone: the goal and
     who it is for; what "done" looks like (a test, a screenshot, a route and gamePk);
     what to leave alone; what to do when a design choice is open (decide, or stop and
     ask); how big it may get.
   - Do not ask what the repo already answers. Ask at most six questions in all, counting step 7. When
     the user says "you pick", pick, and write the pick into the prompt as a settled fact.
   - Then write a first draft that follows steps 1 to 8. Keep the user's words where you
     can. Explain why behind each rule, because a reason generalizes and a bare "never"
     does not.
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
5. **Pick model and effort for each prompt.** Pick the cheapest rung that fits
   the hardest step in that prompt. The ladder runs from cheapest to strongest.
   Haiku 5.5 takes an effort setting, like Sonnet 5.5, Opus 5.5 and Fable 5.1, so
   always state one for it. Haiku 4.5 is the exception: it has no effort setting
   and errors if you send one, so never state an effort for 4.5. Choose Haiku 5.5
   over 4.5 unless the author names 4.5.

   | Rung | Model + effort | Work in the prompt |
   |---|---|---|
   | 1 | Haiku 5.5, low (Haiku 4.5 has no effort) | Mechanical: rename, move, format, bump a version, run a generator script, look up a fact, list PRs or worktrees |
   | 2 | Sonnet 5.5, low | Quick edit, docs, a data refresh, a copy or typography tweak |
   | 3 | Sonnet 5.5, medium | **The everyday rung.** Add a test for known behavior, fix with a known cause, a slice that follows an existing pattern, agentic coding with a clear spec |
   | 4 | Sonnet 5.5, high | A feature across several files with some judgment; a test-first bug fix where the cause takes digging |
   | 5 | Sonnet 5.5, xhigh | Hard coding work where high gave a shallow result |
   | 6 | Opus 5.5, medium | Review, a design question, or an ADR draft that is not subtle |
   | 7 | Opus 5.5, high | Unknown-cause debugging, cross-cutting refactor, security review, any change to the spoiler rule |
   | 8 | Opus 5.5, xhigh | High-risk or subtle work: stored user data, cache bugs, two tabs writing at once, a large migration plan |
   | 9 | Opus 5.5, max | Only after xhigh failed, or when one wrong answer is very costly |
   | 10 | Fable 5.1, medium or high | Only when Opus 5.5 at xhigh is not enough: the hardest reasoning or long autonomous work |

   Haiku 5.5 is one rung with a range: low for mechanical work. For a narrow,
   fully specified code change (named files, a test to write first), medium or
   high on Haiku 5.5 can come before a jump to Sonnet 5.5. Move to Sonnet 5.5
   when Haiku 5.5 at high gives a shallow result.

   API price per million tokens (input / output), as of 2026-10-08 (prices change;
   check them before you rely on them): Haiku 4.5 $1 / $5, Haiku 5.5
   $0.10 / $0.50 (prompts up to 100K tokens; $0.50 / $2.50 above that), Sonnet 5.5
   $2 / $10, Opus 5.5 $4 / $20, Fable 5.1 $10 / $50. Fable 5.1 costs 2.5 times
   as much as Opus 5.5, so pick it only when a rung above cannot do the job.

   Rules for the ladder:
   - Do not skip medium. Most repo work has a spec, nested `CLAUDE.md` files and
     tests that catch mistakes, so rung 3 covers most of it. Start there for
     normal work, not at xhigh.
   - Move up one rung at a time, and only when the result is weak. Raise the
     effort on the same model before you change model.
   - xhigh is a normal setting for hard coding work, not a last resort. Do not
     use xhigh or max for mechanical work, and do not use max in a fan-out run.
   - Sonnet 5.5 at xhigh costs half as much per token as Opus 5.5 at xhigh. No
     measured data says how Sonnet 5.5 at xhigh compares with Opus 5.5 at medium
     or high. Treat rungs 5 to 7 as a judgment call and test on a real task.
   - Always state the effort. Opus 5.5 and Haiku 5.5 default to medium, Sonnet 5.5
     and Fable 5.1 default to high, so an unstated effort picks different rungs.
   - A spoiler-rule change never goes below rung 7.
   - Design work: more effort does not make a design better or more varied. Pick
     the rung by kind of work, then spend on checking, not on thinking.

     | Design work | Rung |
     |---|---|
     | Design-system code that follows a spec (token swap, a slice with a known pattern) | 3, or 4 when the slice merges many rules |
     | Build a screen or card from a direction that is already settled | 4 |
     | Explore directions for something new | 3, as a propose-3-or-4-directions step, then build only the one chosen |
     | Hard visual problem: club-colour band layout, animation timing, a first try that failed | 5, or 7 |
     | Design decision or ADR (naming, a token tier, how the seal looks) | 7 |
     | Screenshots, dev server, list of what changed | 1, or 2 |
     | Judge whether it looks right | 3 or 4, never rung 1 |

     Split the decision from the build: one prompt picks the direction, a cheaper
     prompt builds it. Name the palette and type, or point at the tokens in
     `src/styles/`, so the model does not fall back to its default house style.
   - In a multi-agent run, match each phase: Haiku 5.5 (low) for survey and grep passes,
     Sonnet 5.5 medium for checks that need judgment, Sonnet 5.5 high or Opus 5.5
     high for synthesis and docs that must read well.

   Give one line of reason for each pick. If the author named a model, keep it
   unless it is clearly too weak or too costly, and say why you changed it.
6. **Grade it.** Give the grade and one line for each point you took off. Say
   which problems would make the agent stall or do the wrong thing, and which
   are only polish. A prompt that should split but does not, or that runs
   simple work on an expensive model, loses points.
7. **Rewrite it.** Keep the author's structure, voice and house style (in
   bbsbh: ASD-STE100 and the house word list). For a prompt that runs unattended on
   Sonnet 5.5 at low or medium effort, add this line: "Keep working until everything
   asked for is done. Stop to ask only when you cannot go on without the user, or
   before a risky step. When the work is done and checked, stop and report; do not add
   features, tests, files or docs that were not asked for. Tests, docs and checks that
   this prompt or CLAUDE.md names count as asked for." Anthropic measured that
   such a model otherwise stops to check in early (Sonnet 5.5 prompting guide). Do not add scope the author did
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

9. **Offer the hand-off (only when step 4 split the prompt into waves).** Do not start
   sessions from this skill. Starting and watching sessions belongs to `orchestrate`,
   which owns the cap of 3, the budget, the `orch:` titles that its sweep and duplicate
   check read, and the ledger. End the reply with the run plan and one line: "Run
   `/orchestrate` to start these." Say which prompts are wave 1 and which wait on
   an earlier wave. `orchestrate` starts a later wave only when the wave before it has
   green draft PRs.

Do not run the prompt yourself. This skill writes, grades and rewrites it.

Test scenarios for step 0 are in `evals.md`. Run them before you change step 0. If the prompt is
already an A+, say so and show the evidence from steps 1 to 5. Do not invent
changes.

## Cloud sessions

When `CLAUDE_CODE_REMOTE=true` (see `docs/development.md`), there is no `gh` CLI. Change
these steps:

- **Step 0.** In a session Gary is watching, interview with `AskUserQuestion` as written. In a
  child or unattended session, do not interview: write each open question as
  `[DECISION: ...]`, with your recommendation first.
- **Step 1.** Check issue and PR numbers with the GitHub MCP tools, not `gh`.
- **Step 7.** In a session Gary is watching, use `AskUserQuestion` as written. In a
  child or unattended session, put each open decision in the prompt as
  `[DECISION: ...]`, with your recommendation first.
- **Output.** Put the run plan, the prompts and the change list in your final
  message. Do not commit them unless the task says to.
