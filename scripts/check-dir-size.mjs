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

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

// Roots to walk. Every directory beneath these is checked, counting only the
// source files sitting DIRECTLY in it (subdirectories are their own entry).
const ROOTS = ['src', 'api', 'scripts']
const SOURCE_EXT = ['.js', '.jsx', '.mjs', '.css']
const MAX_FILES = 12

// Directories already over the line, pinned at their measured count. Edit these
// DOWNWARD as work lands; never upward. A new entry here is a deliberate
// decision that belongs in a PR description, not a reflex to make lint green.
const BUDGETS = {
  // The 51 stylesheet partials src/index.css @imports in order. This one is a
  // deliberate exception rather than a directory awaiting subdivision: the files
  // are an ORDERED SEQUENCE, not independent modules, and the numeric prefix is
  // what makes the @import list and the cascade readable. Nesting them would
  // break that ordering for no gain. See ADR-0038.
  //
  // 50 -> 51 for `51-similar-players.css`: the player page's "Pitches like" /
  // "Hits like" card, moved out of 27-player-position-innings.css when that
  // file hit its own size budget. Its alternatives were both worse — leaving
  // it in a file the file-size guard had already flagged, or nesting it and
  // breaking the ordering this exception exists to protect. Growing this count
  // is what "put new code elsewhere" MEANS in a directory that can't nest, so
  // the number will keep climbing; that is the design, not a leak.
  // 51 -> 52 for `11-pregame-scoreboard.css`: the pregame Innings board's
  // first-pitch countdown, sharing the `11-` prefix with `11-innings.css`
  // (the two are siblings, not a renumbering) rather than appending at the
  // cascade's end — same "new reusable component earns a partial" reasoning
  // as the entry above, just inserted next to the file it extends.
  // 52 -> 53 for `52-highlight-clip-card.css`: HighlightClipCard.jsx's rules,
  // shared by TeamHighlightsRail and PlayerHighlightsRail (both cascade
  // issues 03/04) — same reasoning as the entry above, appended at the end.
  //
  // 53 -> 55 for `54-my-tally.css` + `55-my-tally-account.css`: /profile's own
  // rules, imported after the logbook/passport partials because they borrow
  // those motifs (the stamp roundel, the kraft seal). TWO partials rather than
  // one because a single file crossed check-file-size.mjs's 600-line ceiling —
  // split by subject (54 is the page a signed-out visitor sees in full, 55 is
  // the part that only means anything once an account exists), which is what
  // "put new code elsewhere" MEANS in a directory that cannot nest. Numbered
  // 54/55 rather than 52/53 because `52-highlight-clip-card.css` claimed that
  // slot first (both landed the same day, written in parallel).
  //
  // 55 -> 56 for `56-my-tally-intro.css`: the two-step first-visit intro's own
  // rules (phase 4). Its own partial rather than growing 08-site-shell.css
  // (already near ITS OWN budget) or either My Tally partial (a different
  // subject — onboarding chrome, not the settings page), same "one new file,
  // one new number" rule as the entry above.
  //
  // 56 -> 57 for `53-umpire-tendencies.css`, and the reason is the same one
  // the two entries above give: this directory is a NUMBERED CASCADE, the
  // prefix IS the cascade position ("order is the contract", src/CLAUDE.md),
  // so the guard's usual remedy of a subdirectory would break the single
  // property the whole scheme rests on. The file exists because the Umpire
  // Tendencies card pushed 38-umpire-pages.css past check-file-size.mjs's
  // 600-line ceiling, and THAT guard's remedy is to split rather than raise —
  // so a split has to cost a number here. It took the free 53 slot (nothing
  // has ever claimed it) rather than renumbering all nineteen partials after
  // 38; it introduces a fresh `.umptend__*` namespace and overrides nothing,
  // so its exact position is not load-bearing, only its being after 14
  // (.zonemap) and 44 (.metricbar), which it reuses.
  //
  // 57 -> 58 for `21a-box-score-stars.css`: the box score's Three Stars card
  // pushed 21-box-score.css past check-file-size.mjs's 1000-line budget once
  // it grew a horizontal-row wide-breakpoint layout. `21a` rather than
  // appending at the end so the numeric prefix still tells the ordering
  // truth — it cascades immediately after the file it was split out of, not
  // wherever the next free integer happened to be.
  //
  // 58 -> 59 for `48-stamp-strip.css`, for the same reason and by the same
  // remedy: redesigning the Game Log's mint affordance into a strip across the
  // head of the box score pushed 48-logbook.css past that same 600-line
  // ceiling, and that guard's fix is to split, not to raise. It takes a
  // DUPLICATE 48 (precedent: 11-innings / 11-pregame-scoreboard) rather than
  // renumbering the eight partials after it, since the cascade contract is
  // ORDER, not unique numbers — and here the order is load-bearing: it has to
  // land after 48-logbook.css, which sizes and inks the `.gamestamp` it frames.
  // 59 -> 60 for `26a-percentile-strip.css`, for the third time by the same
  // remedy: replacing the Statcast radar with the percentile strip (ADR-0040)
  // pushed 26-player-page.css past its own file-size budget, and that guard's
  // fix is to split, not to raise. A lettered sibling (precedent: the 21/21a
  // and 48/48 pairs above) rather than renumbering the partials after it,
  // since the cascade contract is ORDER, not unique numbers — and the order
  // matters here: it has to land after 26-player-page.css, which owns the
  // `.statcast-section` the strip sits inside.
  'src/styles': 60,
  // +1 for gamehighlights.js — the thin static-file reader for the per-team
  // highlight archives, sibling to the live-fetch highlights.js already here.
  // Same reader-next-to-its-topic shape as war.js/jerseys.js/rookies.js.
  'src/api': 84,
  // +1 for check-dead-exports.mjs — another flat lint guard, same shape as
  // its siblings already here.
  // +2 for gen-highlights.mjs and gen-highlights-backfill.mjs — a nightly
  // generator and its hand-run backfill, the same pair-of-files shape as
  // gen-rookies.mjs/gen-rookies-backfill.mjs already here. Every gen-*.mjs in
  // this repo sits flat in scripts/ (only shared helpers live in scripts/lib,
  // where this pair's shared body does go), so nesting these two alone would
  // split the generator catalog rather than subdivide it.
  // +1 for check-spoiler-manifest.mjs — another flat lint guard, same shape as
  // check-dead-exports.mjs and check-stamp-surfaces.mjs already here. Its data
  // (src/api/spoiler-manifest.json) deliberately does NOT live beside it: the
  // classification is a fact about the modules, so it sits with them.
  scripts: 70,
  // +1 for buildInfo.js — a two-line env-var reader in the same vein as the
  // existing clerkConfig.js, not a new subsystem, so it doesn't earn its own
  // subdirectory.
  // +1 for logoCdn.js — the mlbstatic CDN base URL and per-variant paths,
  // split out of teams.js so scripts/lib/mono-logo-art.mjs (plain Node, not a
  // Vite module) can build the same URLs without importing teams.js's whole
  // browser-side dependency graph. A leaf constants module, not a subsystem.
  'src/lib': 52,
  'src/screens': 38,
  // 21 -> 19: useFavoriteTeam.js and useKeepAwakePreference.js moved into
  // src/hooks/preferences/ alongside the usePreferences store they are now
  // thin wrappers over. Tightened rather than left pinned, per the rule above.
  'src/hooks': 19,
  'src/screens/identity-lab': 15,
}

const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git'])

function walk(dir, out = []) {
  out.push(dir)
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (IGNORE_DIRS.has(entry)) continue
    const rel = `${dir}/${entry}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
  }
  return out
}

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
