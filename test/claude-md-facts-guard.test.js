// check-claude-md-facts.mjs compares the root file's nested-files bullet with the CLAUDE.md files
// on disk. In the primary checkout, `.claude/worktrees/*` holds a copy of the whole repo, so a
// walk that enters `.claude` reports another agent's CLAUDE.md files as unlisted and fails lint.
//
// The guard finds the repo from its own location, so the case copies it into a scratch tree.

import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

const SCRIPT = path.join(fileURLToPath(new URL('.', import.meta.url)), '../scripts/check-claude-md-facts.mjs')

const ROOT_MD = `# CLAUDE.md

**Two Vercel functions live in \`api/\`**, each inert; **one never render or fetch a score.**
**The second stores a score, by design**. A one-tab hub.

- **Nested \`CLAUDE.md\`** files:
  - \`src/\` — the app.
- **Docs** — elsewhere.
`

function run(extra) {
  const dir = mkdtempSync(path.join(tmpdir(), 'claude-md-facts-'))
  try {
    mkdirSync(path.join(dir, 'scripts'), { recursive: true })
    copyFileSync(SCRIPT, path.join(dir, 'scripts/check-claude-md-facts.mjs'))
    const files = {
      'CLAUDE.md': ROOT_MD,
      'api/a.js': '',
      'api/b.js': '',
      'src/CLAUDE.md': '# src\n',
      'src/screens/team/TeamTabBar.jsx': "const TABS = [{ key: 'overview' }]\n",
      ...extra,
    }
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      writeFileSync(path.join(dir, file), text)
    }
    return spawnSync(process.execPath, [path.join(dir, 'scripts/check-claude-md-facts.mjs')], { encoding: 'utf8' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('a scratch tree with a matching list passes', () => {
  const res = run({})
  assert.equal(res.status, 0, res.stderr)
})

test('another agent\'s worktree under .claude is not read as an unlisted nested file', () => {
  const res = run({ '.claude/worktrees/other/src/CLAUDE.md': '# copy\n' })
  assert.equal(res.status, 0, res.stderr)
})

test('a real unlisted nested file still fails', () => {
  const res = run({ 'src/deep/CLAUDE.md': '# deep\n' })
  assert.equal(res.status, 1)
  assert.match(res.stderr, /src\/deep\/CLAUDE\.md exists but/)
})
