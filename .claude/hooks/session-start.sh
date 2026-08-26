#!/bin/bash
# SessionStart hook.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

# --- Stale git lock guard ----------------------------------------------
# git takes an exclusive lock (index.lock, HEAD.lock, config.lock) for the
# duration of any operation that writes the index or a ref, and removes it on
# exit. A process killed mid-write — a closed terminal, a crashed session, a
# hook interrupted by Ctrl+C — leaves the lock behind, and from then on EVERY
# git command in that checkout fails with "Unable to create '…/index.lock':
# File exists". There is no other symptom: git looks broken, not locked.
#
# This bit a session on 2026-08-25. A lock left at 08:33 the previous morning
# blocked the whole primary checkout for a full day, including the
# fast-forward guard below — which is why this block runs FIRST.
#
# Staleness is decided by AGE, not by "is any git running". Several agent
# sessions work this repo at once, so some git process is nearly always alive;
# gating on that would mean the guard almost never fires. Age is the honest
# signal — nothing here holds a lock for minutes (the slowest observed, a
# 4,744-file `git worktree add`, is seconds). A live git process only buys a
# longer grace period, it doesn't veto the sweep.
git_is_running() {
  if command -v pgrep >/dev/null 2>&1 && pgrep -x git >/dev/null 2>&1; then
    return 0
  fi
  if command -v tasklist >/dev/null 2>&1 &&
     tasklist 2>/dev/null | grep -qiE '^git\.exe'; then
    return 0
  fi
  return 1
}

# Seconds a lock must go untouched before it counts as abandoned.
if git_is_running; then
  lock_stale_after=600   # something is live; leave a wide margin
else
  lock_stale_after=60    # no git at all — a lock here is orphaned by definition
fi

# Resolve gitdirs through git itself, not by assuming ".git" is a directory:
# in a linked worktree it's a FILE pointing at .git/worktrees/<name>, and a
# lock there breaks that worktree only, just as invisibly.
git_common_dir="$(git rev-parse --git-common-dir 2>/dev/null || echo .git)"
git_own_dir="$(git rev-parse --git-dir 2>/dev/null || echo .git)"

lock_dirs="$git_common_dir"
if [ "$git_own_dir" != "$git_common_dir" ]; then
  lock_dirs="$lock_dirs $git_own_dir"
fi
# From the primary checkout, sweep every linked worktree's gitdir too, so one
# session's crash doesn't leave another worktree wedged until someone opens it.
if [ -d "$git_common_dir/worktrees" ]; then
  for wt in "$git_common_dir"/worktrees/*/; do
    if [ -d "$wt" ] && [ "${wt%/}" != "$git_own_dir" ]; then
      lock_dirs="$lock_dirs ${wt%/}"
    fi
  done
fi

for d in $lock_dirs; do
  for name in index.lock HEAD.lock config.lock; do
    lock="$d/$name"
    [ -f "$lock" ] || continue
    # -newermt with a relative time: empty output means "older than that".
    if [ -n "$(find "$lock" -newermt "-$lock_stale_after seconds" 2>/dev/null)" ]; then
      continue
    fi
    if rm -f "$lock" 2>/dev/null; then
      echo "bbsbh: cleared a stale git lock ($lock) left behind by an" \
        "interrupted git process — it was blocking every git command in" \
        "that checkout"
    else
      echo "bbsbh: WARNING — found a stale git lock ($lock) but could not" \
        "remove it. Delete that file by hand; git will keep failing until you do."
    fi
  done
done

# --- Stay in sync with origin/main (any checkout, any branch) ----------
# A checkout whose `main` falls behind origin/main silently loses whatever
# that gap contains — including hooks/settings registered in newer commits,
# since .claude/settings.json itself only updates on pull. That exact failure
# mode bit a session: PR #278 added the worktree auto-install hook, but a
# stale primary never picked it up, so new worktrees kept hitting the
# missing-npm-install friction the hook was built to prevent (see
# .scratch/dev-environment/issues/01-clerk-missing-from-primary-node-modules.md).
#
# CLAUDE.md puts nearly every session on a task branch, not `main` — a guard
# that only fired for a primary checkout literally on `main` almost never ran
# in practice. Widened here to any checkout on any branch: worktree, primary,
# or a remote/web session's task branch alike.
#
# `git merge --ff-only` is the safety net. It advances the branch only when
# doing so loses nothing — HEAD's whole history already sits inside
# origin/main's. A task branch that carries commits of its own simply fails
# the fast-forward and falls through to a report instead: never a real merge,
# never touched automatically, since only that branch's own agent knows
# whether pulling main in mid-task is welcome.
current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [ -n "$current_branch" ] && [ "$current_branch" != "HEAD" ]; then
  git fetch origin main --quiet 2>/dev/null || true
  behind="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"
  if [ "${behind:-0}" -gt 0 ] 2>/dev/null; then
    if [ -z "$(git status --porcelain 2>/dev/null)" ]; then
      if git merge --ff-only origin/main --quiet 2>/dev/null; then
        if [ "$current_branch" = "main" ]; then
          echo "bbsbh: primary checkout was $behind commit(s) behind origin/main — fast-forwarded, now up to date"
        else
          echo "bbsbh: '$current_branch' was $behind commit(s) behind origin/main — fast-forwarded to match"
        fi
      elif [ "$current_branch" = "main" ]; then
        echo "bbsbh: WARNING — origin/main is $behind commit(s) ahead but the fast-forward failed;" \
          "run 'git pull --ff-only origin main' manually"
      else
        echo "bbsbh: '$current_branch' is $behind commit(s) behind origin/main and carries commits" \
          "of its own, so it was not auto-merged. Merge origin/main in yourself when convenient" \
          "(git fetch origin main && git merge origin/main)."
      fi
    else
      echo "bbsbh: WARNING — '$current_branch' is $behind commit(s) behind origin/main, but the" \
        "working tree has uncommitted changes, so it was not auto-updated. Resolve them, then" \
        "pull main in yourself (fast-forward if possible, merge otherwise)."
    fi
  fi
fi

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  # --- Web-session dependency install -------------------------------------
  # Makes a Claude Code on the web session instantly ready by ensuring
  # node_modules is present, so lint/build/preview work without a manual
  # install. Synchronous (blocks session start until deps are ready) and
  # idempotent (a no-op when the tree is already installed, so it's cheap on
  # cached containers).
  if [ -d node_modules ] && [ node_modules -nt package-lock.json ]; then
    echo "bbsbh: node_modules up to date, skipping install"
  else
    echo "bbsbh: installing npm dependencies…"
    npm install --no-audit --no-fund
    # Touch so the freshness check above short-circuits next time.
    touch node_modules
    echo "bbsbh: dependencies ready"
  fi
else
  # --- Stale dev-server report (local sessions only) ---------------------
  # Dev servers started in a worktree (npm run dev / dev:2../5) aren't tied
  # to any session lifecycle, so they keep running — and squatting on the
  # reserved ports — after their worktree's work is merged and the session
  # that started them is long gone. This just reports; it never kills
  # anything (see .claude/skills/clean-dev-servers.md for the interactive
  # on-demand cleanup that does).
  if [ -f scripts/dev-servers.mjs ]; then
    node scripts/dev-servers.mjs || true
  fi

  # --- Stale worktree report (local sessions only) -----------------------
  # Same shape as the dev-server check above, and for the same reason: nothing
  # in the branch → PR → merge flow removes a worktree once its PR lands, so
  # they pile up silently (48 of them, 41 already merged, by 2026-07). Each
  # holds its own ~14.5k-file node_modules, so a big backlog is slow to clear;
  # surfacing it every session keeps it to one or two at a time. Reports only
  # (--brief, and silent when there's nothing stale) — see
  # .claude/skills/clean-worktrees.md for the interactive cleanup that acts.
  if [ -f scripts/worktrees.mjs ]; then
    node scripts/worktrees.mjs --brief || true
  fi
fi
