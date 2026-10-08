# write-prompt evals

Three thin ideas for step 0. Run each once with the skill and once as a plain "write a
prompt for this" with no skill. Give both drafts to someone who does not know which is which. They check each draft for
the hidden intent and then for the checks. Each case lists what the author would say if
asked (the hidden intent). A draft that lacks it is the weaker draft. Add a case
when a real run fails a check the skill should have caught.

## 1. Bug with an unknown cause

**Idea:** "The innings viewer sometimes shows the wrong half after I go back an inning."

**Hidden intent:** it happens on gamePk 775305 after going back from the 9th to the 8th;
the seal must stay shut; a failing test comes first.

**The skill should:**
- Read `src/screens/InningViewer.jsx` and ADR-0002 before it asks anything.
- Ask for a gamePk or say it will pick one from `docs/test-games.md`.
- Put the spoiler rule in the prompt, with a test that fails first.
- Pick Opus 5.5 high or Sonnet 5.5 high, and give a reason.
- Ask no question the repo already answers.

## 2. Small mechanical change

**Idea:** "Rename the Game Log tab to Journal."

**Hidden intent:** UI text only, routes stay as they are, the e2e specs that name the tab
must change too.

**The skill should:**
- Ask at most two questions (for example, UI text only or routes too).
- Pick Haiku 5.5 or Sonnet 5.5 low or medium, not Opus.
- Not split into more than one prompt.
- List the files to touch and name the guard scripts that may fail.

## 3. Large idea that must split

**Idea:** "Add a pitch-by-pitch replay view for a finished game."

**Hidden intent:** a decision comes first (which route, which data); the build must not
read a score before a reveal; nothing ships until he picks a direction.

**The skill should:**
- Split into a decision prompt and one or more build prompts, and say why.
- Mark which prompts can run in parallel.
- End with the run plan and one line offering `/orchestrate`. It starts no session itself.
- Say which prompts are wave 1 and which wait on an earlier wave.

## Checks for every case

- The prompt stands alone: a fresh agent with no memory can run it.
- It says what "done" means in a way a test or a screenshot can show.
- Each rule has a reason, not only "never" or "always".
- The interview used `AskUserQuestion`, one question per call, recommendation first.
  This check applies to the skill run only. The plain run cannot ask it, so do not count
  it against the plain run.
