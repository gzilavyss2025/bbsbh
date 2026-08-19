#!/usr/bin/env node
// Guards against two ADRs claiming the same number.
//
// ADR numbers are assigned by hand, and this repo runs several agents on
// several branches at once. Two of them take "the next number" from the same
// main, six hours apart, and both are right when they write it — the collision
// only exists once both branches land. That is exactly how 0048 came to name
// BOTH "a stamped game opens for the reader who stamped it" AND "guides are
// server-rendered documents", which left every bare "ADR-0048" in the tree
// ambiguous, including two in CLAUDE.md that meant different documents.
//
// Numbering is only checked for UNIQUENESS, never for gaps. A withdrawn or
// superseded ADR should be free to leave a hole rather than force a renumber
// that would invalidate every reference to the documents after it.
//
// Run by `npm run lint` (so it gates every push).

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const ADR_DIR = join(ROOT, 'docs/adr')

let files
try {
  files = readdirSync(ADR_DIR)
} catch {
  console.error('\n✗ ADR number check failed — docs/adr/ could not be read.\n')
  process.exit(1)
}

const byNumber = new Map()
for (const name of files) {
  const match = /^(\d{4})-.+\.md$/.exec(name)
  if (!match) continue
  const number = match[1]
  if (!byNumber.has(number)) byNumber.set(number, [])
  byNumber.get(number).push(name)
}

const collisions = [...byNumber.entries()]
  .filter(([, names]) => names.length > 1)
  .sort(([a], [b]) => a.localeCompare(b))

if (collisions.length > 0) {
  console.error(
    '\n✗ ADR number check failed — the following number(s) name more than one\n' +
      '  decision, so every "ADR-NNNN" reference to them is ambiguous:\n'
  )
  for (const [number, names] of collisions) {
    console.error(`  ${number}`)
    for (const name of names) console.error(`    docs/adr/${name}`)
  }
  console.error(
    '\n  Renumber the later-authored one to the next free number (check every\n' +
      '  open branch first — `git ls-tree -r --name-only <ref> -- docs/adr/` —\n' +
      '  because an unmerged branch may already have claimed it). Then repoint\n' +
      '  every reference to it, and only to it: a bare "ADR-NNNN" elsewhere in\n' +
      '  the tree may mean either document.\n'
  )
  process.exit(1)
}

console.log(`✓ All ${byNumber.size} ADR numbers in docs/adr/ are unique.`)
