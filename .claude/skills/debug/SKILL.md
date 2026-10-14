---
name: debug
description: Find the root cause of a bbsbh bug, failing test, CI failure or unexpected behaviour before you change any code. Use when something is broken or acts wrong, when a fix did not work, or when the user says "debug", "why does", "it's broken", or "find the cause".
---

# Debug

**The rule: no fix before you know the cause.** A fix for a symptom moves the bug.
Write the cause in one sentence, with the evidence, before you edit product code.

## 1. Read the failure

Read the whole error, stack trace and test output: the file, the line, the values.
In CI, read the failing job's log (`mcp__github__get_job_logs`), not only its name.

## 2. Reproduce it

Make it happen again before you guess. Use the cheapest repro that shows it:

- **A unit test:** `node --test test/<file>.test.js`. One file, not the suite.
- **A game state:** a real gamePk from `docs/test-games.md`, in the preinstalled
  Chromium, with `?nointro` on the URL. The captured anchor game
  (`test/fixtures/game-823035.trimmed.json`, `e2e/fixtures/mock-api.js`) works
  offline.
- **A feed field:** fetch the real response and look. The MLB feed shape has no
  docs (CLAUDE.md, "Verify feed field paths against a live game"). Never guess a
  path.
- Do not run `npm run e2e` unless Gary asks. You can still read a spec, or write
  a new one.

If it does not reproduce, collect more data. Do not fix what you cannot see.

## 3. Find what changed

`git log -p -- <file>` and `git diff origin/main` for the area. For a CI failure,
check whether the same check is red on `main` too. A nightly data cron commits past
`lint-and-build` (`docs/testing.md`), so a red `main` may not be your change.

## 4. Narrow it to one layer

The data moves through layers: statsapi feed → `src/api/` selector → hook
(`useAsync`, `useRevealProgress`) → component → CSS. Log or assert the value at
each boundary. Then read only the layer where the value first goes wrong. Find
working code that does the same job, and list each difference from the broken
code.

Known traps in this repo. Check these first:

- **Spoiler surfaces.** Roster cards (ADR-0005), per-inning `errors` (ADR-0006),
  and a `useRef` cache that must key on `feed` (ADR-0007). A bug on a scoring
  surface is a spoiler question. Read the ADR before you fix, and use Opus or ask
  Gary (orchestrate, "Models").
- **MiLB data.** A field that is missing on a minor-league feed must fall back to
  `''`, `null` or `—` (CLAUDE.md, "MiLB data degrades gracefully").
- **Stale data.** `useAsync` keeps the last good data on `reload`, and resets it
  when its deps change. The service worker never caches statsapi (ADR-0004).
- **Old state in storage.** `bbsbh:reveal:{gamePk}` and the other `bbsbh:` keys in
  `localStorage` persist across loads.

## 5. Test one hypothesis

Write it down: "X causes it, because Y." Make the smallest change that proves or
disproves it. Change one thing at a time. If the result says no, undo the change
and form a new hypothesis. Do not stack fixes.

## 6. Fix it, test first

A real bug ships with a test that fails without the fix (CLAUDE.md, "Test
discipline"). Write the test, see it fail for the cause you found, then fix the
cause. Never skip, delete or loosen a test. Then run the narrow check: the test
files that cover what you changed and `npm run lint`. CI runs the full suite
(orchestrate, "Check once").

## 7. Stop after three

If three fixes have failed, stop. The problem is probably in the design, not the
line. Report what you tried and what each attempt showed. In a session Gary is
watching, ask him. In a child or unattended session, end with
`NEEDS PARENT: <the cause you suspect and what you need>`.

## The report

One short block: **cause** (one sentence), **evidence** (the repro and what it
showed), **fix** (files), and **test** (the one that failed before the fix).
Say what you inferred and did not prove.
