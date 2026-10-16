#!/usr/bin/env node
// Guards the repo paths that docs/*.md cite in backticks. Its sibling
// check-claude-md-facts.mjs does this for CLAUDE.md only; the second audit pass
// (docs/audits/second-pass-docs-2026-10-15.md, Q2) found 36 dead paths in docs/
// that nothing flagged, such as `src/api/loadPlayer.js` after the file was
// deleted. A catalog that points at a missing file sends a reader nowhere.
//
// WHAT IT CHECKS. Every backticked token that starts with a repo root folder
// (ROOTS below) must exist, after the `:12` / `:12-30` / `#anchor` suffix is cut.
//
// WHAT IT SKIPS, each for a stated reason:
//   - docs/audits/ and docs/adr/. Audits are dated snapshots, and ADRs record
//     what was true when they were written. Both name code that later moved.
//   - A doc whose first 10 lines hold a "> **Historical.**" status line. Such a
//     doc is a dated proposal that says its paths are old.
//   - A line that says the path is gone ("was deleted", "no longer exists", …).
//     That line is correct history. Name the deleted file on such a line and
//     the guard stays quiet.
//   - Globs and placeholders (`src/*.js`, `src/<name>.jsx`, `{a,b}`).
//   - `.scratch/`. Those are working notes (issue #1304 plans to cut them).
//
// Run by `npm run lint`.

import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ROOT, toPosix, walk } from '../lib/walk.mjs'

const ROOTS = ['src/', 'scripts/', 'api/', 'public/', 'test/', 'e2e/', 'docs/']
const SKIP_DIRS = ['docs/audits/', 'docs/adr/']
// A line with one of these says the cited file is gone, so it is history.
const GONE = /\b(was|were|is|are|been|now|got)\s+(deleted|removed|gone|retired)\b|\bno longer (exists?|there)\b|\b(deleted|removed) (in|by|with)\b|\bdoes not exist\b|\bnot yet created\b|\bto be created\b/i

const problems = []
let checked = 0

const docs = walk(join(ROOT, 'docs'), { exts: ['.md'] })
for (const file of docs) {
  const rel = toPosix(relative(ROOT, file))
  if (SKIP_DIRS.some((d) => rel.startsWith(d))) continue
  const lines = readFileSync(file, 'utf8').split('\n')
  if (lines.slice(0, 10).some((l) => l.startsWith('> **Historical.**'))) continue
  lines.forEach((line, i) => {
    if (GONE.test(line)) return
    for (const [, raw] of line.matchAll(/`([^`\s]+)`/g)) {
      if (!ROOTS.some((r) => raw.startsWith(r))) continue
      if (/[*<>{}$|]/.test(raw) || raw.includes('...') || raw.includes('…')) continue
      const token = raw.replace(/[:#][\w,.\-–()]*$/, '').replace(/[.,;)]+$/, '')
      checked++
      if (!existsSync(join(ROOT, token))) problems.push(`${rel}:${i + 1} cites \`${raw}\`, which does not exist.`)
    }
  })
}

if (problems.length) {
  console.error('\n✗ Doc path check failed. These docs cite a repo path that is not there:\n')
  for (const p of problems) console.error(`  ${p}`)
  console.error('\n  Fix the doc: point it at the module that holds the code now. If the doc')
  console.error('  says on purpose that the file is gone, write "was deleted" on that line.\n')
  process.exit(1)
}

console.log(`✓ doc paths hold — ${checked} backticked repo paths in docs/ all resolve.`)
