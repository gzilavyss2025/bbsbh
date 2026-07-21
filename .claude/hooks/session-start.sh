#!/bin/bash
# SessionStart hook.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

# --- Stale primary-checkout guard --------------------------------------
# A primary checkout (real .git dir, not a worktree) whose local `main` falls
# behind origin/main silently loses whatever that gap contains — including
# hooks/settings registered in newer commits, since .claude/settings.json
# itself only updates on pull. That exact failure mode bit a session: PR #278
# added the worktree auto-install hook, but a stale primary never picked it
# up, so new worktrees kept hitting the missing-npm-install friction the hook
# was built to prevent (see
# .scratch/dev-environment/issues/01-clerk-missing-from-primary-node-modules.md).
# Catch the drift here, at session start, instead of mid-task.
if [ -d .git ] && [ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)" = "main" ]; then
  git fetch origin main --quiet 2>/dev/null || true
  behind="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"
  if [ "${behind:-0}" -gt 0 ] 2>/dev/null; then
    if [ -z "$(git status --porcelain 2>/dev/null)" ]; then
      echo "bbsbh: primary checkout was $behind commit(s) behind origin/main — fast-forwarding…"
      if git merge --ff-only origin/main --quiet 2>/dev/null; then
        echo "bbsbh: main is now up to date"
      else
        echo "bbsbh: WARNING — fast-forward failed; run 'git pull --ff-only origin main' manually"
      fi
    else
      echo "bbsbh: WARNING — primary checkout's main is $behind commit(s) behind origin/main," \
        "but the working tree has uncommitted changes, so it was not auto-updated." \
        "Resolve them, then run 'git pull --ff-only origin main'."
    fi
  fi
fi

# --- Web-session dependency install -------------------------------------
# Makes a Claude Code on the web session instantly ready by ensuring
# node_modules is present, so lint/build/preview work without a manual
# install. Synchronous (blocks session start until deps are ready) and
# idempotent (a no-op when the tree is already installed, so it's cheap on
# cached containers). Local sessions manage their own node_modules.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Fast path: if the lockfile hasn't changed since the last install, skip.
if [ -d node_modules ] && [ node_modules -nt package-lock.json ]; then
  echo "bbsbh: node_modules up to date, skipping install"
  exit 0
fi

echo "bbsbh: installing npm dependencies…"
npm install --no-audit --no-fund
# Touch so the freshness check above short-circuits next time.
touch node_modules
echo "bbsbh: dependencies ready"
