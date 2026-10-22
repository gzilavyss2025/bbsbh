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
//
// HISTORY of every budget move is in `git log -p -- scripts/check-file-size.mjs`.
// The trailing `// N` on an entry is the measured length when it was last set,
// not a reason; a reason, where one exists, is the comment block above it.

import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ROOT, toPosix, walk as walkFiles } from './lib/walk.mjs'


const ROOTS = ['src', 'api', 'scripts']
const MAX_LINES = 600
// Budgets are rounded up to this granularity, so routine growth inside a band
// costs nothing and only a meaningful jump forces an edit. See the header.
const BAND = 100
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
  // Every src/styles partial below is over the line for the same standing reason:
  // src/styles is AT its directory budget in check-dir-size.mjs (the partials are
  // an ordered @import sequence and cannot nest), so a new rule cannot go in a new
  // flat file. Split a sheet by moving a component's rules into a subdirectory
  // (src/styles/system/, focus/, report/) before you raise a number here.
  'src/styles/78-offseason.css': 1100, // 1082
  'src/styles/06-loader-and-cards.css': 800, // 900
  'src/styles/08-site-shell.css': 800, // 900
  'src/styles/12-sealbox.css': 1600, // 1536
  'src/styles/14-strike-zone.css': 900, // 898
  'src/styles/15-team-color-lab.css': 680, // 674
  'src/styles/17-identity-lab-workbench.css': 1196, // 1200
  'src/styles/21-box-score.css': 900, // 800
  'src/styles/31-wild-card.css': 1100, // 1092
  'src/styles/35-postseason-series.css': 700, // 658
  'src/styles/42-first-scorebook.css': 900, // 854
  'src/styles/43-foul-tracker.css': 900, // 877
  'src/styles/49-passport-book.css': 1100, // 1036
  // ONE sheet for the four pages in src/screens/around-the-game/, which is why it is
  // over the line: four partials would cost src/styles four directory slots
  // and would hit the shared-chunk ordering trap src/index.css's header
  // records. It briefly dropped back under 600 when the Rundown's grid was
  // deleted and the entry went with it, as the ratchet requires — this is a
  // deliberate re-entry, not a drift back. What put it over again is two
  // rules that had to be explained rather than merely written: the sticky
  // column's containing block (a bug this repo had already found, documented
  // and fixed once in 26-player-page.css, then reintroduced here) and the
  // caps-exempt method-note prose, whose `#root` prefix is the whole reason
  // it works. Both notes prevented a real regression. Trimming them to hit a
  // line count would be deleting the reason the rules are correct.
  'src/styles/69-hit-chart.css': 900, // 811 — the ball-flight card shares marks, heat ring and drawing with the chart: one partial, not two that can drift
  'src/styles/68-around-the-game.css': 1100, // 1200
  'src/api/whatsBrewing.js': 1600, // 1581
  'scripts/gen-callouts.mjs': 1700, // 1608
  'src/screens/identity-lab/profiles/mlb.jsx': 1500, // 1470
  // GameView is the game's ROUTER — one screen per section, each lazily
  // imported, plus the chrome every section shares — so a feature that adds a
  // door lands here by construction rather than by accretion. The catch-up
  // wiring (ADR-0055) is that: eleven lines, all of them routing. Splitting the
  // shared chrome out would move the section tabs into a 12th file in
  // src/components/chrome (at ITS own MAX_FILES) to save this one 45, which
  // trades a real limit for a nominal one.
  'src/screens/BoxScore.jsx': 900, // 824
  'src/lib/teams.js': 1240, // 1227
  'src/lib/route.js': 1000, // 970
  'scripts/gen-fouls.mjs': 1100, // 1057
  // The sweep gained a batter-side dimension: the side is read off the matchup,
  // it keys the type buckets, and the export folds the sides back into the one
  // pitch a card reads (emptyBucket/foldRow/ttoPairs). Splitting the file would
  // put the counting rules and the shape they are exported in on either side of
  // a module boundary, which is the one pair that has to be read together.
  'scripts/gen-pitch-arsenal.mjs': 661, // 661
  'src/api/teamTransactions.js': 700, // 619
  'src/screens/InningViewer.jsx': 1000, // 941
  'src/api/boxscore.js': 800, // 762
  'src/screens/GameSelect.jsx': 850, // 822
  // src/api/schedule.js was AT the 600-line ceiling, so the offseason gate's
  // one new reader tipped it. fetchSeasonMeta belongs here and nowhere else:
  // this module already owned the seasons endpoint (fetchAllStarInfo was a
  // narrow read of the same row, and now delegates to it), and the whole point
  // of the change is that one fetch answers both questions. A new src/api file
  // for a nine-line fetcher would cost that directory's budget to buy less.
  // The winter calendar (issue #1055) landed inside this budget, with one line
  // to spare: fetchWinterCalendar belongs in this module for the same reason
  // fetchSeasonMeta did — it is a schedule call, and the alternative was a new
  // src/api file for one fetcher, bought with that directory's budget.
  'src/api/schedule.js': 800, // 741
  'src/api/select.js': 800, // 770
  // computeHalfInningFeed's own state machinery (pinch-runner aliasing,
  // per-batter trip tracking, the visible-step gate) is tightly coupled and
  // deliberately not decomposed further when playbyplay.js was split
  // (ADR-0038) — see src/api/playbyplay/halfInningFeed.js's header.
  'src/api/playbyplay/halfInningFeed.js': 900, // 807
  // src/screens/PlayerPage.jsx surrendered its entry when /player became a hub
  // of four tab routes: it is now the Overview tab alone (226 lines), and the
  // rest of the old page lives in src/screens/player/ — one screen per tab, each
  // well under the cap. That is the outcome this guard's third assertion exists
  // to force, so the entry is gone rather than tightened.
  'src/components/playbyplay/PlayByPlay.jsx': 800, // 705
  'src/api/tradeDeadline.js': 700, // 629
  'src/App.jsx': 700, // 606
}

const walk = (dir) =>
  walkFiles(join(ROOT, dir), { exts: SOURCE_EXT }).map((f) => toPosix(relative(ROOT, f)))

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
