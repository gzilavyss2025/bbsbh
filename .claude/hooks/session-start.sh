#!/bin/bash
# SessionStart hook — makes a Claude Code on the web session instantly ready by
# ensuring node_modules is present, so lint/build/preview work without a manual
# install. Synchronous (blocks session start until deps are ready) and idempotent
# (a no-op when the tree is already installed, so it's cheap on cached containers).
set -euo pipefail

# Web sessions only — locally you manage your own node_modules.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

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
