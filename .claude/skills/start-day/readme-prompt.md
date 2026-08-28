# README regeneration prompt

The instructions for rewriting `README.md` from the current codebase. Lifted
verbatim from `.github/workflows/regenerate-readme.yml`, which was deleted on
2026-08-28 — it had never once succeeded, because it called
`anthropics/claude-code-action` with an `ANTHROPIC_API_KEY` secret this repo has
never had. Running it from `/start-day` instead means it uses the maintainer's
own Claude Code session and needs no secret at all.

Do not fold this back into a GitHub workflow. Beyond the missing credential, the
action repoints the git remote's push auth, which silently discarded four nights
of nightly-generator output in July 2026 (see `update-nightly-data.yml`'s header).

---

Rewrite README.md in this repo so it faithfully reflects what the app does today.

This is Tally Baseball (repository name: bbsbh), a spoiler-safe, read-only
second-screen PWA for scoring baseball by hand. README.md is written for END
USERS (not developers) in a warm, plain, second-person voice. Read the current
README.md first and preserve that voice, structure, and its section headings
wherever they still fit. This is NOT a developer changelog and NOT the CLAUDE.md
dev guide — keep it about what a person using the app sees and can do.

To learn the current feature set, read the source — especially:

- `src/App.jsx` and `src/lib/route.js` (every screen/route that exists)
- `src/screens/*.jsx` (each user-facing screen)
- `src/components/SiteFooter.jsx` (the site-wide navigation)

Describe features in user terms, not implementation terms.

THE SPOILER RULE IS THE POINT OF THE APP — keep it central: a score-revealing
value is never in the page until the user taps to reveal it, everything re-seals
on navigation, and even tab titles and game cards stay score-free. See
CLAUDE.md's "spoiler rule" section for the exact invariant, but do not copy dev
jargon into the README.

Make only the edits needed to match reality: add features that now exist, remove
any the app no longer has, and correct anything stale. Do NOT churn wording for
its own sake or restructure a section that is already accurate — a minimal,
faithful diff is the goal. If the README is already accurate, make no change at
all. Edit README.md in place; do not create new files.

Writing style: ASD-STE100 governs authored prose here (see
`docs/agents/writing-style.md`), and the house word list is enforced by
`npm run lint` — say "postseason", never the other word. <!-- word-choice-exempt: states the rule -->
Run `npm run lint` after editing and fix anything it flags.
