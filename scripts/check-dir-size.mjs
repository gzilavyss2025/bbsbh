#!/usr/bin/env node
// Guards the "flat directories don't stay flat" rule in CLAUDE.md — the one
// convention in this repo that was written down, agreed, and then broken by an
// order of magnitude.
//
// The rule says to propose subdirectories before roughly the tenth file in a
// directory. src/components reached 126. src/api reached 84. Nothing caught it,
// because unlike the ALL-CAPS invariant or the CLAUDE.md line cap, this rule had
// no script behind it — and in this repo every convention with a guard held,
// while every convention that was only prose drifted. That is the whole argument
// for this file (ADR-0038).
//
// It is a RATCHET, not a cap: the directories that are already over the line
// carry a budget pinned at today's count, and a budget may only ever be edited
// DOWNWARD. Three ways to fail:
//
//   1. An unbudgeted directory exceeds MAX_FILES — subdivide it, or add a
//      budget deliberately and say why in the PR.
//   2. A budgeted directory GREW past its budget — the ratchet's main job.
//   3. A budgeted directory SHRANK below its budget, or no longer exists — the
//      budget is stale. Tighten it in the same commit that did the cleanup, so
//      progress is recorded and the number never quietly stops meaning anything.
//
// (3) is deliberate and is what makes this a ratchet rather than a high-water
// mark that rots. The failure message prints the exact number to paste.
//
// A NOTE ON MERGE ORDER, learned the hard way. These numbers are measured
// against the tree the branch was cut from, so a branch that sits behind `main`
// while other work lands will carry stale ones — and if it merges last, it turns
// `main` red for something no PR author did wrong. That is exactly how this
// guard broke `main` on the day it landed. REBASE ONTO `main` AND RE-MEASURE
// BEFORE MERGING anything that touches BUDGETS. Unlike its file-length sibling,
// this guard cannot absorb the problem with a tolerance band: a directory gaining
// one file IS the thing being watched for, so there is no slack to give.
//
// Run by `npm run lint` (so it gates every push).
//
// HISTORY of every budget move is in `git log -p -- scripts/check-dir-size.mjs`.
// The table below holds only WHY an entry is an exception, not its changelog.

import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ROOT, toPosix, walkDirs } from './lib/walk.mjs'

// Roots to walk. Every directory beneath these is checked, counting only the
// source files sitting DIRECTLY in it (subdirectories are their own entry).
const ROOTS = ['src', 'api', 'scripts']
const SOURCE_EXT = ['.js', '.jsx', '.mjs', '.css']
const MAX_FILES = 12

// Directories already over the line, pinned at their measured count. Edit these
// DOWNWARD as work lands; never upward. A new entry here is a deliberate
// decision that belongs in a PR description, not a reflex to make lint green.
const BUDGETS = {
  // A FILE IN `api/` IS A URL: `api/copy.js` IS `/api/copy`. Subdividing it
  // renames a live endpoint, and the rename is silent — the old path 404s and
  // every client falls back to its "not configured" degrade, the class of outage
  // the KV_* episode was (api/_lib/redis.js). So the endpoints stay flat; this is
  // a deliberate exception, not a directory awaiting subdivision.
  api: 13,
  // The stylesheet partials src/index.css @imports in order. The files are an
  // ORDERED SEQUENCE, not independent modules, and the numeric prefix is what
  // makes the @import list and the cascade readable. Nesting them would break
  // that ordering for no gain. Growing this count is what "put new code
  // elsewhere" MEANS in a directory that can't nest, so it will keep climbing.
  // See ADR-0038.
  'src/styles': 112,
  // Static-file readers over nightly precomputes (targetCommand, gloveTarget,
  // milbPool (ADR-0080), notebook, ...) sit flat beside the siblings they are read with and
  // written to match; every module the player page's Analytics tab loads is here
  // together. catcherOfRecord.js sits BESIDE defense.js, whose chain it asks a
  // narrower question of and whose spoiler gate it inherits whole.
  'src/api': 115, // +clubDefenseRunning.js (#2316): the contract names this path
  // awards.js, split out of transactions.js. Same "nothing here fetches"
  // convention and person-shaping job as its siblings; a subdirectory for one
  // module would hide it from check-spoiler-manifest's flat classification.
  'src/api/person': 13,
  // Flat lint guards (check-*.mjs) and hand-run or nightly generators (gen-*.mjs).
  // package.json and the docs name them by path (docs/scripts/generators.md).
  // Each generator's pure half lives in scripts/lib/ (ADR-0100, ADR-0111 for the
  // open-data and pitch-start generators), so the script itself stays a thin runner.
  scripts: 138, // +gen-hof-pace.mjs (#1857; package.json and the docs name it by path), +gen-league-pennants.mjs (team and player pennants), +gen-season-checkpoints.mjs (#1855), +gen-umpire-history.mjs (#1565), +gen-club-defense-running.mjs (#2316), +gen-world-series.mjs and gen-world-series-events.mjs (#2235): the contract names these paths; +gen-where-from-map.mjs and gen-where-from.mjs (#1526)
  'src/lib': 53,
  // Testable helpers the generators import (scripts/CLAUDE.md's convention,
  // lib/roster.mjs is the worked example). They run nothing on import and share
  // code between generators, so inlining them would copy it into each one.
  'scripts/lib': 42,
  'src/screens': 41,
  'src/hooks': 26,
  'src/screens/identity-lab': 15,
  // One file per diary finding. A research diary is append-only
  // (docs/agents/research-diary.md, docs/agents/contender-diary.md), so these
  // counts only grow; a `corrected` entry sits ABOVE the one it corrects.
  'src/lib/research/diary': 13,
  'src/lib/research/contenderDiary': 14,
}

const walk = (dir) => walkDirs(join(ROOT, dir)).map((d) => toPosix(relative(ROOT, d)))

function countSources(dir) {
  return readdirSync(join(ROOT, dir)).filter((entry) => {
    if (!SOURCE_EXT.some((ext) => entry.endsWith(ext))) return false
    return statSync(join(ROOT, dir, entry)).isFile()
  }).length
}

const problems = []
const counts = new Map()

for (const root of ROOTS) {
  for (const dir of walk(root)) counts.set(dir, countSources(dir))
}

// 1 + 2: over the line.
for (const [dir, n] of [...counts].sort()) {
  const budget = BUDGETS[dir]
  if (budget == null) {
    if (n > MAX_FILES) {
      problems.push(
        `${dir} holds ${n} source files (max ${MAX_FILES}). Subdivide it — see the ` +
          `"Flat directories don't stay flat" rule in CLAUDE.md.`,
      )
    }
  } else if (n > budget) {
    problems.push(
      `${dir} grew to ${n} source files, past its budget of ${budget}. This ` +
        `directory is already over ${MAX_FILES} — put the new file in a ` +
        `subdirectory, or, if it genuinely belongs here, raise the entry to ${n} ` +
        `and say why in the PR.`,
    )
  }
}

// 3: stale budgets.
for (const [dir, budget] of Object.entries(BUDGETS)) {
  const n = counts.get(dir)
  if (n == null) {
    problems.push(`${dir} has a budget of ${budget} in this guard but no longer exists — drop the entry.`)
  } else if (n <= MAX_FILES) {
    // Back under the cap, so it no longer needs an exception at all. This case
    // MUST come before the tighten-it branch below: without it, the guard would
    // hand you a sub-cap number to pin (say 11), and the directory would then be
    // held to a stricter limit than the CLAUDE.md rule this script enforces —
    // a legal 12th file failing with "already over 12", which is false. Same
    // surrender-the-entry rule as check-file-size.mjs.
    problems.push(
      `${dir} is down to ${n} source files, back under the ${MAX_FILES}-file cap. ` +
        `Drop its BUDGETS entry in this commit so the exception table keeps shrinking.`,
    )
  } else if (n < budget) {
    problems.push(
      `${dir} is down to ${n} source files but its budget still says ${budget}. ` +
        `Tighten it to ${n} in this commit — the ratchet only counts if it moves.`,
    )
  }
}

if (problems.length) {
  console.error(
    '\n✗ Directory-size guard failed. A directory nobody can hold in their head\n' +
      '  is where conventions go to die — this is the guard that stops\n' +
      '  src/components reaching 126 files a second time (ADR-0038). Problems:\n',
  )
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\n  Fix by subdividing, or — if a directory genuinely belongs flat — edit\n' +
      '  BUDGETS in this script deliberately and say why in the PR.\n',
  )
  process.exit(1)
}

// Name the worst offender rather than hardcoding a directory that this guard's
// own third assertion is designed to eventually remove from the table.
const entries = Object.entries(BUDGETS)
const worst = entries.sort((a, b) => b[1] - a[1])[0]
console.log(
  `✓ Directory sizes hold — ${counts.size} directories under ${MAX_FILES} files, ` +
    `${entries.length} on a shrinking budget${worst ? ` (largest: ${worst[0]} ${worst[1]})` : ''}.`,
)
