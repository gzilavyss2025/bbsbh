#!/usr/bin/env node
// Finds running `vite` dev/preview server processes started from a worktree
// of this repo, and classifies each as stale (worktree deleted, or its
// branch already merged into origin/main) or active (worktree exists, branch
// still has unmerged work). Read-only — this script only reports, it never
// kills anything; `.claude/skills/clean-dev-servers.md` is the interactive
// on-demand cleanup that acts on the report.
//
// Windows-only (this repo's dev machine): shells out to PowerShell for
// process/port introspection, which has no cross-platform Node equivalent
// without a native dependency.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

if (process.platform !== 'win32') {
  console.log('dev-servers: only implemented for Windows, skipping.')
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

function findViteProcesses() {
  return powershellJson(
    `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ` +
      `Where-Object { $_.CommandLine -match 'vite[\\\\/]bin[\\\\/]vite\\.js' } | ` +
      `Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress`,
  )
}

function findListenPorts() {
  return powershellJson(
    `Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ` +
      `Select-Object OwningProcess, LocalPort | ConvertTo-Json -Compress`,
  )
}

function worktreeRootFromCommandLine(commandLine) {
  const m = commandLine.match(/([A-Za-z]:[\\/][^"]*?)[\\/]node_modules[\\/]/)
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
const portByPid = new Map(ports.map((p) => [p.OwningProcess, p.LocalPort]))

const rows = viteProcs.map((p) => {
  const root = worktreeRootFromCommandLine(p.CommandLine)
  const port = portByPid.get(p.ProcessId) ?? '?'
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
