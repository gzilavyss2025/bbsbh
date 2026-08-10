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
  // 61 -> 62 for `58-logbook-shelf.css`: the Game Log shelf and its book
  // create/rename/re-cover/remove sheet (ADR-0036's multi-book addendum) —
  // a genuinely new UI, not a split-out of an over-budget file, so it earns
  // the next free integer rather than a lettered sibling. Loaded directly by
  // `LogbookShelf.jsx`/`BookManagementSheet.jsx`, same "the component that
  // uses it carries it" convention as `49-passport-book.css`.
  //
  // 62 -> 63 for `17a-identity-lab-mark-panels.css`: the Identity Lab's per-bar
  // mark panel, sharing the `17-` prefix with the workbench sheet it sits
  // beside (a sibling, not a renumbering — same pair convention as 21/21a and
  // 26/26a above). Its own home rather than more lines in
  // 17-identity-lab-workbench.css, which is at its check-file-size budget; the
  // two alternatives were both worse — growing a file that guard already flags,
  // or nesting and breaking the ordering the exception below exists to protect.
  //
  // 63 -> 64 for `28a-team-hub-hero.css`: the team hub's identity header, sharing
  // the `28-` prefix with the rest of the hub (same pair convention as 21/21a,
  // 26/26a and 17/17a above). Split out because 28-team-hub.css was at its
  // check-file-size budget and still covers four unrelated surfaces below the
  // hero; nothing left there names a hero selector, so the two never compete.
  //
  // 64 -> 65 for `59-stamp-in.css`: the Stamp In page (ADR-0042), a genuinely
  // new route rather than a split-out of an over-budget file, so it earns the
  // next free integer rather than a lettered sibling. Loaded directly by
  // `screens/team/StampInPage.jsx`, same "the component that uses it carries
  // it" convention as `49-passport-book.css` and `58-logbook-shelf.css`. Its
  // position IS load-bearing: it de-chromes the `.flipback` card that
  // `22-box-score-tables.css` owns, so it has to cascade after it.
  //
  // 65 -> 66 for `60-book-cover-picker.css`: the OPPOSITE case to the two
  // above — this is a split of `58-logbook-shelf.css`, which reached
  // check-file-size's 600-line ceiling once the shelf became furniture and the
  // cover picker grew its six presets and phone stepper. That guard's remedy
  // is to split, and this directory cannot nest (a partial's numeric prefix IS
  // its cascade order, and `index.css` imports them as one ordered sheet), so
  // the split has to land here. Loaded by `BookCoverPicker.jsx`; must cascade
  // after `49-passport-book.css`, whose `.passcover` its preview reuses.
  //
  // 66 -> 67 for `21b-box-score-tally.css`: the by-inning tally's card, split
  // out of `21-box-score.css` (at its 800-line check-file-size ceiling) when
  // the card was redesigned from four slash-joined figures per box to one
  // number per box, and grew a grid and a pencil-wash scale of its own. Same
  // lettered-sibling shape as `21a-box-score-stars.css` beside it, and for the
  // same reason. Its position is load-bearing: it overrides `.bs__grid`'s cell
  // rules in `21-box-score.css`, so it has to cascade after them.
  // +1 for 48a-logbook-stats.css — split out of 48-logbook.css (ADR-0038's
  // file-size cap) once the Logbook retrospective's ported First Scorebook
  // sections pushed that file past 600 lines; same lettered-sibling shape as
  // 21a-box-score-stars.css.
  //
  // 68 -> 69 for `26b-recent-form.css`: the hitter Recent form card, split out
  // of `26-player-page.css` (at its check-file-size ceiling) when the card was
  // redesigned from a two-up fact grid into a four-row deviation ledger and
  // grew a diverging-bar scale of its own. Same lettered-sibling shape as
  // `26a-percentile-strip.css` beside it, and per-route for the same reason —
  // it is imported by `RecentFormCard.jsx`, not by `index.css`. Its position is
  // load-bearing: it extends `.ledger` rules that live in `26-player-page.css`,
  // so it has to cascade after them.
  //
  // 69 -> 70 for `31a-prospect-trend.css`: ProspectTrendPill's rules, split
  // out of `31-wild-card.css` (already at its check-file-size budget) rather
  // than grown there — same lettered-sibling shape as 21/21a, 26/26a, 17/17a,
  // 28/28a above, cascading right after the file it extends.
  'src/styles': 70,
  // +1 for gamehighlights.js — the thin static-file reader for the per-team
  // highlight archives, sibling to the live-fetch highlights.js already here.
  // Same reader-next-to-its-topic shape as war.js/jerseys.js/rookies.js.
  // +1 for seasonScoreFormula.js — pure home-field-factor formula pulled out
  // of gen-season-score.mjs so it can be bundled client-side, same reason
  // teamScoreFormula.js already sits here.
  // +1 for staticJson.js — the memoized same-origin read every build-time-fetch
  // reader in here now shares. It REMOVES the duplicated cache-after-await
  // block from ~18 of its neighbours (and the race in it), so this entry buys
  // one leaf file to delete a pattern copied eighteen times.
  // +2 for logbookGameDetail.js and logbookRetrospective.js — the Logbook
  // retrospective's ported First Scorebook sections, split from logbook.js/
  // logbookStats.js the same "narrow reimplementation, own file" pattern
  // those two already use rather than growing either past the file-size cap.
  // +1 for prospectTrend.js — the reader for gen-prospect-trend.mjs's
  // level-relative OPS/ERA percentile, sibling to prospects.js/feverRadar.js,
  // not folded into either (different data, different generator).
  'src/api': 89,
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
  // +1 for gen-league-logos.mjs — the two LEAGUE knockout marks the Game Log's
  // cover picker stamps on a board. Deliberately NOT a loop inside
  // gen-mono-logos.mjs: that script prunes its output directory of anything
  // not keyed by a numeric team id on every full run, so a league mark living
  // there would be deleted nightly. Flat here like every other gen-*.mjs.
  // +1 for gen-prospect-trend.mjs — the nightly prospect percentile
  // generator, flat here like every other gen-*.mjs in this directory.
  scripts: 72,
  // +1 for buildInfo.js — a two-line env-var reader in the same vein as the
  // existing clerkConfig.js, not a new subsystem, so it doesn't earn its own
  // subdirectory.
  // +1 for logoCdn.js — the mlbstatic CDN base URL and per-variant paths,
  // split out of teams.js so scripts/lib/mono-logo-art.mjs (plain Node, not a
  // Vite module) can build the same URLs without importing teams.js's whole
  // browser-side dependency graph. A leaf constants module, not a subsystem.
  // +1 for stampInkTuning.js — the per-club stamp-ink override reader
  // (src/lib/data/stamp-ink.json), same small reader/store-file pairing as
  // the existing stampLogoTuning.js beside it, not a new subsystem.
  // +1 for books.js — the pure rules for multiple named Game Log books
  // (ADR-0036's shelf), the same React-free-core-beside-its-hook shape as
  // stamps.js/useStamps.js, not a new subsystem.
  // +1 for logbookNav.js — the book-path helpers shared by LogbookPage.jsx
  // and LogbookCollection.jsx once that split landed (see the src/screens
  // entry below), pulled out rather than defined twice. A leaf module, not a
  // new subsystem.
  // +1 for stampIn.js — the Stamp In page's pure rules (ADR-0042): its
  // one-time consent record, the played-games filter, and the row action's
  // three states. The same React-free-core-beside-its-screen shape as
  // scoresUnlocked.js and spoiledDays.js, both of which are the consent
  // modules this one is modelled on. A leaf module, not a new subsystem.
  // +1 for shardKey.js — the `personId % 100` bucket three datasets are sharded
  // on (rookie records, career WAR, coaching history), each of which had its own
  // copy of the same two lines. It belongs here rather than in one of those
  // readers because it is a JOIN both sides of a dataset compute: the generator
  // files a record under a name the reader recomputes from an id, so a drift of
  // one player is a record that exists and can never be found. Four lines and no
  // imports — a leaf constant, not a new subsystem.
  'src/lib': 53,
  // New entry (was under the default 12-file cap): +1 for
  // prospectPercentile.mjs, the pure percentile math gen-prospect-trend.mjs
  // imports — scripts/CLAUDE.md's testable-helper convention (lib/roster.mjs
  // is the worked example), not a new subsystem.
  // +1 for pitcher-starts.mjs: gen-callouts.mjs's per-pitcher-game-log tally
  // (home/road split, 6+ IP record, all-starts record), pulled out so the
  // mid-season-trade regression it fixes (a new club inheriting a rival's
  // record) could be unit-tested — a generator is a top-level script, so a
  // helper worth testing can't stay inline (see roster.mjs's own header,
  // already in this directory for the same reason).
  'scripts/lib': 14,
  // +1 for LogbookCollection.jsx — one open book's whole page (topbar, tray,
  // the passport book, the season grid), split out of LogbookPage.jsx when
  // the multi-book shelf pushed that file past check-file-size.mjs's 600-line
  // ceiling. LogbookPage.jsx keeps the route-facing shell (the Clerk gate,
  // and the shelf-vs-single-book resolver); this file is the part that draws
  // one book. It is the reason GameStamp.jsx's containment allowlist
  // (scripts/check-stamp-surfaces.mjs) now names this file instead of
  // LogbookPage.jsx — a mechanical move, not a new spoiler-relevant surface.
  'src/screens': 39,
  // 21 -> 19: useFavoriteTeam.js and useKeepAwakePreference.js moved into
  // src/hooks/preferences/ alongside the usePreferences store they are now
  // thin wrappers over. Tightened rather than left pinned, per the rule above.
  // 19 -> 20 for useBooks.js — useStamps.js's sibling for the new multi-book
  // store (src/lib/books.js), same React-wiring-over-a-pure-core shape as the
  // hook it sits beside.
  'src/hooks': 20,
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
