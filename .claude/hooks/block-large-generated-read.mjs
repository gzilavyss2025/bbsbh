#!/usr/bin/env node
// PreToolUse guard: refuses to Read a large MACHINE-GENERATED data file whole.
//
// This repo commits ~28 MB of precomputed JSON under public/data/ (the
// build-time-fetch pattern — see src/api/CLAUDE.md) plus ~6.7 MB of SQLite
// TEXT dumps under scripts/data/. Several single files are over a megabyte:
// umpires.json is 3.2 MB, pitch-arsenal.sql 2.2 MB, rookies.json 1.2 MB.
//
// None of them is written or reviewed by hand, and reading one whole answers a
// question nobody has: the SHAPE is documented in prose (src/api/CLAUDE.md for
// the reader module, scripts/CLAUDE.md for the generator), and any actual
// lookup wants one key, not the file. A single accidental Read of rookies.json
// spends a large fraction of a context window on repeated player-id records.
//
// So this is not a safety rule, it's an economics one — and unlike a permission
// deny it can say what to do instead. Bash is the escape hatch and is
// deliberately NOT guarded: `jq`, `head -c` and `sed -n` all still work, and
// they return a bounded answer, which is the whole point.
//
// Two thresholds:
//   1. GENERATED_DIRS at GENERATED_MAX — the precompute output above.
//   2. A universal BACKSTOP_MAX for anything else. No hand-written source file
//      in this repo comes close (the largest, src/styles/12-sealbox.css at
//      ~1,900 lines, is under 60 KB); what this catches is package-lock.json
//      and whatever large generated thing lands next without anyone thinking
//      to list its directory here.
//
// No hardcoded absolute path: paths are matched relative to the repo root
// found by walking up from the file, so this works in every worktree.

import fs from 'node:fs'
import path from 'node:path'

const GENERATED_DIRS = ['public/data', 'scripts/data', 'dist']
const GENERATED_MAX = 60 * 1024
const BACKSTOP_MAX = 250 * 1024

const KB = (n) => `${Math.round(n / 1024).toLocaleString()} KB`

function repoRootFor(startDir) {
  let dir = startDir
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

let input = ''
process.stdin.on('data', (chunk) => {
  input += chunk
})
process.stdin.on('end', () => {
  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    process.exit(0)
  }

  const filePath = payload?.tool_input?.file_path || ''
  if (!filePath) process.exit(0)

  // An explicit offset/limit is already a bounded read — that IS the recipe
  // this hook would otherwise be recommending, so let it through.
  if (payload?.tool_input?.offset != null || payload?.tool_input?.limit != null) process.exit(0)

  const resolved = path.resolve(filePath)
  let size
  try {
    const stat = fs.statSync(resolved)
    if (!stat.isFile()) process.exit(0)
    size = stat.size
  } catch {
    process.exit(0) // missing file — let the tool report that itself
  }

  const root = repoRootFor(path.dirname(resolved))
  const relPath = root ? path.relative(root, resolved).replace(/\\/g, '/') : null
  const generatedDir = relPath
    ? GENERATED_DIRS.find((d) => relPath === d || relPath.startsWith(`${d}/`))
    : null

  const limit = generatedDir ? GENERATED_MAX : BACKSTOP_MAX
  if (size <= limit) process.exit(0)

  const name = relPath ?? resolved
  const what = generatedDir
    ? `${name} is ${KB(size)} of machine-generated output under ${generatedDir}/. ` +
      'Nobody writes or reviews it by hand, and reading it whole would spend a large ' +
      'part of the context window on repeated records.'
    : `${name} is ${KB(size)} — past the ${KB(BACKSTOP_MAX)} backstop for a single Read. ` +
      'No hand-written source file in this repo is anywhere near that size, so this is ' +
      'almost certainly generated or vendored.'

  const instead = [
    'Read it in bounded form instead, via Bash (not guarded):',
    `  jq 'keys[:20]' "${name}"                 # top-level keys`,
    `  jq -c 'to_entries[:2]' "${name}"         # two whole records, to see the shape`,
    `  jq '.["<id>"]' "${name}"                 # the one entry you actually want`,
    `  head -c 600 "${name}"                    # works on .sql dumps too`,
    '',
    'Or read the prose, which is usually the real answer: the SHAPE and the reason',
    'each file exists are in src/api/CLAUDE.md (the reader module) and',
    'scripts/CLAUDE.md (the generator that writes it).',
    '',
    'If you genuinely need a slice of the file itself, Read with an explicit',
    'offset/limit — that is allowed through.',
  ].join('\n')

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `${what}\n\n${instead}`,
      },
    }),
  )
  process.exit(0)
})
