#!/usr/bin/env node
// Finds running `vite` dev/preview server processes started from a worktree
// of this repo, and classifies each as stale (worktree deleted, or its
// branch already merged into origin/main) or active (worktree exists, branch
// still has unmerged work). Read-only — this script only reports, it never
// kills anything; `.claude/skills/clean-dev-servers/SKILL.md` is the
// interactive on-demand cleanup that acts on the report.
//
// Windows shells out to PowerShell; macOS and Linux use `ps` and `lsof`.
// Both paths need OS process/port introspection, which has no cross-platform
// Node equivalent without a native dependency.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const isWindows = process.platform === 'win32'
if (!isWindows && process.platform !== 'darwin' && process.platform !== 'linux') {
  console.log(`dev-servers: not implemented for ${process.platform}, skipping.`)
  process.exit(0)
}

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

// A vite server is spawned either through the `.bin/vite` shim or directly as
// `vite/bin/vite.js`. Match both, on either path separator.
const VITE_ENTRY = /node_modules[\\/](?:\.bin[\\/]vite|vite[\\/]bin[\\/]vite\.js)/

function findViteProcesses() {
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

function findListenPorts() {
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

function worktreeRootFromCommandLine(commandLine) {
  const pattern = isWindows
    ? /([A-Za-z]:[\\/][^"]*?)[\\/]node_modules[\\/]/
    : /(\/[^\s"]*?)\/node_modules\//
  const m = commandLine.match(pattern)
  return m ? m[1] : null
}

function branchStatus(root) {
  const git = (args) =>
    execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim()
  try {
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
    let defaultBranch = 'main'
    try {
      defaultBranch = git(['rev-parse', '--abbrev-ref', 'origin/HEAD']).replace('origin/', '')
    } catch {
      // fall back to 'main'
    }
    try {
      git(['merge-base', '--is-ancestor', 'HEAD', `origin/${defaultBranch}`])
      return { branch, status: `merged into origin/${defaultBranch}` }
    } catch {
      return { branch, status: 'active (unmerged work)' }
    }
  } catch {
    return { branch: '?', status: 'unknown (not a git checkout?)' }
  }
}

const viteProcs = findViteProcesses()
if (viteProcs.length === 0) {
  console.log('dev-servers: none running.')
  process.exit(0)
}

const ports = findListenPorts()
const portByPid = new Map(ports.map((p) => [Number(p.OwningProcess), p.LocalPort]))

const rows = viteProcs.map((p) => {
  const root = worktreeRootFromCommandLine(p.CommandLine)
  const port = portByPid.get(Number(p.ProcessId)) ?? '?'
  if (!root) return { pid: p.ProcessId, port, root: '?', branch: '?', status: 'unknown' }
  if (!existsSync(root)) {
    return { pid: p.ProcessId, port, root, branch: '?', status: 'orphaned (worktree deleted)' }
  }
  const { branch, status } = branchStatus(root)
  return { pid: p.ProcessId, port, root, branch, status }
})

console.log('dev-servers: found', rows.length, 'running vite process(es):')
for (const r of rows) {
  console.log(`  PID ${r.pid}  port ${r.port}  ${r.root}  [${r.branch}]  — ${r.status}`)
}

const stale = rows.filter((r) => r.status.startsWith('merged') || r.status.startsWith('orphaned'))
if (stale.length > 0) {
  console.log(
    `dev-servers: ${stale.length} look stale (merged or orphaned). ` +
      'Run the /clean-dev-servers skill to review and kill them.',
  )
}
