#!/bin/sh
# Vercel's "Ignored Build Step" (see vercel.json's ignoreCommand). Vercel runs
# this before every deployment; exit 0 SKIPS the build+deploy, exit 1 lets it
# proceed. Purpose: pushes that only touch docs/scripts/workflow files (no
# effect on the deployed app) do not need a build. Written for the Hobby
# plan's 100-deployments-a-day cap; kept on Pro to save build minutes.
#
# Diffs against VERCEL_GIT_PREVIOUS_SHA (the last deployment Vercel actually
# built for this branch — only set because ignoreCommand is configured) so a
# multi-commit push is compared as a whole, not just its last commit. A
# branch's first-ever deployment has no previous SHA: build it. (It used to
# fall back to HEAD^, which judged a new branch by its last commit alone and
# skipped a code branch whose final commit was docs-only.) A base that does
# not resolve (a fresh/shallow clone) also builds, since a false skip is a
# real regression and a false build just costs one deploy.
BASE="${VERCEL_GIT_PREVIOUS_SHA:-}"

if [ -z "$BASE" ] || ! git cat-file -e "${BASE}^{commit}" >/dev/null 2>&1; then
  exit 1
fi

git diff --quiet "$BASE" HEAD -- \
  src public index.html package.json package-lock.json vite.config.js vercel.json api
