#!/bin/sh
# Vercel's "Ignored Build Step" (see vercel.json's ignoreCommand). Vercel runs
# this before every deployment; exit 0 SKIPS the build+deploy, exit 1 lets it
# proceed. Purpose: the Hobby plan caps deployments at 100/day, and pushes
# that only touch docs/scripts/workflow files (no effect on the deployed
# app) were burning that budget same as a real code change. Skip those.
#
# Diffs against VERCEL_GIT_PREVIOUS_SHA (the last deployment Vercel actually
# built for this branch — only set because ignoreCommand is configured) so a
# multi-commit push is compared as a whole, not just its last commit. Falls
# back to HEAD^ for a branch's first-ever deployment, and — if even that
# doesn't resolve (a fresh/shallow clone) — falls through to "build," since a
# false skip is a real regression and a false build just costs one deploy.
BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"

if ! git cat-file -e "${BASE}^{commit}" >/dev/null 2>&1; then
  exit 1
fi

git diff --quiet "$BASE" HEAD -- \
  src public index.html package.json package-lock.json vite.config.js vercel.json api
