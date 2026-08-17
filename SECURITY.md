# Security Policy

Tally Baseball (`bbsbh`) is a solo-maintained, read-only PWA. It has **no
backend by default** — every device queries `https://statsapi.mlb.com`
directly. A handful of opt-in Vercel functions under `api/` add small,
narrowly-scoped backends (reveal sync, editable copy, account preferences,
Game Log stamps); each is inert until its own environment variables are
configured. See `CLAUDE.md` and `docs/api/` for what each one does.

## Supported versions

There are no version branches. Only the latest code on `main`, as deployed
at [tallybb.com](https://tallybb.com), is supported. Fixes land as
a new commit, not a backport.

## Reporting a vulnerability

**Please don't open a public GitHub issue for a security report.** Instead,
contact the maintainer directly:

- GitHub: [@gzilavyss2025](https://github.com/gzilavyss2025) (send a private
  message, or open a [private security
  advisory](https://github.com/gzilavyss2025/bbsbh/security/advisories/new)
  if enabled for this repo)

Include what you found, the steps to reproduce it, and its impact if you can.
This is a side project with no dedicated security team, so response time
varies — expect an acknowledgment within a few days.

## Scope

In scope:
- The deployed app at tallybb.com.
- The opt-in Vercel functions in `api/` (auth bypass, data leakage between
  accounts, injection, etc.).
- Anything that would let one user read or modify another user's data
  (reveal state, Game Log stamps, account preferences).

Out of scope:
- The app is spoiler-safe by design, not secret-safe — the underlying game
  data comes from the public MLB Stats API and isn't sensitive. A report
  that a *score* is visible somewhere isn't a security issue; file it as a
  regular bug against the spoiler rule instead (see `CLAUDE.md`).
- Denial-of-service reports against a free-tier Vercel Hobby deployment.
- Issues that require physical access to a user's device.

## What to expect

If a report is confirmed, the fix ships as a normal PR against `main` (see
`CONTRIBUTING.md`). There's no bug bounty — this is an unpaid solo project —
but you'll be credited in the fix's commit or PR description if you'd like.
