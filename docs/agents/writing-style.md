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
