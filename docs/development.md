# Development workflow & deployment

How changes land in this repo, and why the deploy setup is shaped the way it is.
The root `CLAUDE.md` carries a short summary and points here for the detail.

## Two working modes

The maintainer is the sole human developer here and wants a fast, direct loop —
but in practice two different modes of working end up in this repo's history, and
it's worth knowing which one you're in:

- **A local/interactive Claude Code CLI session** (the maintainer at a terminal,
  driving directly): **work on `main`, commit and push after every change** — no
  feature branches, no pull requests, no waiting for approval to push. Land each
  self-contained change as its own commit with a clear message and push it straight
  to `origin/main`. Still run `npm run lint` / `npm run build` before pushing so
  `main` stays green.
- **An autonomous or remote session** (Claude Code on the web, a GitHub-triggered
  agent, or anything else running unattended/in the background): these are put on a
  `claude/<slug>` branch and required to open a (draft) pull request by the harness
  that launched them — this is enforced outside this repo, so it applies even though
  it contradicts the bullet above. Don't fight it or try to force a direct push to
  `main` from one of these; open the PR and let the maintainer merge it. This is
  *why* the git log has a visible mix of direct `main` commits and `claude/*`
  branch-then-merge commits — both are correct for the session that made them.

## Concurrent agents

The maintainer sometimes runs several agent sessions at once, each getting its own
`claude/*` branch — good for isolation, but they can still collide at merge time if
two sessions touch the same files/lines while neither can see the other's in-flight
work. To keep that cheap to untangle:

- Pull/rebase onto the latest `main` before starting; don't assume the base you
  branched from is still current.
- Keep each session's change scoped to the one task it was given rather than
  opportunistically touching unrelated files — smaller diffs collide less.
- Say in the PR description which files you touched, so the maintainer can spot
  overlap across several open PRs at a glance.
- Prefer merging/closing promptly over letting several `claude/*` branches sit open
  in parallel — the longer one lives, the more likely another session's PR conflicts
  with it.
- `claude/*` branches don't get their own Vercel preview deployment (see
  `git.deploymentEnabled` below) — verify locally (`npm run dev` / `npm run e2e`)
  before opening the PR rather than expecting a preview URL on the PR check.

## Shipping interactive changes (push straight to `main`)

Interactive sessions with the maintainer push **straight to `main`** — commit each
self-contained change and push it to `origin/main`, which Vercel auto-deploys to
production. No `preview` branch, no look-before-you-ship staging step, no waiting
for a "ship it." The maintainer has opted for the direct loop over the deploy-count
savings a preview branch bought.

- Still run `npm run lint` / `npm run build` before pushing so `main` stays green —
  the direct-to-prod loop makes a red `main` a live-site problem.
- Accumulate a few related edits into one meaningful commit rather than pushing after
  every micro-tweak; each push is a production deploy counting against Vercel Hobby's
  100/day cap (see Deployment below), so don't burn deploys on work-in-progress.
- Screenshots from a Claude session are unreliable for this app — the sandbox
  generally can't reach `statsapi.mlb.com`, so a screenshot shows broken/loading
  state, not the real page. Verify locally (`npm run dev` / `npm run e2e`) before
  pushing; the maintainer eyeballs visual changes on the live site after the deploy.

This is only the **interactive** flow. The autonomous multi-agent `claude/*` PR flow
(above) is unchanged — those branches still open PRs and don't deploy.

## Deployment

Hosted on Vercel, auto-deploying `main` to production on every push. Two things in
`vercel.json` exist specifically because concurrent-agent activity was burning
through Vercel Hobby's 100-deployments/day cap (every push to every branch is its own
deployment, so a `claude/*` branch push *and* its later merge to `main` cost two):

- `git.deploymentEnabled: { "claude/*": false }` — skips deployments entirely for
  agent branches; only `main` (and any branch not matching that pattern) deploys.
  Preview a `claude/*` branch locally instead (see above).
- `ignoreCommand: scripts/vercel-ignore-build.sh` — Vercel's Ignored Build Step;
  skips a deployment when the push touched only docs/scripts/workflow files with no
  effect on the deployed app (diffs against `VERCEL_GIT_PREVIOUS_SHA`, the last commit
  Vercel actually deployed, so a multi-commit push is judged as a whole). Defaults to
  building whenever it can't confidently tell — a missed skip just costs one
  deployment; a wrong skip is a silent non-deploy.

## CI

`.github/workflows/ci.yml` runs `npm run lint` + `npm run build` on every PR and
every push to `main` — a required, visible gate so a session that skipped the local
checks (or whose change only breaks in combination with another still-open PR) can't
merge unnoticed. `npm run lint` also runs the zero-dep guards `check-caps.mjs` and
`check-claude-md.mjs` (see `scripts/CLAUDE.md`).
