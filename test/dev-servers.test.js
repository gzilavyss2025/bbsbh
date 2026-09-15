// Unit coverage for the dev-server staleness classifier
// (scripts/dev-servers.mjs), which decides whether /start-day and
// /clean-dev-servers may kill a running vite process.
//
// The bug these pin, observed on 2026-09-15: this script used to answer
// "finished?" with its own ancestry check — is HEAD an ancestor of origin/main
// — while scripts/worktrees.mjs answered it with a richer classifier that also
// treats a deleted upstream branch as finished. A squash-merged PR fails the
// ancestry check (its commits never enter main verbatim) but has its upstream
// deleted, so the two reports disagreed on the same four branches: worktrees
// said "safe to remove", dev-servers said "active (unmerged work)".
//
// /start-day follows both. Followed literally that morning, it removed four
// worktrees and left four servers running on the deleted folders — which on
// Windows also locked those folders open, so the removals half-failed and
// stranded ~37k files that neither script could see any more.
//
// The fix is structural: dev-servers now delegates to classifyWorktree, so the
// two cannot drift apart again. These tests pin the delegation, not a
// re-implementation of it — worktrees.test.js owns the verdict rules
// themselves.
import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyDevServer } from '../scripts/dev-servers.mjs'

// A squash-merged branch: the PR landed, GitHub deleted the head branch, and
// the local commits are NOT ancestors of origin/main.
const squashMerged = {
  branch: 'claude/some-feature',
  base: 'main',
  isPrimary: false,
  upstream: 'origin/claude/some-feature',
  upstreamExists: false,
  merged: false,
  onBaseFirstParent: false,
  dirty: 0,
}

test('a server on a squash-merged branch is stale', () => {
  // The regression. An ancestry-only check calls this "active (unmerged work)"
  // and leaves the server running on a worktree /start-day is about to remove.
  const { stale, status } = classifyDevServer({ rootExists: true, facts: squashMerged })
  assert.equal(stale, true)
  assert.match(status, /upstream branch deleted/)
})

test('a server whose worktree was deleted is stale', () => {
  const { stale, status } = classifyDevServer({ rootExists: false, facts: null })
  assert.equal(stale, true)
  assert.match(status, /orphaned/)
})

test('a server on a merge-committed branch is stale', () => {
  const { stale, status } = classifyDevServer({
    rootExists: true,
    facts: { ...squashMerged, merged: true, upstreamExists: true },
  })
  assert.equal(stale, true)
  assert.match(status, /merged into origin\/main/)
})

test('a server on genuinely unmerged work is not stale', () => {
  const { stale, status } = classifyDevServer({
    rootExists: true,
    facts: { ...squashMerged, upstreamExists: true },
  })
  assert.equal(stale, false)
  assert.match(status, /active/)
})

test('a server on a never-pushed branch is not stale', () => {
  // No upstream means no evidence the work was ever shared, so it cannot be
  // confirmed finished — the most dangerous thing to kill and then delete.
  const { stale, status } = classifyDevServer({
    rootExists: true,
    facts: { ...squashMerged, upstream: null },
  })
  assert.equal(stale, false)
  assert.match(status, /active/)
})

test('a server in the primary checkout is never stale', () => {
  // `npm run dev` in the repo root is the normal case, not litter.
  const { stale, status } = classifyDevServer({
    rootExists: true,
    facts: { ...squashMerged, branch: 'main', isPrimary: true, merged: true },
  })
  assert.equal(stale, false)
  assert.match(status, /primary checkout/)
})

test('a server on a freshly created worktree is not stale', () => {
  // A branch cut from origin/main is trivially an ancestor of it; only
  // first-parent membership separates it from a merged branch.
  const { stale, status } = classifyDevServer({
    rootExists: true,
    facts: { ...squashMerged, merged: true, upstreamExists: true, onBaseFirstParent: true },
  })
  assert.equal(stale, false)
  assert.match(status, /fresh/)
})

test('a server on a worktree with uncommitted work is not stale', () => {
  const { stale, status } = classifyDevServer({
    rootExists: true,
    facts: { ...squashMerged, dirty: 2 },
  })
  assert.equal(stale, false)
  assert.match(status, /uncommitted/)
})

test('a server on a folder that is not a checkout is not stale', () => {
  const { stale } = classifyDevServer({ rootExists: true, facts: null })
  assert.equal(stale, false)
})
