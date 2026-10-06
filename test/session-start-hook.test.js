// The cloud half of .claude/hooks/session-start.sh's fast-forward guard. A cloud
// session's task branch comes with a local-only origin/<branch> ref set to main's
// tip at creation. When the hook fast-forwards the branch to a newer main, the
// platform Stop hook counts origin/<branch>..HEAD and reported every new main
// commit as "unpushed" (80 of them, on every turn). These build a throwaway
// origin + clone and run the real script against it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.claude', 'hooks', 'session-start.sh')
const BRANCH = 'claude/test-session-abc123'
// spawn('bash') on Windows can resolve to WSL bash; CI (ubuntu) runs these.
const skip = process.platform === 'win32' && 'needs a POSIX bash'

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' },
  }).trim()
}

// origin has main with one commit; the clone sits on BRANCH at that commit with
// a local-only origin/BRANCH ref (what the cloud environment sets up); then main
// gains `ahead` commits on origin.
function setup({ ahead = 3, pushBranch = false } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'bbsbh-session-start-'))
  const origin = path.join(root, 'origin.git')
  const work = path.join(root, 'work')
  const other = path.join(root, 'other')
  git(root, 'init', '--bare', '-b', 'main', origin)
  git(root, 'clone', '-q', origin, other)
  git(other, 'commit', '-q', '--allow-empty', '-m', 'base')
  git(other, 'push', '-q', 'origin', 'main')
  git(root, 'clone', '-q', origin, work)
  git(work, 'checkout', '-q', '-b', BRANCH)
  if (pushBranch) git(work, 'push', '-q', 'origin', BRANCH)
  else git(work, 'update-ref', `refs/remotes/origin/${BRANCH}`, 'HEAD')
  for (let i = 0; i < ahead; i++) git(other, 'commit', '-q', '--allow-empty', '-m', `main ${i}`)
  git(other, 'push', '-q', 'origin', 'main')
  // Make the cloud dependency step a no-op: node_modules newer than the lockfile.
  writeFileSync(path.join(work, 'package-lock.json'), '{}')
  mkdirSync(path.join(work, 'node_modules'))
  const later = new Date(Date.now() + 60_000)
  execFileSync('touch', ['-d', later.toISOString(), path.join(work, 'node_modules')])
  // The guard only fast-forwards a clean tree.
  writeFileSync(path.join(work, '.git', 'info', 'exclude'), 'package-lock.json\nnode_modules\n')
  return { root, work, origin }
}

function runHook(work, remote = 'true') {
  const r = spawnSync('bash', [HOOK], {
    cwd: work,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: work, CLAUDE_CODE_REMOTE: remote },
  })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout
}

const unpushed = (work) => Number(git(work, 'rev-list', '--count', `origin/${BRANCH}..HEAD`))

test('cloud: after the fast-forward, main\'s new commits do not read as unpushed', { skip }, () => {
  const { root, work } = setup({ ahead: 3 })
  try {
    assert.match(runHook(work), /was 3 commit\(s\) behind origin\/main — fast-forwarded/)
    assert.equal(git(work, 'rev-parse', 'HEAD'), git(work, 'rev-parse', 'origin/main'))
    assert.equal(unpushed(work), 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('cloud: a branch that is really on GitHub keeps its true remote ref', { skip }, () => {
  const { root, work, origin } = setup({ ahead: 2, pushBranch: true })
  try {
    runHook(work)
    assert.equal(git(work, 'rev-parse', `origin/${BRANCH}`), git(origin, 'rev-parse', BRANCH))
    assert.equal(unpushed(work), 2)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('local sessions leave the remote ref alone', { skip }, () => {
  const { root, work } = setup({ ahead: 2 })
  try {
    runHook(work, '')
    assert.equal(unpushed(work), 2)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
