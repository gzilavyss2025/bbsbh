#!/usr/bin/env node
// Finds running `vite` dev/preview server processes started from a worktree
// of this repo, and classifies each as stale (worktree deleted, or its branch
// already finished) or active (worktree exists, branch still has unmerged
// work). Read-only — this script only reports, it never kills anything;
// `.claude/skills/clean-dev-servers/SKILL.md` is the interactive on-demand
// cleanup that acts on the report.
//
// The verdict comes from scripts/worktrees.mjs's classifier rather than from a
// local check, so the two reports cannot disagree. They used to. This file once
// asked only "is HEAD an ancestor of origin/main", which a squash-merged branch
// fails — its commits never enter main verbatim, so the ancestry check reports
// "unmerged" for the single most common finished state. On 2026-09-15
// /start-day therefore read "upstream branch deleted (PR merged or closed)"
// from worktrees.mjs and "active (unmerged work)" from here, for the same four
// branches. Followed literally, that removes four worktrees and leaves their
// servers running on the folders it just removed.
//
// Windows shells out to PowerShell; macOS and Linux use `ps` and `lsof`.
// Both paths need OS process/port introspection, which has no cross-platform
// Node equivalent without a native dependency.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { classifyWorktree, gatherFacts } from './worktrees.mjs'

function powershellJson(script) {
  const out = execFileSync('powershell', ['-NoProfile', '-Command', script], {
    encoding: 'utf8',
  }).trim()
  if (!out) return []
  const parsed = JSON.parse(out)
  return Array.isArray(parsed) ? parsed : [parsed]
}

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch (err) {
    // `lsof` exits non-zero when it finds nothing; still take whatever it printed.
    return err.stdout ?? ''
  }
}

function tryGit(args, cwd) {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

// A vite server is spawned either through the `.bin/vite` shim or directly as
// `vite/bin/vite.js`. Match both, on either path separator.
const VITE_ENTRY = /node_modules[\\/](?:\.bin[\\/]vite|vite[\\/]bin[\\/]vite\.js)/

function findViteProcesses(isWindows) {
  if (isWindows) {
    return powershellJson(
      `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ` +
        `Where-Object { $_.CommandLine -match 'vite[\\\\/]bin[\\\\/]vite\\.js' } | ` +
        `Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress`,
    )
  }
  return run('ps', ['-Ao', 'pid=,command='])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(\d+)\s+(.*)$/)
      return m ? { ProcessId: Number(m[1]), CommandLine: m[2] } : null
    })
    .filter((p) => p && VITE_ENTRY.test(p.CommandLine))
}

function findListenPorts(isWindows) {
  if (isWindows) {
    return powershellJson(
      `Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ` +
        `Select-Object OwningProcess, LocalPort | ConvertTo-Json -Compress`,
    )
  }
  // `-F pn` prints one field per line: `p<pid>` then `n<address>` for each socket.
  const out = run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-F', 'pn'])
  const rows = []
  let pid = null
  for (const line of out.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1))
    else if (line.startsWith('n') && pid !== null) {
      const port = line.slice(1).split(':').pop()
      if (port) rows.push({ OwningProcess: pid, LocalPort: Number(port) })
    }
  }
  return rows
}

function worktreeRootFromCommandLine(commandLine, isWindows) {
  const pattern = isWindows
    ? /([A-Za-z]:[\\/][^"]*?)[\\/]node_modules[\\/]/
    : /(\/[^\s"]*?)\/node_modules\//
  const m = commandLine.match(pattern)
  return m ? m[1] : null
}

const norm = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

// `git worktree list --porcelain` puts the primary checkout in the first block,
// the same definition worktrees.mjs uses (`isPrimary: i === 0`). Match it here
// so a dev server running in the primary checkout is never mistaken for one
// running on a branch worktree.
function isPrimaryCheckout(root) {
  const primary = tryGit(['worktree', 'list', '--porcelain'], root)?.match(/^worktree (.+)$/m)?.[1]
  return primary != null && norm(primary) === norm(root)
}

function factsForRoot(root) {
  const head = tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], root)
  if (!head) return null
  return gatherFacts({
    root,
    branch: head === 'HEAD' ? null : head,
    isPrimary: isPrimaryCheckout(root),
  })
}

/**
 * Turns the two facts a running server adds — does its worktree still exist,
 * and what does the worktree classifier say about that worktree — into one
 * verdict. Exported so test/dev-servers.test.js can pin the squash-merge case
 * without needing a live process.
 *
 * @param {object} input
 * @param {boolean} input.rootExists  does the worktree folder still exist
 * @param {object|null} input.facts   gatherFacts() output, or null if not a checkout
 */
export function classifyDevServer({ rootExists, facts }) {
  if (!rootExists) return { branch: '?', status: 'orphaned (worktree deleted)', stale: true }
  if (!facts) return { branch: '?', status: 'unknown (not a git checkout?)', stale: false }
  const { status, stale } = classifyWorktree(facts)
  return { branch: facts.branch ?? 'detached', status, stale }
}

// Running as a script, not imported by the test.
if (process.argv[1] && process.argv[1].endsWith('dev-servers.mjs')) {
  const isWindows = process.platform === 'win32'
  if (!isWindows && process.platform !== 'darwin' && process.platform !== 'linux') {
    console.log(`dev-servers: not implemented for ${process.platform}, skipping.`)
    process.exit(0)
  }

  const viteProcs = findViteProcesses(isWindows)
  if (viteProcs.length === 0) {
    console.log('dev-servers: none running.')
    process.exit(0)
  }

  const portByPid = new Map(
    findListenPorts(isWindows).map((p) => [Number(p.OwningProcess), p.LocalPort]),
  )

  const rows = viteProcs.map((p) => {
    const root = worktreeRootFromCommandLine(p.CommandLine, isWindows)
    const port = portByPid.get(Number(p.ProcessId)) ?? '?'
    if (!root) {
      return { pid: p.ProcessId, port, root: '?', branch: '?', status: 'unknown', stale: false }
    }
    const rootExists = existsSync(root)
    const verdict = classifyDevServer({
      rootExists,
      facts: rootExists ? factsForRoot(root) : null,
    })
    return { pid: p.ProcessId, port, root, ...verdict }
  })

  console.log('dev-servers: found', rows.length, 'running vite process(es):')
  for (const r of rows) {
    console.log(`  PID ${r.pid}  port ${r.port}  ${r.root}  [${r.branch}]  — ${r.status}`)
  }

  const stale = rows.filter((r) => r.stale)
  if (stale.length > 0) {
    console.log(
      `dev-servers: ${stale.length} look stale (finished branch or deleted worktree). ` +
        'Run the /clean-dev-servers skill to review and kill them.',
    )
  }
}
