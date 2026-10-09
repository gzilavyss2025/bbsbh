#!/usr/bin/env node
// Delete remote branches that no longer carry live work.
//
// Cloud sessions cannot delete a remote branch (the proxy answers 403 and the GitHub
// MCP tools have no delete-branch call), so `/stack-prs` step 3 cannot do it there.
// This script runs in a GitHub Action (.github/workflows/prune-branches.yml) or by hand.
//
// A branch goes when it is not the default branch, not protected, old enough, and:
//   - it has no commit that the default branch lacks (merged), or
//   - every PR for it is closed (merged or not). The commits stay readable at
//     refs/pull/<n>/head, and GitHub keeps a "Restore branch" button.
// A branch stays when a PR for it is open, or when it has unique commits and no PR.
//
// Usage: node scripts/repo/prune-branches.mjs [--apply] [--repo owner/name] [--min-age-days N]
// Without --apply it only prints the plan. It needs the `gh` CLI, logged in.
import { execFileSync } from 'node:child_process'

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const value = (name, fallback) => {
  const i = argv.indexOf(name)
  return i === -1 ? fallback : argv[i + 1]
}

const apply = flag('--apply')
const minAgeDays = Number(value('--min-age-days', '2'))

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
const api = (path, ...extra) => gh('api', path, ...extra)

const repo =
  value('--repo', null) ??
  execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' })
    .trim()
    .replace(/^.*github\.com[:/]/, '')
    .replace(/\.git$/, '')
const owner = repo.split('/')[0]
const base = api(`repos/${repo}`, '--jq', '.default_branch')

const branches = JSON.parse(
  `[${api(`repos/${repo}/branches?per_page=100`, '--paginate', '--jq', '.[] | {name, protected}')
    .split('\n')
    .filter(Boolean)
    .join(',')}]`,
)

const keep = []
const drop = []

for (const { name, protected: isProtected } of branches) {
  if (name === base || isProtected) continue

  const tipDate = api(`repos/${repo}/commits/${name}`, '--jq', '.commit.committer.date')
  const ageDays = (Date.now() - Date.parse(tipDate)) / 86_400_000
  if (ageDays < minAgeDays) {
    keep.push([name, `newer than ${minAgeDays} days`])
    continue
  }

  const ahead = Number(api(`repos/${repo}/compare/${base}...${name}`, '--jq', '.ahead_by'))
  if (ahead === 0) {
    drop.push([name, 'merged: no commit missing from ' + base])
    continue
  }

  const states = api(
    `repos/${repo}/pulls?state=all&per_page=100&head=${encodeURIComponent(`${owner}:${name}`)}`,
    '--jq',
    '.[].state',
  )
    .split('\n')
    .filter(Boolean)
  if (states.includes('open')) keep.push([name, 'open PR'])
  else if (states.length) drop.push([name, `${states.length} PR, all closed`])
  else keep.push([name, `${ahead} unique commits and no PR`])
}

console.log(`${repo}: ${drop.length} to delete, ${keep.length} to keep (default branch: ${base})`)
for (const [name, why] of keep) console.log(`  keep    ${name}  (${why})`)
for (const [name, why] of drop) console.log(`  delete  ${name}  (${why})`)

if (!apply) {
  console.log('Dry run. Add --apply to delete.')
  process.exit(0)
}

let failed = 0
for (const [name] of drop) {
  try {
    api(`repos/${repo}/git/refs/heads/${name}`, '-X', 'DELETE')
  } catch (err) {
    failed++
    console.error(`  FAILED  ${name}: ${err.message.split('\n')[0]}`)
  }
}
console.log(`Deleted ${drop.length - failed} of ${drop.length}.`)
process.exit(failed ? 1 : 0)
