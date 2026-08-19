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
  'src/styles/05-masthead-nav.css': 700, // 697 — current player-page masthead and level-progression rules after CareerTimeline moved to 05a
  'src/styles/06-loader-and-cards.css': 900, // 850
  'src/styles/08-site-shell.css': 900, // 1000 -> 898: the footer's flat link-list rules left for 08a-site-menu.css, which holds the shared site-directory language the sheet, the footer and /more all read
  'src/styles/09-team-info.css': 800, // 700 -> 716: the innings view's lineup masthead (.lineupteam__name) joined the header-theme system (EnteringReference.jsx), the same `.is-themed`/`--bar-fill` triad .halfdefense__title already wore — one more selector in the same family, not a new one. 687 — the Ballpark card moved out to 57-ballpark-card.css
  'src/styles/10-lineup.css': 800, // 797
  'src/styles/12-sealbox.css': 1700, // 1639 — unified focus/stacked layout: dropped the unfocused page's .prehalf, .half__entering/.halfentering, .innings__reference/.innings__ref-*, .innings__rosters, and .innings__row2 rules
  'src/styles/14-strike-zone.css': 1000, // 909 — both pitch-colour keys left (PitchColorsKey's button/modal and StrikeZoneLegend's swatch row); the pitch list names each dot beside it
  'src/styles/15-team-color-lab.css': 700, // 691
  'src/styles/17-identity-lab-workbench.css': 1300, // 1229 — stamp-ink rules
  'src/styles/20-charts.css': 700, // 684
  'src/styles/21-box-score.css': 800, // 771 — the Three Stars card split out to 21a-box-score-stars.css,
  //                                    the by-inning tally to 21b-box-score-tally.css
  'src/styles/22-box-score-tables.css': 800, // 789
  'src/styles/23-box-score-detail.css': 800, // 637 -> 721: the team hub's leader ledger (.tledg), which lands here beside the .tlead card board it renders instead of. It cannot be its own partial: src/styles is AT its directory budget (check-dir-size.mjs), the same squeeze 68-around-the-game.css records. Paid for in part by deleting the horizontal deck, its header-actions row and two dead .ilmark sizings.
  'src/styles/26-player-page.css': 1200, // 1125 — the Trophy Case split out to 67-trophy-case.css
  'src/styles/27-player-position-innings.css': 700, // 636 — "Pitches like" / "Hits like" moved to 51-similar-players.css
  'src/styles/28-team-hub.css': 900, // 859 — the identity hero split out to 28a-team-hub-hero.css
  'src/styles/29-team-transactions.css': 900, // 844
  'src/styles/31-wild-card.css': 1100, // 1088
  'src/styles/35-postseason-series.css': 700, // 693
  'src/styles/42-first-scorebook.css': 900, // 854
  'src/styles/43-foul-tracker.css': 900, // 877
  // 1000 -> 1100 was CoverColorPicker.jsx's rules (ADR-0036's shelf). That
  // component is gone — BookCoverPicker.jsx replaced it, and its rules live in
  // 58-logbook-shelf.css beside the rest of the book-management UI — so what is
  // left here is PassportBook/PassportPage/PassportCover's own art, including
  // the three league-mark board colours.
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
  'src/styles/68-around-the-game.css': 1000, // 642 -> 954: the doubleheader report's year slider (.yrange, two stacked native range inputs), its board cells and its year drawer. The sixth partial this would otherwise be cannot exist: src/styles is AT its directory budget (check-dir-size.mjs), which is the reason this package keeps one sheet for all five of its pages in the first place.
  // The directory-budget table itself. Every entry in it carries an inline
  // rationale BY DESIGN — that is the whole convention, and it means the file
  // grows a few lines on any commit that adds a deliberate exception. It was
  // trimmed back under the cap once already (c1b9043b) and immediately went
  // over again on the next such commit, which is the signal that the cap is
  // the wrong instrument for a documented lookup table. The thing worth
  // watching here is the BUDGET NUMBERS, and check-dir-size.mjs watches those
  // itself.
  // 600 -> 620 for the `?d=` calendar-validity guard. route.js had been held at
  // EXACTLY 600 for several commits, which is why this is written down rather
  // than quietly absorbed: the guard is a bug fix, not a feature, and the nine
  // lines are the reason it exists — an unparseable date threw out of
  // dayBefore() and took the team hub, /player, /leaders and
  // /situational-records down in three different ways. A one-line guard with no
  // explanation in a file where every other branch is explained would be the
  // thing a later reader deletes.
  'src/lib/route.js': 620, // 614
  'scripts/check-dir-size.mjs': 700, // 608
  'src/api/whatsBrewing.js': 1600, // 1581
  // 1500 -> 1600 for the veloVariety/centuryClub/veloPeak join (docs/callouts.md):
  // +9 lines to attach gen-pitch-arsenal.mjs's century-pitch sweep
  // (scripts/lib/century-club.mjs) onto starterRecords per pitcher/level. The
  // query/row-shaping itself already lives in that lib module, not here.
  'scripts/gen-callouts.mjs': 1600, // 1507
  'src/screens/identity-lab/profiles/mlb.jsx': 1500, // 1470
  'src/screens/TeamInfo.jsx': 1300, // 1299
  'src/screens/BoxScore.jsx': 1300, // 1203 — the hit chart's 3-line mount; the card itself is screens/boxscore/HitChartCard.jsx
  'src/screens/FoulTrackerPage.jsx': 1200, // 1168
  // 1200 -> 1225 for the runtime logo-override hooks (ADR-0050's logo
  // dimension): the store/reader themselves went to their own module
  // (src/lib/identity/logoUrlOverrides.js), but the two consult points must
  // live here — teamLogoUrl's, ahead of the *_USES_BASE_LOGO early returns
  // that would shadow it, and mainOverrideLogoUrl's, which is what routes
  // Main's tile through 'main-recolor'.
  'src/lib/teams.js': 1225, // 1212
  'src/lib/route.js': 700, // 602 — one more parse branch and path doc line for '/postseason-race'
  'scripts/gen-fouls.mjs': 1000, // 996
  'src/api/teamTransactions.js': 1000, // 961
  'src/screens/InningViewer.jsx': 1000, // 931 — unified focus/stacked layout: dropped the unfocused ReferenceBand/ScorebugMount-dock branches and the pastLine/cornerIdx state that only served them
  'src/api/boxscore.js': 800, // 762 — the info block moved to boxscore/gameNotes.js
  // 900 -> 1000: phase 4 of the My Tally program added the two-step intro's
  // wiring, the merge-receipt slate strip, and the scores-unlocked-local
  // contextual prompt (all PRD §6.1/§6.2). GameSelect is already the one
  // screen that legitimately owns first-visit and slate-level onboarding
  // hooks — splitting three small pieces of state out would scatter the
  // slate's own logic rather than shrink it.
  'src/screens/GameSelect.jsx': 1000, // 924
  // 800 -> 900: selectFinalHalfIndex — the cloud scorebook index's
  // auto-drop-once-fully-revealed check needs the SAME structural, isFinal-
  // gated reasoning selectSkippedBottomHalf right above it already has, so it
  // belongs beside that function rather than in a new file duplicating it.
  'src/api/select.js': 900, // 819
  // computeHalfInningFeed's own state machinery (pinch-runner aliasing,
  // per-batter trip tracking, the visible-step gate) is tightly coupled and
  // deliberately not decomposed further when playbyplay.js was split
  // (ADR-0038) — see src/api/playbyplay/halfInningFeed.js's header.
  // 800 -> 900: wiring uncoveredRunnerNotes (runnerNotes.js, a new file) into
  // the per-play loop — a coveredRunnerEvents Set plus one call, the sentence
  // building itself lives in the new module, not here.
  'src/api/playbyplay/halfInningFeed.js': 900, // 807
  // 800 -> 830 for the Career register's MLB-only pill: three lines of filter
  // state in CareerRegister, the .mastheadpill button in its SectionTitle, and
  // an `aside` slot on that local SectionTitle. No logic worth its own module.
  'src/screens/PlayerPage.jsx': 830, // 817 — Prospect Card remains, duplicate trendBySportId progression wiring removed
  // 700 -> 750 for Focus Mode's matchup header: threading pitchingTeamId and
  // a focusHeader flag into AtBatCard, plus the buildTrailItems import for
  // the at-bat trail. The header itself (AtBatHero.jsx), the trail's
  // item-building logic and the stepped-so-far R/H tally (both entriesView.js)
  // were all pulled out to keep this growth to wiring only — see those files'
  // own headers.
  // 750 -> 700 as the ratchet asks: the notification-card family (EventNote,
  // MoundVisitBar, EjectionBar, EventCard, BaserunningNote and the two
  // shorthand lookups they are captioned from) moved to EventCards.jsx when
  // the scoring loop's beat (ADR-0046) pushed this file past its budget. Those
  // five were the part of this file with no reveal reasoning in them at all,
  // which is what made them the right thing to lift out; the markup, classes
  // and comments moved verbatim.
  'src/components/playbyplay/PlayByPlay.jsx': 700, // 607
  'src/api/loadPlayer.js': 800, // 722 — +1 band: fetching prospect-trend and assembling the Prospect Card's view model
  'src/api/tradeDeadline.js': 700, // 629
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
