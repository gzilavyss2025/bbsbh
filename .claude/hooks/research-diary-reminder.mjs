#!/usr/bin/env node
// PostToolUse advisory hook — fires when a session touches the prospect
// research data or its write-ups, and reminds it that the diary at
// /admin/research is part of the deliverable.
//
// WHY A HOOK AND NOT A LINE IN CLAUDE.md. The ask was "whenever we touch this
// data, add the newest findings to the page" — an always-happens guarantee.
// Prose in a context file is a request an agent can rationalize past on a busy
// turn, and the ones that get missed are exactly the busy turns. A hook fires
// on the tool call itself, in every session, whoever is driving. Same reason
// spoiler-review-reminder.mjs exists.
//
// WHY IT REMINDS RATHER THAN BLOCKS. The right entry cannot be written before
// the work is done, so blocking the edit that produces the finding would be
// backwards. It nags on the way past and leaves the judgement where it
// belongs. It always exits 0 and never throws — a reminder that becomes a road
// block gets disabled, and then it reminds nobody of anything.
//
// It also stays quiet when the same call already touched the diary, so a
// session that IS writing the entry is not told to write the entry.
import { readFileSync } from 'node:fs'

// The prospect-research surface. Anything under here changing means a finding
// may have moved, been corrected, or been retracted.
const WATCHED = [
  'docs/level-tenure-benchmark.md',
  'docs/team-movement-windows.md',
  'docs/homegrown-dependence.md',
  'docs/prospect-traits.md',
  'scripts/gen-level-tenure-benchmark.mjs',
  'public/data/level-tenure-benchmark.json',
  'src/api/levelTenure.js',
  '.scratch/level-benchmarks/',
  '.scratch/prospect-traits/',
]

const DIARY = 'src/lib/research/diary'

// Normalize both slash styles — this repo is developed on Windows and the same
// path arrives as `src\\api\\...` from Edit and `src/api/...` from a bash
// heredoc. A matcher that only knew one would silently cover half the traffic.
function normalize(text) {
  return String(text ?? '').replace(/\\/g, '/')
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  const toolInput = input?.tool_input ?? {}

  // Edit/Write give a path; Bash gives a command line that may name several.
  // Scanning the raw command is deliberately loose — a false reminder costs a
  // line of stderr, a missed one costs a stale page nobody notices for months.
  const haystack = normalize(
    [toolInput.file_path, toolInput.notebook_path, toolInput.command].filter(Boolean).join('\n'),
  )
  if (!haystack) process.exit(0)

  const hits = WATCHED.filter((path) => haystack.includes(path))
  const alreadyOnIt = haystack.includes(DIARY)

  if (hits.length && !alreadyOnIt) {
    process.stderr.write(
      'bbsbh research-diary note: this touched prospect-research data (' +
        hits.join(', ') +
        '). The admin research diary is a deliverable of that work, not a ' +
        'follow-up. If this changed, added, corrected or retracted a FINDING, ' +
        'add it to ' +
        DIARY +
        '/ in the same commit — a new entry at the TOP of RESEARCH_DIARY in ' +
        'index.js, never an edit to an existing one, because the diary keeps ' +
        'superseded entries on purpose. Write it for a reader who does not ' +
        'know what a p-value is; the formal numbers go in the entry\'s ' +
        '`technical` list. If this was a refactor, a rerun with no change in ' +
        'conclusion, or a typo, no entry is needed — say so and move on. ' +
        'Before you pull new data or build a new join, check the catalog in ' +
        'docs/agents/research-database.md (scripts/research-db.mjs) for a panel ' +
        'that may already cover it. ' +
        'Full instructions: docs/agents/research-diary.md\n',
    )
  }
} catch {
  // A reminder hook must never break a tool call — swallow everything.
}
process.exit(0)
