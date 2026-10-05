#!/usr/bin/env node
// PostToolUse (Edit|Write|NotebookEdit) hook, quiet flag for design work.
//
// When an edit lands in a design file, write a small flag file for this session under
// ~/.claude/rung-flags/. The user-level status line (~/.claude/statusline-command.mjs)
// reads it. While the flag is fresh (30 minutes), the status line turns the model
// segment amber if the model and effort sit below rung 3 or at rung 9 and above of the
// ladder in .claude/skills/improve-prompt. A hook cannot see the model, but the status
// line can see both model and effort, so the hook only says "design work is happening".
//
// Advisory only: it never blocks, prints nothing, and swallows every error.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// A design file: any CSS under src/, the UI primitives, or the design lab screen.
const DESIGN = [/^src\/.+\.css$/, /^src\/components\/ui\//, /^src\/screens\/designlab\//]

export function isDesignPath(filePath) {
  if (typeof filePath !== 'string') return false
  const norm = filePath.replace(/\\/g, '/')
  const at = norm.lastIndexOf('/src/')
  const rel = at >= 0 ? norm.slice(at + 1) : norm.replace(/^\.\//, '')
  return DESIGN.some((re) => re.test(rel))
}

export function flagFileFor(sessionId, home = homedir()) {
  // No session id in the hook input: fall back to one shared flag, "any".
  const safe = String(sessionId || '').replace(/[^A-Za-z0-9_-]/g, '') || 'any'
  return path.join(home, '.claude', 'rung-flags', `${safe}.json`)
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  const file = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path
  if (!isDesignPath(file)) return
  const flag = flagFileFor(input?.session_id)
  mkdirSync(path.dirname(flag), { recursive: true })
  writeFileSync(flag, JSON.stringify({ file, at: new Date().toISOString() }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch {
    // An advisory hook must never break a tool call.
  }
  process.exit(0)
}
