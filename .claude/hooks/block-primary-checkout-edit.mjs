#!/usr/bin/env node
// PreToolUse guard: refuses Edit/Write/NotebookEdit against a repo's PRIMARY
// checkout (a real .git directory) as opposed to one of its worktrees (.git
// is a pointer file there). This repo's convention (see root CLAUDE.md /
// docs/development.md) is that every task works in its own
// `git worktree add ../<repo>-<slug> -b claude/<slug>` — the primary
// checkout is shared/live, other sessions may be concurrently using it.
//
// No hardcoded path: walks up from the edited file to find the nearest
// `.git` entry and checks whether it's a directory or a file. Portable by
// design, so this same file protects every clone of this repo on every
// machine, not just the one it was written on.
import fs from 'node:fs'
import path from 'node:path'

function findGitEntry(startDir) {
  let dir = startDir
  for (;;) {
    const gitPath = path.join(dir, '.git')
    if (fs.existsSync(gitPath)) return gitPath
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

let input = ''
process.stdin.on('data', (chunk) => { input += chunk })
process.stdin.on('end', () => {
  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    process.exit(0)
  }

  const filePath = payload?.tool_input?.file_path || payload?.tool_input?.notebook_path || ''
  if (!filePath) process.exit(0)

  const fileDir = path.dirname(path.resolve(filePath))
  const gitEntry = findGitEntry(fileDir)
  if (!gitEntry) process.exit(0) // not inside any git checkout — nothing to guard

  let isPrimaryCheckout = false
  try {
    isPrimaryCheckout = fs.statSync(gitEntry).isDirectory()
  } catch {
    isPrimaryCheckout = false
  }
  if (!isPrimaryCheckout) process.exit(0) // .git is a file here — this IS a worktree, allow

  const repoRoot = path.dirname(gitEntry)
  const repoName = path.basename(repoRoot)
  const reason =
    `Refusing to edit in the primary ${repoName} checkout (${repoRoot}). ` +
    `Create an isolated worktree first: git worktree add ../${repoName}-<slug> -b claude/<slug>, ` +
    'then redo this edit there.'

  console.log(JSON.stringify({
    systemMessage: reason,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }))
  process.exit(0)
})
