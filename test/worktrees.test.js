// Unit coverage for the worktree staleness classifier (scripts/worktrees.mjs),
// which decides whether the /clean-worktrees skill may offer a worktree for
// deletion. The verdicts here gate an irreversible `git worktree remove`, so
// each "not stale" case below is a guard against proposing the deletion of
// live work.
//
// Two distinctions in particular are easy to get wrong, and both were live bugs
// caught while writing the script:
//   - A branch freshly created from origin/main is an ancestor of origin/main,
//     exactly like a merged branch — so a naive "is it merged?" check marks the
//     worktree you just started working in as safe to delete.
//   - Requiring commits ahead of origin/main to tell those apart flips the
//     other way and marks every genuinely merged branch as fresh, because a
//     merged branch's commits are, by then, inside origin/main too.
import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyWorktree } from '../scripts/worktrees.mjs'

// A merged worktree: its commits landed in main, so HEAD is an ancestor of
// origin/main but sits behind main's tip.
const merged = {
  branch: 'claude/some-feature',
  base: 'main',
  isPrimary: false,
  upstream: 'origin/claude/some-feature',
  upstreamExists: true,
  merged: true,
  atBaseTip: false,
  dirty: 0,
}

test('a merged branch with no uncommitted work is stale', () => {
  const { stale, status } = classifyWorktree(merged)
  assert.equal(stale, true)
  assert.match(status, /merged into origin\/main/)
})

test('a freshly created worktree sitting on the base tip is not stale', () => {
  // Regression: `merged` alone is true here, because a branch cut from
  // origin/main is trivially an ancestor of it. Only `atBaseTip` separates
  // this from the merged case above.
  const { stale, status } = classifyWorktree({ ...merged, atBaseTip: true })
  assert.equal(stale, false)
  assert.match(status, /fresh/)
})

test('uncommitted work always blocks staleness, even when merged', () => {
  const { stale, status } = classifyWorktree({ ...merged, dirty: 3 })
  assert.equal(stale, false)
  assert.match(status, /uncommitted/)
})

test('a deleted upstream branch is stale even when not an ancestor of main', () => {
  // The normal end state after a squash-merged PR: the head branch is gone on
  // the remote, and the local branch's commits never literally appear in main.
  const { stale, status } = classifyWorktree({
    ...merged,
    merged: false,
    upstreamExists: false,
  })
  assert.equal(stale, true)
  assert.match(status, /upstream branch deleted/)
})

test('an unmerged branch with a live upstream is not stale', () => {
  const { stale, status } = classifyWorktree({ ...merged, merged: false })
  assert.equal(stale, false)
  assert.match(status, /active/)
})

test('a never-pushed branch is not stale', () => {
  // No upstream means no evidence the work was ever shared, so it cannot be
  // confirmed merged — the most dangerous thing to delete.
  const { stale, status } = classifyWorktree({
    ...merged,
    merged: false,
    upstream: null,
    upstreamExists: false,
  })
  assert.equal(stale, false)
  assert.match(status, /never pushed/)
})

test('the primary checkout is never stale', () => {
  const { stale } = classifyWorktree({ ...merged, isPrimary: true, branch: 'main', atBaseTip: true })
  assert.equal(stale, false)
})

test('a detached worktree is never stale', () => {
  const { stale, status } = classifyWorktree({ ...merged, branch: null })
  assert.equal(stale, false)
  assert.match(status, /detached/)
})
