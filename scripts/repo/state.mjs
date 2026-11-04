// Generator working state lives in a separate private repo (#2886):
// gzilavyss2025/bbsbh-state holds scripts/data/*.sql and
// scripts/data/callouts-archive/ at the same relative paths. The app never
// reads them. Keeping them out of this repo spares every clone ~215 MB.
//
//   node scripts/repo/state.mjs pull   clone or update .state/, then copy it into scripts/data/
//   node scripts/repo/state.mjs push   copy scripts/data/'s state files into .state/, commit, push
//
// `npm run state:pull` before running a generator by hand or `npm run test:state`.
// The nightly checks .state/ out with GH_BOT_TOKEN, pulls, and pushes before it
// commits here, so this repo never points at state the state repo doesn't have.
// .gitignore lists the same two patterns as isState() below; keep them together.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const dataDir = join(root, 'scripts', 'data')
const stateDir = join(root, '.state')
const url = process.env.STATE_REPO_URL ?? 'https://github.com/gzilavyss2025/bbsbh-state'

// A top-level dump, or anything in the call-out archive.
const isState = (rel) => (!rel.includes('/') && rel.endsWith('.sql')) || rel.startsWith('callouts-archive/')

const git = (...args) => execFileSync('git', ['-C', stateDir, ...args], { stdio: 'inherit' })

function list(dir, prefix = '') {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === '.git') return []
    const rel = prefix + e.name
    return e.isDirectory() ? list(join(dir, e.name), `${rel}/`) : [rel]
  })
}

// Make `to` hold exactly the state files of `from`.
function mirror(from, to) {
  const want = new Set(list(from).filter(isState))
  for (const rel of list(to).filter(isState)) if (!want.has(rel)) rmSync(join(to, rel))
  for (const rel of want) {
    mkdirSync(dirname(join(to, rel)), { recursive: true })
    cpSync(join(from, rel), join(to, rel))
  }
  return want.size
}

const cmd = process.argv[2]
if (cmd === 'pull') {
  if (existsSync(join(stateDir, '.git'))) git('pull', '--ff-only', '--quiet')
  else execFileSync('git', ['clone', '--depth', '1', '--quiet', url, stateDir], { stdio: 'inherit' })
  console.log(`state: ${mirror(stateDir, dataDir)} files copied into scripts/data/`)
} else if (cmd === 'push') {
  if (!existsSync(join(stateDir, '.git'))) throw new Error('no .state/ checkout: run `node scripts/repo/state.mjs pull` first')
  const n = mirror(dataDir, stateDir)
  if (n === 0) throw new Error('scripts/data/ holds no state files: refusing to push an empty state repo')
  git('add', '-A')
  try {
    execFileSync('git', ['-C', stateDir, 'diff', '--cached', '--quiet'])
    console.log('state: no changes')
  } catch {
    git('commit', '--quiet', '-m', `Update generator state${process.env.GITHUB_RUN_ID ? ` (run ${process.env.GITHUB_RUN_ID})` : ''}`)
    // Only the nightly writes here, so a rejected push is a second run in flight: rebase and retry.
    for (let i = 1; ; i++) {
      try {
        git('push', '--quiet')
        break
      } catch (err) {
        if (i === 3) throw err
        git('pull', '--rebase', '--quiet')
      }
    }
  }
} else {
  console.error('usage: node scripts/repo/state.mjs pull|push')
  process.exit(1)
}
