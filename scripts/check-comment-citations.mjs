#!/usr/bin/env node
// Guards against a specific comment-rot pattern: citing a pull request number
// inline as the reason something is the way it is. CLAUDE.md already says this
// belongs in the PR description, not the code — "don't reference the current
// task/fix/callers... that belongs in PR descriptions... since those rot as the
// codebase evolves." A codebase-wide comment audit found 17 of these across 15
// files (all since fixed); this guard is what stops a new one landing unnoticed.
//
// WHY IT ROTS SPECIFICALLY. The reasoning next to a pull-request number is
// usually genuine WHY and worth keeping — the citation itself is the problem.
// It reads fine the day it lands, then a year on nobody remembers what that
// number was, `git log --all --grep` doesn't index merged numbers by content,
// and the reader is left with an unfollowable pointer where the argument
// should be. The fix each time is the same: keep the reasoning, drop the
// number.
//
// Only flags comments (// and block comments), not identifiers, URLs, or
// string literals, so a legitimate `github.com/.../pull/123` link in a doc
// comment or a data file untouched by this guard's roots is not a false hit.
//
// Run by `npm run lint` (so it gates every push).

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const ROOTS = ['src', 'api', 'scripts']
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git'])
const SOURCE_EXT = ['.js', '.jsx', '.mjs']

// Matches the letters "PR", optional space, a hash, then digits — case-
// insensitive, so lowercase reads the same way — not a bare pull-request
// URL (those are left alone; see header).
const CITATION = /\bPR\s*#\d+/i

function walk(dir, out = []) {
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (IGNORE_DIRS.has(entry)) continue
    const rel = `${dir}/${entry}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (SOURCE_EXT.some((ext) => entry.endsWith(ext))) out.push(rel)
  }
  return out
}

// Scans a file's // and /* */ comment text only — not code, not string
// literals — the same restriction the header promises.
function findCitations(rel) {
  const hits = []
  const lines = readFileSync(join(ROOT, rel), 'utf8').split('\n')
  let inBlock = false
  lines.forEach((line, i) => {
    let commentText = ''
    if (inBlock) {
      const end = line.indexOf('*/')
      commentText += end === -1 ? line : line.slice(0, end)
      if (end !== -1) inBlock = false
    }
    if (!inBlock) {
      const lineStart = line.indexOf('/*')
      const slashSlash = line.indexOf('//')
      if (lineStart !== -1 && (slashSlash === -1 || lineStart < slashSlash)) {
        const end = line.indexOf('*/', lineStart + 2)
        if (end === -1) {
          commentText += line.slice(lineStart + 2)
          inBlock = true
        } else {
          commentText += line.slice(lineStart + 2, end)
        }
      } else if (slashSlash !== -1) {
        commentText += line.slice(slashSlash + 2)
      }
    }
    if (CITATION.test(commentText)) hits.push({ line: i + 1, text: line.trim() })
  })
  return hits
}

let files = []
for (const root of ROOTS) files = files.concat(walk(root))

// Same vacuous-pass hazard the sibling guards call out — a healthy checkout
// has hundreds of source files across these three roots.
if (files.length < 500) {
  console.error(
    `\n✗ Comment-citation guard has nothing to check — found ${files.length} source file(s) ` +
      `under src/, api/, scripts/.\n  A checkout this small means the script is being run from ` +
      'the wrong place; fix it, do not delete this assertion.\n',
  )
  process.exit(1)
}

const problems = []
for (const file of files) {
  for (const hit of findCitations(file)) {
    problems.push(`${file}:${hit.line}  ${hit.text}`)
  }
}

if (problems.length) {
  console.error(
    '\n✗ Comment-citation guard failed — these comments cite a pull request number inline.\n' +
      '  Keep the reasoning, drop the number: it belongs in the PR description, not the code.\n',
  )
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}

console.log(`✓ Comment-citation guard holds — ${files.length} source files checked, no inline pull-request citations.`)
