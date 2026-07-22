#!/usr/bin/env node
// Lists every worktree of this repo and classifies each as stale (its branch is
// already merged into origin/main, or its upstream branch was deleted after the
// PR merged) or active (still has unmerged work). Read-only — this script only
// reports, it never removes anything; `.claude/skills/clean-worktrees.md` is the
// interactive on-demand cleanup that acts on the report.
//
// Companion to scripts/dev-servers.mjs, which does the same for running vite
// processes. Same split on purpose: report at session start, act only on demand
// with confirmation, and never touch another agent's work automatically.
//
// Why this exists: worktrees accumulate silently. Nothing in the normal
// branch → PR → merge flow removes the local worktree afterwards, so a session
// in 2026-07 found 48 worktrees, 41 of them for branches already merged and
// deleted upstream. Each carries its own ~14.5k-file node_modules, so removing
// 30 at once takes long enough to blow a command timeout. Surfacing them every
// session keeps the cleanup to one or two at a time, which is fast.
//
// Reads the last-fetched remote state; it does not fetch. Run
// `git fetch origin --prune` first (the /start-day skill does) or a
// just-merged branch still reads as active.
//
// classifyWorktree is exported and kept pure (plain facts in, verdict out) so
// test/worktrees.test.js can pin the distinctions that are easy to get wrong —
// see the notes on each branch below.
import { execFileSync } from 'node:child_process'

/**
 * @param {object} facts
 * @param {string|null} facts.branch        branch name, or null when detached
 * @param {string} facts.base               default branch name, e.g. 'main'
 * @param {boolean} facts.isPrimary         is this the primary checkout
 * @param {string|null} facts.upstream      configured upstream ref, or null
 * @param {boolean} facts.upstreamExists    does that upstream ref still resolve
 * @param {boolean} facts.merged            is HEAD an ancestor of origin/<base>
 * @param {boolean} facts.atBaseTip         is HEAD exactly origin/<base>'s tip
 * @param {number} facts.dirty              count of uncommitted files
 */
export function classifyWorktree(facts) {
  const { branch, base, isPrimary, upstream, upstreamExists, merged, atBaseTip, dirty } = facts

  if (isPrimary) return { status: `${base} (primary checkout)`, stale: false }
  if (!branch) return { status: 'detached (no branch)', stale: false }

  // A branch just created from origin/<base> is trivially an ancestor of it, so
  // `merged` alone would flag the worktree you are actively starting work in as
  // safe to delete. It is only distinguishable from a genuinely merged branch by
  // sitting exactly on the base tip: a merged branch's HEAD is its own last
  // commit, which is inside origin/<base>'s history but behind its tip.
  if (merged && atBaseTip) return { status: 'fresh (no commits yet)', stale: false }

  // Uncommitted work is the one hard stop. Never mark such a worktree stale, no
  // matter how merged it looks — that is someone's unsaved work.
  if (dirty > 0) {
    const why = merged || (upstream && !upstreamExists) ? 'merged, but has uncommitted changes' : 'active (uncommitted changes)'
    return { status: why, stale: false }
  }

  if (merged) return { status: `merged into origin/${base}`, stale: true }

  // Upstream configured but deleted on the remote is the normal end state after
  // a PR merges and GitHub deletes the head branch. Checked structurally — does
  // the remote-tracking ref still resolve — rather than by grepping
  // `git branch -vv` for "[gone]", which is a trap: git prints
  // "[origin/<branch>: gone]", so the obvious pattern silently matches nothing.
  if (upstream && !upstreamExists) {
    return { status: 'upstream branch deleted (PR merged or closed)', stale: true }
  }

  if (!upstream) return { status: 'active (never pushed)', stale: false }
  return { status: 'active (unmerged work)', stale: false }
}

function git(args, cwd) {
  return execFileSync('git', cwd ? ['-C', cwd, ...args] : args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
}

function tryGit(args, cwd) {
  try {
    return git(args, cwd)
  } catch {
    return null
  }
}

// `git worktree list --porcelain` emits one blank-line-separated block per
// worktree: a `worktree <path>` line, `HEAD <sha>`, then either
// `branch refs/heads/<name>` or `detached`. The first block is the primary.
function listWorktrees() {
  const out = tryGit(['worktree', 'list', '--porcelain'])
  if (!out) return []
  return out
    .split(/\n\s*\n/)
    .map((block, i) => ({
      root: block.match(/^worktree (.+)$/m)?.[1] ?? null,
      branch: block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? null,
      isPrimary: i === 0,
    }))
    .filter((w) => w.root)
}

function gatherFacts(wt) {
  const { root, branch, isPrimary } = wt
  const base = tryGit(['rev-parse', '--abbrev-ref', 'origin/HEAD'], root)?.replace('origin/', '') || 'main'
  const upstream = tryGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], root)
  const dirtyOut = tryGit(['status', '--porcelain'], root)
  return {
    branch,
    base,
    isPrimary,
    upstream,
    upstreamExists: upstream !== null && tryGit(['rev-parse', '--verify', '--quiet', upstream], root) !== null,
    merged: tryGit(['merge-base', '--is-ancestor', 'HEAD', `origin/${base}`], root) !== null,
    atBaseTip: tryGit(['rev-parse', 'HEAD'], root) === tryGit(['rev-parse', `origin/${base}`], root),
    dirty: dirtyOut ? dirtyOut.split('\n').filter(Boolean).length : 0,
  }
}

// Running as a script, not imported by the test.
if (process.argv[1] && process.argv[1].endsWith('worktrees.mjs')) {
  const worktrees = listWorktrees()
  if (worktrees.length === 0) {
    console.log('worktrees: none found.')
    process.exit(0)
  }

  const rows = worktrees.map((wt) => {
    const facts = gatherFacts(wt)
    return { ...wt, ...classifyWorktree(facts), dirty: facts.dirty }
  })

  const stale = rows.filter((r) => r.stale)
  const blocked = rows.filter((r) => r.dirty > 0 && r.status.startsWith('merged,'))

  // --brief is for the SessionStart hook, which already prints a dev-server
  // report and a stale-checkout warning. A 20-line table on top of that is
  // noise the maintainer learns to scroll past, so summarise there and keep the
  // full listing for /clean-worktrees and manual runs.
  const brief = process.argv.includes('--brief')
  if (brief && stale.length === 0 && blocked.length === 0) process.exit(0)

  console.log(`worktrees: ${rows.length} total, ${stale.length} stale (safe to remove).`)
  if (!brief) {
    for (const r of rows) {
      const dirtyNote = r.dirty > 0 ? `  [${r.dirty} uncommitted file(s)]` : ''
      console.log(`  ${r.root}  [${r.branch ?? 'detached'}]  — ${r.status}${dirtyNote}`)
    }
  }

  if (blocked.length > 0) {
    console.log(
      `worktrees: ${blocked.length} look merged but have uncommitted changes — ` +
        'NOT safe to remove; review them by hand.',
    )
  }

  if (stale.length > 0) {
    console.log(
      `worktrees: run the /clean-worktrees skill to review and remove the ${stale.length} stale one(s).`,
    )
  }
}
