#!/usr/bin/env node
// Caps how long a single source file may get, so the next src/index.css — which
// reached 30,326 lines before it was split into src/styles/ — or the next
// src/api/person.js (2,706) is caught while it is still small enough to split
// cheaply. Companion to check-dir-size.mjs; both are ADR-0038.
//
// A file this long is a maintenance problem in three specific ways: an agent
// cannot hold it in context, two agents editing different parts of it still
// collide (26 of the last 50 commits touched index.css), and a rule that lives
// halfway down it is a rule nobody finds.
//
// MAX_LINES sits between p90 (411) and p99 (1,470) of this repo's 481 source
// files, so it flags the genuinely large ones without turning the budget table
// into a second copy of the file listing.
//
// WHY THE RATCHET IS WEAKER HERE THAN IN check-dir-size.mjs. That guard fails
// when a directory shrinks below its budget, forcing the number down; a
// directory's file count changes rarely, so that costs an edit almost never.
// Line counts change on nearly every commit, so the same rule would fail lint
// constantly and get deleted within a week. A budget here is therefore a
// CEILING: growth past it fails, shrinkage is free. Rot is bounded by the third
// assertion instead — once a file drops back under MAX_LINES it must give up
// its exception, so the table can only shrink over time.
//
// WHY THE CEILING IS A BAND AND NOT AN EXACT COUNT. The first version of this
// guard pinned each budget at the file's exact measured length, and that broke
// `main`: the numbers were measured against a base five PRs stale, and the
// moment those PRs landed — each having legitimately added a few dozen lines to
// person.js, loadPlayer.js, PlayerPage.jsx — lint went red on a branch nobody
// could see it coming from. Even with correct numbers it would have recurred,
// because in a repo where several agents merge concurrently, "this file grew by
// 30 lines" is a normal Tuesday, not a defect. A guard that fires on normal work
// is the one that gets deleted, which is the failure mode the note above already
// warned about.
//
// So a budget is the file's length rounded UP to the next BAND (100 lines).
// Routine growth inside the band is free; crossing it is a deliberate
// one-number edit that says "this file got meaningfully longer". A file that
// shrinks a full band below its budget must be tightened, so the table still
// only moves down. What is being defended is not any particular line count — it
// is the claim that nobody added a thousand lines to a file nobody was reading.
//
// Run by `npm run lint` (so it gates every push).

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const ROOTS = ['src', 'api', 'scripts']
const MAX_LINES = 600
// Budgets are rounded up to this granularity, so routine growth inside a band
// costs nothing and only a meaningful jump forces an edit. See the header.
const BAND = 100
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git'])
const SOURCE_EXT = ['.js', '.jsx', '.mjs', '.css']

// Files already over the line, each pinned at its length rounded up to the next
// BAND. A budget may only be edited DOWNWARD, or up by one band when a file
// genuinely crosses it. Adding an entry is a deliberate decision for a PR
// description — the default answer to "this file is too long" is to split it,
// not to widen the table. The trailing comment on each line is the measured
// length when it was last set, so a reader can see the headroom.
//
// src/index.css WAS the extreme case and the reason this guard exists, at 30,326
// lines. It is now 63 — a banner comment and 55 @import lines — and its entry
// here has been replaced by one per oversized partial, exactly as this comment
// used to instruct. That replacement is the point: it is what stopped 30,000
// lines evaporating into unrecorded 9,000-line pieces and being called an
// improvement. The 24 entries below are the stylesheet's remaining real debt,
// now itemised instead of hidden inside one number.
const BUDGETS = {
  'src/styles/02-wordmark-lab.css': 700, // 644
  'src/styles/05-masthead-nav.css': 700, // 683
  'src/styles/06-loader-and-cards.css': 900, // 850
  'src/styles/08-site-shell.css': 1100, // 1016
  'src/styles/09-team-info.css': 700, // 686
  'src/styles/10-lineup.css': 800, // 798
  'src/styles/12-sealbox.css': 1900, // 1810
  'src/styles/14-strike-zone.css': 1100, // 1027
  'src/styles/15-team-color-lab.css': 700, // 691
  'src/styles/17-identity-lab-workbench.css': 1200, // 1140
  'src/styles/20-charts.css': 700, // 684
  'src/styles/21-box-score.css': 1000, // 918
  'src/styles/22-box-score-tables.css': 800, // 789
  'src/styles/23-box-score-detail.css': 700, // 637
  'src/styles/26-player-page.css': 1400, // 1383
  'src/styles/27-player-position-innings.css': 800, // 706
  'src/styles/28-team-hub.css': 1000, // 984
  'src/styles/29-team-transactions.css': 900, // 844
  'src/styles/31-wild-card.css': 1100, // 1088
  'src/styles/35-postseason-series.css': 700, // 693
  'src/styles/42-first-scorebook.css': 900, // 854
  'src/styles/43-foul-tracker.css': 900, // 877
  'src/styles/44-pre-game-cards.css': 700, // 652
  'src/styles/49-passport-book.css': 1000, // 953
  'src/api/person.js': 2800, // 2706
  'src/api/callout-notes.js': 2100, // 2080
  'src/api/playbyplay.js': 1800, // 1784
  'src/api/whatsBrewing.js': 1600, // 1581
  'scripts/gen-callouts.mjs': 1500, // 1483
  'src/screens/identity-lab/profiles/mlb.jsx': 1500, // 1470
  'src/screens/TeamInfo.jsx': 1400, // 1342
  'src/screens/BoxScore.jsx': 1300, // 1216
  'src/screens/FoulTrackerPage.jsx': 1200, // 1168
  'src/lib/teams.js': 1100, // 1098
  'scripts/gen-fouls.mjs': 1000, // 996
  'src/api/teamTransactions.js': 1000, // 961
  'src/screens/InningViewer.jsx': 1000, // 912
  'src/api/boxscore.js': 900, // 859
  'src/screens/GameSelect.jsx': 900, // 854
  'src/api/select.js': 800, // 796
  'src/screens/PlayerPage.jsx': 800, // 772
  'src/components/playbyplay/PlayByPlay.jsx': 700, // 687
  'src/api/loadPlayer.js': 700, // 682
  'src/api/person-fetch.js': 700, // 644
  'src/api/tradeDeadline.js': 700, // 629
  'scripts/gen-former-teammates.mjs': 700, // 614
  'src/components/charts/WinProbChart.jsx': 700, // 612
}

function walk(dir, out = []) {
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (IGNORE_DIRS.has(entry)) continue
    const rel = `${dir}/${entry}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (SOURCE_EXT.some((ext) => entry.endsWith(ext))) out.push(rel)
  }
  return out
}

// Count the editor-visible lines: split on newlines and drop a single trailing
// empty, the same way check-claude-md.mjs does, so the two guards agree and the
// numbers in BUDGETS match what `wc -l` reports.
function lines(rel) {
  const parts = readFileSync(join(ROOT, rel), 'utf8').split('\n')
  if (parts.length && parts[parts.length - 1] === '') parts.pop()
  return parts.length
}

// A file's ceiling: its length rounded up to the next whole band.
const band = (n) => Math.ceil(n / BAND) * BAND

const problems = []
const measured = new Map()

for (const root of ROOTS) {
  for (const file of walk(root)) measured.set(file, lines(file))
}

// 1 + 2: over the line.
for (const [file, n] of [...measured].sort()) {
  const budget = BUDGETS[file]
  if (budget == null) {
    if (n > MAX_LINES) {
      problems.push(`${file} is ${n} lines (max ${MAX_LINES}). Split it, or add a budget deliberately.`)
    }
  } else if (n > budget) {
    problems.push(
      `${file} grew to ${n} lines, past its budget of ${budget}. This file is ` +
        `already over ${MAX_LINES} — prefer putting new code elsewhere. If the ` +
        `growth is genuinely warranted, raise the entry to ${band(n)}.`,
    )
  }
}

// 3: budgets that have outlived their purpose.
for (const [file, budget] of Object.entries(BUDGETS)) {
  const n = measured.get(file)
  if (n == null) {
    problems.push(`${file} has a budget of ${budget} in this guard but no longer exists — drop the entry.`)
  } else if (n <= MAX_LINES) {
    problems.push(
      `${file} is down to ${n} lines, back under the ${MAX_LINES}-line cap. Drop ` +
        `its BUDGETS entry in this commit so the exception table keeps shrinking.`,
    )
  } else if (budget - n >= BAND) {
    // Shrank a whole band below its ceiling — bank the progress. Deliberately a
    // FULL band, not a single line: the point of the band is that ordinary
    // edits, in either direction, cost nobody an edit to this file.
    problems.push(
      `${file} is down to ${n} lines but its budget still says ${budget}. ` +
        `Tighten it to ${band(n)} in this commit — the ratchet only counts if it moves.`,
    )
  }
}

if (problems.length) {
  console.error(
    '\n✗ File-size guard failed. A file too long to hold in context is one two\n' +
      '  agents cannot edit without colliding, and one whose rules nobody finds\n' +
      '  (ADR-0038). Problems:\n',
  )
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\n  Fix by splitting the file. Widening BUDGETS is the last resort, not the\n' +
      '  first — and it is never the fix for a file that just grew.\n',
  )
  process.exit(1)
}

// Name the worst offender rather than hardcoding a file this guard's own third
// assertion is designed to eventually remove from the table.
const budgeted = Object.entries(BUDGETS).sort((a, b) => b[1] - a[1])
const worst = budgeted[0]
console.log(
  `✓ File sizes hold — ${measured.size} source files under ${MAX_LINES} lines, ` +
    `${budgeted.length} on a ceiling${worst ? ` (largest: ${worst[0]} ${worst[1]})` : ''}.`,
)
