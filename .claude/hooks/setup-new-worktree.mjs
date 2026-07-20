#!/usr/bin/env node
// PostToolUse (Bash) hook: whenever a `git worktree add ...` command creates a
// new worktree of THIS repo, kick off `npm install` + `npx playwright install
// chromium` in that worktree right away, in the background. Without this, the
// first `npm run dev`/`lint`/`e2e` in a fresh worktree fails until someone
// remembers to install manually — a friction point that hit repeatedly across
// past sessions (see docs/development.md's worktree workflow).
//
// Fire-and-forget by design: detached, unref'd, logged to a temp file, and the
// hook itself always exits 0 immediately so it never blocks or fails the
// worktree-add tool call. `npx playwright install chromium` is a no-op if the
// exact browser build is already cached (global cache, not per-worktree — see
// playwright.config.js), so this is cheap on repeat worktrees too.
import { readFileSync, existsSync, mkdtempSync, openSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'

function extractWorktreePath(command) {
  // Only care about `git worktree add`; tolerate flags before/after the path
  // (e.g. `-b <branch>`, `--detach`, `-f`) and a trailing commit-ish.
  const m = command.match(/git\s+worktree\s+add\b(.*)/)
  if (!m) return null
  const rest = m[1].trim()
  // Split on unquoted whitespace; good enough for the plain paths/branch
  // names this repo's docs actually recommend (no embedded spaces).
  const tokens = rest.split(/\s+/).filter(Boolean)
  const flagsWithValue = new Set(['-b', '-B', '--lock', '--reason'])
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (tok.startsWith('-')) {
      if (flagsWithValue.has(tok)) i++
      continue
    }
    return tok.replace(/^['"]|['"]$/g, '')
  }
  return null
}

try {
  const raw = readFileSync(0, 'utf8')
  const input = JSON.parse(raw || '{}')
  const cmd = input?.tool_input?.command
  if (typeof cmd !== 'string' || !/git\s+worktree\s+add\b/.test(cmd)) process.exit(0)

  const rel = extractWorktreePath(cmd)
  if (!rel) process.exit(0)

  const cwd = input?.cwd || process.cwd()
  const worktreePath = path.resolve(cwd, rel)
  // Confirm the worktree actually landed (this is PostToolUse — the add may
  // have failed) and that it looks like this repo before installing into it.
  if (!existsSync(path.join(worktreePath, 'package.json'))) process.exit(0)

  const logDir = mkdtempSync(path.join(os.tmpdir(), 'bbsbh-worktree-setup-'))
  const logFile = path.join(logDir, 'setup.log')
  const out = openSync(logFile, 'a')

  const child = spawn(
    process.platform === 'win32' ? 'cmd.exe' : 'sh',
    process.platform === 'win32'
      ? ['/c', 'npm install --no-audit --no-fund && npx playwright install chromium']
      : ['-c', 'npm install --no-audit --no-fund && npx playwright install chromium'],
    { cwd: worktreePath, stdio: ['ignore', out, out], detached: true },
  )
  child.unref()

  process.stderr.write(
    `Detected new worktree at ${worktreePath} — running npm install + ` +
      `playwright install chromium in the background (log: ${logFile}).\n`,
  )
} catch {
  // A setup hook must never break the tool call that triggered it.
}
process.exit(0)
