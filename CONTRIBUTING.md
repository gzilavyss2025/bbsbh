# Contributing to Tally Baseball

Thanks for your interest in this project. Tally Baseball (`bbsbh`) is a
spoiler-safe, read-only second-screen PWA for scoring baseball by hand — see
`CLAUDE.md` and `CONTEXT.md` for what it is and the vocabulary it uses.

This is currently a solo-maintained project, so the process below is
intentionally lightweight.

## Before you start

- **Open an issue first** for anything beyond a trivial fix (typos, obvious
  bugs). Describe the problem or idea and wait for a thumbs-up before
  investing time in a PR — it avoids wasted work on something that doesn't
  fit the project's direction.
- **Read the spoiler rule — and its scope.** On the surfaces you score a game
  from (the slate's score cells, the lineup pages, the innings viewer, the box
  score) a score-revealing value never exists in the DOM until the user reveals
  it. This is enforced structurally (see the "spoiler rule" section of
  `CLAUDE.md`). Any change that touches reveal logic, `SealBox`, or the
  reveal-only API modules (`src/api/linescore.js`, `src/api/derive.js`) needs
  to preserve this invariant — read the linked ADRs in `docs/adr/` before
  changing how those work. Everything else opens live: season and career stats,
  player and team pages, leader boards, standings. Don't gate one of those "for
  safety" — a stat line is not a score, and that is a regression here.

## Development setup

```bash
npm install
npm run dev        # dev server at http://localhost:5173
```

See `docs/development.md` for the full local workflow, and
`.claude/skills/run.md` if you're using Claude Code.

## Making changes

- Work on a feature branch, never directly on `main`.
- Keep PRs focused — one change per PR.
- Match existing conventions: the token-based CSS design system
  (`src/tokens/*.css`), the fetch/selector split described in
  `src/api/CLAUDE.md`, and the MiLB-degrades-gracefully pattern (missing
  minor-league data falls back to `''`/`null`/`—`, never a crash).
- For a bug fix, add a test that fails before your fix and passes after. See
  "Test discipline" in `CLAUDE.md` — tests are never loosened or skipped to
  make CI pass.

## Checks before opening a PR

```bash
npm run lint           # eslint + guard scripts
npm test               # unit suite (must pass)
npm run build          # production build must succeed
```

For anything user-visible, also run the app locally (`npm run dev`) and
check the actual page — the unit suite covers pure logic, not rendered
output. Playwright specs (`npm run e2e`) are a browser-verification harness;
they're not CI-gated but are worth running for UI changes.

## Opening the PR

- Describe what changed and why, and how you verified it (which route you
  checked, what test you added).
- CI runs `lint-and-build` (lint + `npm test` + build) — it must pass before
  merge.
- Be responsive to review feedback; this keeps the branch from going stale
  against `main`.

## Reporting bugs / requesting features

Open a GitHub issue with:
- What you expected vs. what happened.
- Steps to reproduce, including the game/date if it's data-related (spoiler
  bugs are especially sensitive to the exact game state).
- Browser/device, if relevant (this is a PWA tested primarily on iPhone).

## Code of Conduct

By participating in this project you agree to abide by the
[Code of Conduct](CODE_OF_CONDUCT.md).
