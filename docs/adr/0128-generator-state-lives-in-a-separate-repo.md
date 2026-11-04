# Generator state lives in a separate repo

**Status:** Accepted (Gary, 2026-11-04)
**Date:** 2026-11-04
**Issue:** #2886

## Context

`scripts/data/` had grown to 236 MB. Most of it was the SQLite text dumps (`*.sql`, 160 MB)
and `callouts-archive/` (56 MB). The app never reads them; only the generators do. Every clone,
including every cloud session, downloaded all of it.

History growth was not the problem. The dumps are text, so git stores each nightly change as a
small delta, and a frozen season dump (ADR-0086) never changes again. The cost was the checkout.

## Decision

The dumps and the call-out archive move to the private repo `gzilavyss2025/bbsbh-state`, at the
same paths they had under `scripts/data/`. `.gitignore` here lists them, and `isState()` in
`scripts/repo/state.mjs` uses the same two patterns.

- **The nightly** checks the state repo out into `.state/` with `GH_BOT_TOKEN` and runs
  `state.mjs pull`. At the end it runs `state.mjs push` before it commits here, so `main`
  never holds output built from state the state repo does not have.
- **A session** that runs a generator by hand, or `npm run test:state`, runs
  `npm run state:pull` first.
- **Tests on the real dumps** moved, unchanged, to `test-state/`. `npm test` needs no state.
  CI runs `test:state` after it pulls the state repo.
- **The rest stays here:** the hand-kept inputs (`contracts/`, `from/`) and the small scan
  caches. The heartbeat also stays, because `data-freshness-check.yml` reads its commits here.

## Rejected

- **An Actions cache or a workflow artifact.** Entries are evicted or expire, and a lost frozen
  season can't be rebuilt cheaply.
- **Vercel Blob.** It needs another token and keeps no history. Git history is how you recover a
  lost season (#2778).
- **Rewriting this repo's history** to reclaim the space already used. It is destructive and
  forces a re-clone everywhere, and it does nothing for the checkout size.
