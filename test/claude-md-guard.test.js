// check-claude-md.mjs runs in `npm run lint`. Two things it must do that a
// hand-kept list and a line count could not: find a nested CLAUDE.md by walking
// the tree (so a new file cannot skip the caps), and see a long line (a table
// row once held 7,000 characters inside a file of 74 lines).
//
// The guard finds the repo from its own location, so each case copies it into a
// scratch tree and runs it there.

import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

const SCRIPTS = path.join(fileURLToPath(new URL('.', import.meta.url)), '../scripts')

function run(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'claude-md-guard-'))
  try {
    mkdirSync(path.join(dir, 'scripts/lib'), { recursive: true })
    copyFileSync(path.join(SCRIPTS, 'check-claude-md.mjs'), path.join(dir, 'scripts/check-claude-md.mjs'))
    copyFileSync(path.join(SCRIPTS, 'lib/walk.mjs'), path.join(dir, 'scripts/lib/walk.mjs'))
    for (const [file, text] of Object.entries({ 'CLAUDE.md': '# root\n', ...files })) {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      writeFileSync(path.join(dir, file), text)
    }
    return spawnSync(process.execPath, [path.join(dir, 'scripts/check-claude-md.mjs')], { encoding: 'utf8' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// The scratch tree has no src/CLAUDE.md, so every run exits 1 on that file's budget. Each
// case therefore reads stderr for the one file it is about.
test('a small nested file raises no complaint', () => {
  const res = run({ 'src/deep/CLAUDE.md': '# deep\n' })
  assert.doesNotMatch(res.stderr, /src\/deep/)
})

test('a nested file in a folder no list names is still capped by lines', () => {
  const res = run({ 'src/brand-new/CLAUDE.md': 'line\n'.repeat(251) })
  assert.equal(res.status, 1)
  assert.match(res.stderr, /src\/brand-new\/CLAUDE\.md is 251 lines/)
})

test('one long line fails the character cap', () => {
  const res = run({ 'src/wide/CLAUDE.md': `${'x'.repeat(20001)}\n` })
  assert.equal(res.status, 1)
  assert.match(res.stderr, /src\/wide\/CLAUDE\.md is 20002 characters/)
})

test('the root file has a character cap too', () => {
  const res = run({ 'CLAUDE.md': `${'x'.repeat(16001)}\n` })
  assert.equal(res.status, 1)
  assert.match(res.stderr, /root CLAUDE\.md is 16002 characters/)
})

test('another agent\'s worktree under .claude is not walked', () => {
  const res = run({ '.claude/worktrees/other/CLAUDE.md': 'line\n'.repeat(300) })
  assert.doesNotMatch(res.stderr, /worktrees/)
})
