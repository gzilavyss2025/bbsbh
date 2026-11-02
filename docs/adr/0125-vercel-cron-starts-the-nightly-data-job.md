# Vercel Cron starts the nightly data job

**Status:** Accepted (Gary, 2026-11-02)
**Date:** 2026-11-02
**Issue:** #2725

## Context

The nightly data job (`.github/workflows/update-nightly-data.yml`) runs in GitHub Actions on a
`17 8 * * *` schedule. GitHub's scheduler has started it hours late, or not at all (2026-08-28,
2026-09-24); `data-freshness-check.yml` exists to catch that. The team moved to Vercel Pro on
2026-10-29, and Pro's cron fires on time.

## Decision

**Vercel Cron is the trigger only (option 2 of #2725).** The job, its generators, its
`GH_BOT_TOKEN` push to `main` and its CI stay in Actions.

- `api/cron/nightly-dispatch.js`, run by the `crons` entry in `vercel.json` at 08:17 UTC, calls GitHub's
  `workflow_dispatch` for `update-nightly-data.yml` on `main` with `trigger: cron`.
- The workflow's `gate` job treats `trigger: cron` like its own schedule: it skips when another run is
  in flight or succeeded in the last 18 hours (the nightly Claude routine usually ran already). A
  hand dispatch keeps `trigger: hand` and never skips.
- The GitHub schedule stays as the backup. When both fire, the later one finds the first in flight
  and skips.
- The function is inert until two Vercel env vars exist: `CRON_SECRET` (Vercel sends it as a bearer
  token, so no one else can start a run) and `NIGHTLY_DISPATCH_TOKEN`, a fine-grained GitHub token
  with **Actions: write on this repo only**. Gary adds both.

## Consequences

- A late GitHub schedule no longer delays the data: the Vercel dispatch starts the run on time.
- `data-freshness-check.yml` stays until the Vercel trigger has a few weeks of on-time runs.
- Moving the job itself to Vercel (option 3: functions writing to Blob) was rejected: a big rewrite
  that would change how CI gates data.
