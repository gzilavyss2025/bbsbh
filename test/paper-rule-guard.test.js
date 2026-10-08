// check-typography.mjs also guards the colour primitives (#1156, ADR-0107): a
// partial in src/styles/ reads an alias, never --paper-N, --rule, --rule-soft or
// --rule-grid. The guard scans src/styles/ under the working directory, so each
// case writes a scratch tree and runs the real script there. The scratch tree
// carries no spacing ledger entries, so the run always exits 1 on those; each case
// reads the lines about the token it is testing.

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

const GUARD = path.join(fileURLToPath(new URL('.', import.meta.url)), '../scripts/check-typography.mjs')

function run(css) {
  const dir = mkdtempSync(path.join(tmpdir(), 'paper-rule-guard-'))
  try {
    mkdirSync(path.join(dir, 'src/styles'), { recursive: true })
    writeFileSync(path.join(dir, 'src/styles/x.css'), css)
    return spawnSync(process.execPath, [GUARD], { cwd: dir, encoding: 'utf8' }).stderr
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const TOKENS = ['--paper-0', '--paper-1', '--paper-2', '--paper-3', '--paper-9', '--rule', '--rule-soft', '--rule-grid']

test('a read of each primitive fails and names the token', () => {
  for (const t of TOKENS) {
    const err = run(`.a { border-color: var(${t}); }\n`)
    assert.match(err, new RegExp(`x\\.css:1: .*reads ${t}(?![\\w-])`), t)
  }
})

test('a read in any property, a list or a fallback fails', () => {
  assert.match(run('.a { box-shadow: 0 0 0 1px var(--rule), 0 1px var(--paper-0); }\n'), /--rule\b/)
  assert.match(run('.a { background: linear-gradient(var(--paper-1), var(--rule-grid)); }\n'), /--paper-1/)
  assert.match(run('.a { --edge: var(--rule-soft, #ccc); }\n'), /--rule-soft/)
})

test('a read in the last declaration, with no semicolon, fails', () => {
  assert.match(run('.a { border-color: var(--rule) }\n'), /--rule\b/)
})

test('an alias, a lookalike name and a comment do not fail', () => {
  const err = run(
    '/* border: var(--rule); */\n.a { border-color: var(--border-grid); color: var(--rule-strong); }\n',
  )
  assert.doesNotMatch(err, /--rule|--paper/)
})

test('a definition is not a read', () => {
  assert.doesNotMatch(run('.a { --paper-2: #fff; }\n'), /--paper/)
})
