#!/usr/bin/env node
// PostToolUse (Bash) hook: whenever Claude Code runs `gh pr merge`, fast-forward
// the PRIMARY checkout so it doesn't go stale until the next SessionStart.
// session-start.sh already does this same check at the start of every session
// (see its "Stale primary-checkout guard"); this hook covers the gap where a
// merge lands mid-session — exactly what happened merging PR #803.
//
// Deliberately targets the primary checkout by fixed path, not $CLAUDE_PROJECT_DIR
// — `gh pr merge` can run from any worktree's session, but there is only one
// primary checkout to keep in sync. Never force-updates: if it's dirty or on a
// branch other than main, this reports and leaves it alone.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const PRIMARY_DIR = process.env.BBSBH_PRIMARY_CHECKOUT || 'C:/Users/gzilavy/bbsbh'

function git(args) {
  return execFileSync('git', args, { cwd: PRIMARY_DIR, encoding: 'utf8' }).trim()
}

try {
  const raw = readFileSync(0, 'utf8')
  const input = JSON.parse(raw || '{}')
  const cmd = input?.tool_input?.command
  if (typeof cmd !== 'string' || !/\bgh\s+pr\s+merge\b/.test(cmd)) process.exit(0)

  if (!existsSync(path.join(PRIMARY_DIR, '.git'))) process.exit(0)

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  if (branch !== 'main') {
    process.stderr.write(
      `bbsbh: a PR merge landed, but the primary checkout (${PRIMARY_DIR}) is on ` +
        `branch "${branch}", not main — skipping auto fast-forward. Needs manual attention.\n`,
    )
    process.exit(0)
  }

  const dirty = git(['status', '--porcelain'])
  if (dirty) {
    process.stderr.write(
      `bbsbh: a PR merge landed, but the primary checkout has uncommitted changes — ` +
        `skipping auto fast-forward. Resolve them, then run 'git pull --ff-only origin main'.\n`,
    )
    process.exit(0)
  }

  git(['fetch', 'origin', 'main', '--quiet'])
  const behind = Number(git(['rev-list', '--count', 'HEAD..origin/main']) || '0')
  if (behind > 0) {
    try {
      git(['merge', '--ff-only', 'origin/main', '--quiet'])
      process.stderr.write(`bbsbh: fast-forwarded primary checkout's main by ${behind} commit(s) after merge.\n`)
    } catch {
      process.stderr.write(
        `bbsbh: WARNING — a PR merge landed but fast-forward failed; ` +
          `run 'git pull --ff-only origin main' manually in the primary checkout.\n`,
      )
    }
  }
} catch {
  // A convenience hook must never break the gh pr merge call that triggered it.
}
process.exit(0)
