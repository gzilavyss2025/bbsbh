// scripts/vercel-ignore-build.sh is Vercel's Ignored Build Step: exit 0 SKIPS the
// build, exit 1 builds. These tests run the real script against throwaway git
// repos. The case that pays for itself is a push that only merges `main` into a
// PR branch: it used to rebuild the preview every time, and a wrong skip is a
// silent non-deploy, so every neighbouring case is pinned too.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SCRIPT = resolve('scripts/vercel-ignore-build.sh')

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
    },
  }).trim()
}

function commit(cwd, file, text) {
  mkdirSync(join(cwd, file, '..'), { recursive: true })
  writeFileSync(join(cwd, file), text)
  git(cwd, 'add', '-A')
  git(cwd, 'commit', '-q', '-m', `edit ${file}`)
  return git(cwd, 'rev-parse', 'HEAD')
}

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'ignore-build-'))
  git(dir, 'init', '-q', '-b', 'main')
  commit(dir, 'src/app.js', 'v1')
  return dir
}

function run(cwd, { base, ref }) {
  const env = { ...process.env, VERCEL_GIT_COMMIT_REF: ref }
  delete env.VERCEL_GIT_PREVIOUS_SHA
  if (base) env.VERCEL_GIT_PREVIOUS_SHA = base
  return spawnSync('sh', [SCRIPT], { cwd, env }).status
}

// A branch cut from main, then main moves on with an app change.
function branchBehindMain(dir) {
  git(dir, 'checkout', '-q', '-b', 'claude/feature')
  const tip = commit(dir, 'docs/note.md', 'n1')
  git(dir, 'checkout', '-q', 'main')
  commit(dir, 'src/other.js', 'from main')
  git(dir, 'checkout', '-q', 'claude/feature')
  return tip
}

test('builds a branch with no previous deployment', () => {
  const dir = repo()
  try { assert.equal(run(dir, { ref: 'claude/x' }), 1) } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('skips a push that touched only docs', () => {
  const dir = repo()
  try {
    const base = git(dir, 'rev-parse', 'HEAD')
    commit(dir, 'docs/a.md', 'x')
    assert.equal(run(dir, { base, ref: 'claude/x' }), 0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('builds a push that touched src', () => {
  const dir = repo()
  try {
    const base = git(dir, 'rev-parse', 'HEAD')
    commit(dir, 'src/app.js', 'v2')
    assert.equal(run(dir, { base, ref: 'claude/x' }), 1)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('skips a PR branch push that only merges main in', () => {
  const dir = repo()
  try {
    const base = branchBehindMain(dir)
    git(dir, 'merge', '-q', '--no-ff', '-m', 'Merge origin/main into claude/feature', 'main')
    assert.equal(run(dir, { base, ref: 'claude/feature' }), 0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('builds a main merge on main itself', () => {
  const dir = repo()
  try {
    const base = branchBehindMain(dir)
    git(dir, 'merge', '-q', '--no-ff', '-m', 'Merge origin/main into claude/feature', 'main')
    assert.equal(run(dir, { base, ref: 'main' }), 1)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('builds when the push also carried a src commit before the merge', () => {
  const dir = repo()
  try {
    const base = branchBehindMain(dir)
    commit(dir, 'src/mine.js', 'branch work')
    git(dir, 'merge', '-q', '--no-ff', '-m', 'Merge origin/main into claude/feature', 'main')
    assert.equal(run(dir, { base, ref: 'claude/feature' }), 1)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('builds when a src commit follows the merge', () => {
  const dir = repo()
  try {
    const base = branchBehindMain(dir)
    git(dir, 'merge', '-q', '--no-ff', '-m', 'Merge origin/main into claude/feature', 'main')
    commit(dir, 'src/mine.js', 'after merge')
    assert.equal(run(dir, { base, ref: 'claude/feature' }), 1)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
