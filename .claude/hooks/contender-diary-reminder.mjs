#!/usr/bin/env node
// PostToolUse advisory hook — fires when a session touches the team-success
// research data or its write-ups, and reminds it that the Contender Diary at
// /admin/contenders is part of the deliverable. Sibling of
// research-diary-reminder.mjs (the prospect-research diary's own hook); same
// contract, a different watch list — see that file's header for why a hook
// rather than CLAUDE.md prose, and why it reminds instead of blocking.
import { readFileSync } from 'node:fs'

// The team-success research surface. Anything under here changing means a
// finding may have moved, been corrected, or been retracted. Widen this when
// a new factor spike adds its own script/doc — a path not listed here is a
// path nobody gets reminded about.
const WATCHED = [
  'docs/team-success-research.md',
  '.scratch/team-success/',
]

const DIARY = 'src/lib/research/contenderDiary'

function normalize(text) {
  return String(text ?? '').replace(/\\/g, '/')
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  const toolInput = input?.tool_input ?? {}

  const haystack = normalize(
    [toolInput.file_path, toolInput.notebook_path, toolInput.command].filter(Boolean).join('\n'),
  )
  if (!haystack) process.exit(0)

  const hits = WATCHED.filter((path) => haystack.includes(path))
  const alreadyOnIt = haystack.includes(DIARY)

  if (hits.length && !alreadyOnIt) {
    process.stderr.write(
      'bbsbh contender-diary note: this touched team-success research data (' +
        hits.join(', ') +
        '). The Contender Diary is a deliverable of that work, not a follow-up. ' +
        'If this changed, added, corrected or retracted a FINDING, add it to ' +
        DIARY +
        '/ in the same commit — a new entry at the TOP of RESEARCH_DIARY in ' +
        'index.js, never an edit to an existing one. Write it for a reader who ' +
        'does not know what a p-value is; the formal numbers go in the entry\'s ' +
        '`technical` list. If this was a refactor, a rerun with no change in ' +
        'conclusion, or a typo, no entry is needed — say so and move on. ' +
        'Full instructions: docs/agents/contender-diary.md\n',
    )
  }
} catch {
  // A reminder hook must never break a tool call — swallow everything.
}
process.exit(0)
