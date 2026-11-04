#!/usr/bin/env node
// Unstages, and restores to HEAD, every staged data file whose only change is a
// run stamp (scripts/nightly/stamp-only.mjs). The nightly commit step runs it after
// `git add`, so a night that changes no data commits nothing under public/ and
// starts no Vercel deploy (scripts/vercel-ignore-build.sh). In the offseason that
// was ~650 files a night, every night.
//
// Freshness is checked BEFORE this runs, on the working tree, where every
// generator's fresh stamp still is (check-data-freshness.mjs), so the guard keeps
// catching a generator that silently wrote nothing. Only modified files are
// considered: an added or deleted file is always a real change.
import { execFileSync } from 'node:child_process'
import { isStampOnlyChange } from './stamp-only.mjs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 30 })

const modified = git('diff', '--cached', '--name-only', '--diff-filter=M', '-z').split('\0').filter((f) => f.endsWith('.json'))
const dropped = modified.filter((f) => isStampOnlyChange(git('show', `HEAD:${f}`), git('show', `:${f}`)))

// In batches: one restore per file would be ~650 git processes.
for (let i = 0; i < dropped.length; i += 200) git('restore', '--staged', '--worktree', '--', ...dropped.slice(i, i + 200))

console.log(`stamp-only: dropped ${dropped.length} of ${modified.length} modified JSON files`)
