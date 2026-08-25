# Writing style: ASD-STE100, always on in this repo

This repo defaults to [ASD-STE100](https://www.asd-ste100.org/) (Simplified
Technical English) for prose written *in the context of this repo* — you do not
need to ask for it each session. The rules themselves live in
`.claude/skills/asd-ste100/SKILL.md`; this file only states where they apply and
what stays exempt.

## Where it applies

- **Chat replies to the user.** Explanations, status updates, summaries — one
  meaning per word, active voice, simple tense, one instruction per sentence,
  short sentences.
- **Docs authored into the repo.** `CLAUDE.md` (root and nested), `docs/*`,
  `docs/adr/*`, `CONTEXT.md`, code comments — anything written to be read by a
  future agent or contributor with no author to ask for clarification.
- **Commit messages and PR descriptions.** Body text explaining the change.

## What stays exempt

- Code identifiers, config keys, CLI flags, file paths, and other literal
  strings — never rephrase a real name.
- Proper nouns: player/team names, ADR numbers, ticket IDs, API field names.
- Quoted material (feed responses, error strings the app actually emits, user
  quotes) — quote it verbatim, simplify the surrounding prose instead.
- Precision. If a plain rewrite would drop a condition, exception, or scope
  qualifier, keep the longer, exact phrasing and say so — never trade accuracy
  for brevity.

## How to apply it

Read a passage once for meaning, then check it against the rule table in
`.claude/skills/asd-ste100/SKILL.md` before sending or committing it: word
ambiguity, tense, voice, sentence length, dropped words, oversized noun
clusters. Rewrite what fails. Do not force changes onto text that already
complies.

## The house word list

Some words have one approved form here, whatever the surrounding style. The
list is short on purpose, and `scripts/check-word-choice.mjs` enforces it in
`npm run lint`, so a wrong form fails the build instead of waiting for a
reviewer to see it.

| Say | Never say |
| --- | --- |
| postseason | playoffs, playoff | <!-- word-choice-exempt: states the rule -->

**Postseason, not playoffs.** <!-- word-choice-exempt: states the rule -->
Baseball's October is the postseason. MLB calls
it that, a scorebook calls it that, and this app calls it that on every
surface: page copy, callout text, doc prose, code comments, and the identifier
names that carry the value (`postseasonPct`, `madePostseason`,
`classifyPostseason`). The rule covers identifiers as well as prose for a
reason — a codebase that stores `playoffPct` <!-- word-choice-exempt: states the rule -->
and renders "Postseason" teaches
the next reader that the two are separate things, and the guard would have to
choose a side anyway.

### Scope of the guard

It reads `src/`, `api/`, `scripts/`, `docs/`, `.claude/`, and the root
`*.md` files — the text this app authors. It does **not** read `*.json`,
because data files carry values captured from somebody else's system.
`.scratch/prospect-traits/awards.json` holds real award titles such as
"MiLB.com Double-A Best Playoff Performer" <!-- word-choice-exempt: real award title -->
renaming those would break the
join against statsapi and misname an actual award.

### The one exemption

A proper noun you do not own — or a line that states this rule — may keep
its own spelling. FanGraphs ships a
product called "Playoff Odds" <!-- word-choice-exempt: third-party product -->
and calling it "Postseason Odds" would make it
unfindable. Mark that line `word-choice-exempt` and say why. Use it only for a
name somebody else controls — never to keep your own prose as it was.

### Adding a word

Add a row to `RULES` in `scripts/check-word-choice.mjs` and a row to the table
above, in the same commit. Fix every existing use first, or the guard fails
the build for everyone.
