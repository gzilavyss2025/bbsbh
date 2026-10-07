---
name: design-brief
description: Walk Gary from a vague design idea ("I want to re-design this page, I don't like how it looks") to a ready-to-paste design prompt, or a short run of prompts, with the repo's design rules, a way to check the result, and a model and effort for each. Use when the user says "design brief", "help me write a design prompt", "I want to redesign this page", "I don't like how this looks", or starts design work with no prompt yet. For a design attempt that already failed, use design-retry.
---

# Design brief

Gary has an idea, not a prompt. You ask a few questions, read the page, and write the
prompt. You do not design the page and you do not change code. Write in ASD-STE100
(`docs/agents/writing-style.md`). Read `references/design-rules.md` first.

Gary is not a developer. Ask short questions with plain words and a default he can accept.
Ask with `AskUserQuestion`, up to 4 questions per call, your recommendation first and
marked "(Recommended)". If the task already answers a question, skip it.

1. **Find the page.** If the task does not name a route or screen, ask in chat. Then fetch
   (`git fetch`) and read: the screen file in `src/screens/`, the CSS partial it uses, the
   nearest nested `CLAUDE.md`, and the components it renders. Write down:
   - which tokens and components it already uses;
   - whether it is a scoring surface (the spoiler rule applies) or an open page;
   - any rule in `references/design-rules.md` the page already follows.
2. **Ask the first batch.** Four questions in one call:
   - *What kind of change?* Restyle (same layout), re-layout (same data), new content and
     layout, or full redesign. Recommend the smallest kind that fixes his complaint.
   - *What bothers you most?* Hierarchy (what to read first), density, it feels generic,
     colour, type, motion, or "I can't say yet". Allow more than one answer.
   - *What does good look like?* A screen already in the app, a block in `/design-lab`, an
     outside reference (`docs/design-inspiration.md` lists some), or "propose directions".
   - *How big?* One page in one pass, or slices. Recommend slices for a full redesign.
3. **Ask the second batch from what you read.** Name the specific things you found and ask
   which must stay: the data shown, the sealed values, the route, the order of sections, a
   component other pages share. Add anything that would change another page.
4. **Choose the shape.**
   - A vague direction: Prompt 1 explores 3 or 4 directions and stops for Gary's pick.
     Prompt 2 builds only that one.
   - A clear direction: one build prompt.
   - A full redesign: a plan prompt, then one build prompt per slice. A slice touches about
     5 files at most.
   - Add a polish prompt only when Gary asks for one.
5. **Write each prompt.** Each prompt stands alone, in this order:
   - The goal in one sentence, and the route.
   - What stays the same (from step 3).
   - The direction: the chosen reference, or the order to propose 3 or 4 and stop.
   - The tokens, components and screens to copy, by path.
   - The rules from `references/design-rules.md` that apply to this page, and no others.
   - The widths. Every design covers phone (390 px), iPad portrait (820 px), iPad landscape
     (1180 px) and desktop (1440 px), not phone alone. Read the page's CSS for its breakpoints
     (`src/styles/25-wide-layout.css` holds the wide ones) and say what each width does. A
     direction prompt proposes each layout as a phone plus wide pair. iPad is touch: nothing
     may need hover.
   - How to check: the dev-server route with `?nointro`, a screenshot at each width, and what
     to look at. The agent hands Gary the local link (a cloud agent sends the screenshots).
   - Done means: the guards in `npm run lint` pass, `npm test` passes, the page looks right
     at about 390 px, and the PR targets `main` from a task branch. The agent never pushes
     to `main`.
   - Stop and ask when: a rule conflicts with the design, or the page needs data the app
     does not fetch.
6. **Pick model and effort.** Use the ladder in step 5 of the `improve-prompt` skill. Use
   its design rungs: explore directions on Sonnet 5.5 medium, build from a settled
   direction on Sonnet 5.5 high, a design decision or a spoiler-adjacent page on Opus 5.5
   high. Give one line of reason for each.
7. **Grade the prompts.** Always run the `improve-prompt` skill on the prompts you wrote, before
   you show them. It checks each repo claim (routes, paths, line numbers, class names, who uses
   a component), grades the set, and rewrites it. Show Gary the graded result: the grade, the
   fixes, and the final prompts. Do not show the ungraded draft as the answer. When a prompt
   changes a page for more than one width, it must name each width and say how to take each
   screenshot.

## Output

- A run plan table: `#`, what it does, model, effort, depends on.
- For each prompt, a heading `Prompt N of M — <model>, effort <level>` and the complete
  prompt in its own code block.
- Under the prompts, 3 lines at most: what you assumed, and what Gary should check first.

## Cloud sessions

When `CLAUDE_CODE_REMOTE=true`, a session Gary is watching still uses `AskUserQuestion` as
written. In a child or unattended session, write each open question as `[DECISION: ...]`
in the prompt, your recommendation first, and make the plan prompt answer it before the
build prompt starts.
