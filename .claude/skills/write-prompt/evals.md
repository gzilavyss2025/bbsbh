# write-prompt evals

Three thin ideas for step 0. Run each once with the skill and once as a plain "write a
prompt for this" with no skill. Compare the two drafts against the checks. Add a case
when a real run fails a check the skill should have caught.

## 1. Bug with an unknown cause

**Idea:** "The innings viewer sometimes shows the wrong half after I go back an inning."

**The skill should:**
- Read `src/screens/InningViewer.jsx` and ADR-0002 before it asks anything.
- Ask for a gamePk or say it will pick one from `docs/test-games.md`.
- Put the spoiler rule in the prompt, with a test that fails first.
- Pick Opus 5.5 high or Sonnet 5.5 high, and give a reason.
- Ask no question the repo already answers.

## 2. Small mechanical change

**Idea:** "Rename the Game Log tab to Journal."

**The skill should:**
- Ask at most two questions (for example, UI text only or routes too).
- Pick Haiku 5.5 or Sonnet 5.5 low or medium, not Opus.
- Not split into more than one prompt.
- List the files to touch and name the guard scripts that may fail.

## 3. Large idea that must split

**Idea:** "Add a pitch-by-pitch replay view for a finished game."

**The skill should:**
- Split into a decision prompt and one or more build prompts, and say why.
- Mark which prompts can run in parallel.
- Ask Gary before step 9 starts any session.
- Start only wave 1, and say it starts the later waves when the earlier ones are green.

## Checks for every case

- The prompt stands alone: a fresh agent with no memory can run it.
- It says what "done" means in a way a test or a screenshot can show.
- Each rule has a reason, not only "never" or "always".
- The interview used `AskUserQuestion`, one question per call, recommendation first.
