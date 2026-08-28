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
  // A FILE IN `api/` IS A URL, which is what makes this directory different
  // from every other entry in this table. `api/copy.js` IS `/api/copy`;
  // subdividing it into `api/admin/copy.js` renames a live endpoint, and the
  // rename is silent — the old path 404s and every client falls back to its
  // "not configured" degrade, which is the exact class of outage the KV_*
  // episode was (api/_lib/redis.js). So the twelve endpoints here stay flat,
  // and this budget is the deliberate exception the guard's own header asks
  // for rather than a directory awaiting subdivision.
  //
  // 12 -> 13 for `identity.js`: the club-identity override store (ADR-0050),
  // the sibling of `copy.js` that /team/{id}'s admin gear writes through.
  //
  // 13 -> 14 for `identity-logo.js`: the logo-art byte upload feeding that same
  // store (the ballpark-photo pattern applied to a club's mark) — a URL like
  // every other file here, so it stays flat for the same rename-is-an-outage
  // reason.
  // 14 -> 15 for `contract-identity.js`: the admin override store behind
  // /admin/contracts (ADR-0066), same shape as identity.js one entry above —
  // a narrow, allowlist-gated endpoint, so it stays flat with every sibling.
  api: 15,
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
  //
  // 70 -> 71 -> 70: `61-focus-mode.css` briefly split out of `11-innings.css`,
  // then LEFT this directory entirely (ADR-0043). Focus mode's rewrite took
  // that partial past check-file-size's 600-line cap, and the two ordinary
  // remedies were both shut: it cannot fold back into an earlier partial (it
  // has to load after everything it overrides, 25-wide-layout.css included),
  // and it cannot split into a numbered sibling here, because that is exactly
  // the growth this budget forbids. So it subdivided instead —
  // `src/styles/focus/{stage,atbat,reference}.css`, its own directory entry,
  // imported last and in order by `index.css`. That is ADR-0038's own
  // prescription for a flat directory this size, and it is the first partial
  // here to take it; a future split under pressure should look at this
  // precedent before reaching for a 71st sibling.
  //
  // 70 -> 71 for `05a-career-timeline.css`: CareerTimeline's `.careertl__*`
  // rules, split out of `05-masthead-nav.css` (already at its check-file-size
  // budget) for the same reason as every lettered sibling above.
  // 71 -> 72 for `31b-prospect-lines.css`: the Top 100 page's "Line" cell,
  // split out of `31-wild-card.css` for the same reason 31a was — that file
  // was back at its own check-file-size budget again.
  // 72 -> 73 for `31c-prospect-filters.css`: the Top 100 page's filter row
  // (TeamFilterStrip + the level slider) and the slider control itself —
  // same split-for-budget reason as 31a/31b, its own lettered sibling.
  // 73 -> 74 for `31d-prospect-card.css`: the Analytics shelf's Prospect Card
  // (ProspectCard.jsx) — same lettered-sibling shape as 31a/31b/31c above.
  // 74 -> 75 for `31e-prospect-board.css`: /prospects needs its own responsive
  // board without changing the shared Ledger behavior on unrelated pages.
  // 75 -> 76 for `61-ballpark-admin.css`: the site owner's in-place editor on
  // the Ballpark card. A NEW partial rather than rules appended to
  // 57-ballpark-card.css, and the reason is code splitting, not file length —
  // it is imported by the two lazily-loaded editor modules (the 58+ convention),
  // so putting it in the card's own always-loaded stylesheet would ship an
  // admin form's CSS to every visitor to make one person's page work.
  // 76 -> 77 for `06a-gamecard-parkart.css`: the slate card's hover ballpark
  // backdrop. A lettered sibling of `06-loader-and-cards.css` for the same
  // reason as 05a and the 31x family — that file sits 22 lines under its
  // check-file-size budget and this feature is four times that.
  // 77 -> 78 for `62-game-preview.css`: the chrome AROUND the preview poster
  // (the studio frame and its controls). Deliberately tiny — the poster
  // itself is a canvas and has no CSS at all — and imported by its own
  // screen rather than index.css, so it costs no other route anything.
  // 78 -> 79 for `12a-seal-tear.css`: the kraft cover coming off. A lettered
  // sibling of `12-sealbox.css` for the same reason as 05a/06a and the 31x
  // family, with one extra: that file is already on a shrinking check-file-size
  // budget, so this is the "put new code elsewhere" the file-size guard asks
  // for rather than a second front door. The letter is load-bearing — the tear
  // re-times an animation 12-sealbox.css declares, so it has to cascade after
  // it.
  // 79 -> 80 for `63-print-sheet.css`: the printable pre-pitch scorecard
  // (`/{date}/{matchup}/sheet`). Its own partial for the same two reasons
  // `62-game-preview.css` earned one — it belongs to a single lazily-loaded
  // screen and is imported BY that screen rather than by index.css, so no
  // other route pays for it — plus a third that is specific to it: it is the
  // only file in this directory holding an `@media print` block and an
  // `@page` rule, and burying a paper-geometry budget inside a screen
  // stylesheet is exactly how the next person fails to find it.
  // +1 for 41a-scorecard-page.css — 41-scorecard.css crossed the 600-line
  // file cap when the sheet grew its #22 header/footer/editor chrome, and
  // this is that partial's page-chrome half, imported directly after it.
  // +1 for 64-milb-alumni.css — the "Made The Show" card at the foot of a MiLB
  // team's Overview (components/teamstats/MilbAlumni.jsx). A new component
  // earns a partial, the same reasoning as the entries above; it has no
  // existing partial to join, since no other file styles a farm club's
  // big-league alumni.
  //
  // 82 -> 83 for `62-identity-admin.css`: the team hub's admin-only club
  // identity editor (ADR-0050), appended after `61-ballpark-admin.css` because
  // it is the same idea one card over and inherits that partial's argument
  // about drawing chrome in the club's own colours. Neither is @imported by
  // index.css — the lazy component that draws it imports it — so the growth
  // here costs a visitor nothing.
  //
  // 83 -> 84 for `65-about-page.css`: the About page redesign outgrew the
  // headroom left in `08-site-shell.css`, so its rules MOVED there rather than
  // being stacked on top of it. A net +1 file that is also a net win — About is
  // one lazy route, `screens/AboutPage.jsx` imports the sheet itself, and the
  // core render-blocking sheet got ~140 lines lighter in the trade.
  // +1 for `65-team-records.css`: the Numbers tab's Records card. A genuinely
  // new UI rather than a split-out of an over-budget file. It SHARES the 65
  // prefix with `65-about-page.css` above — the two branches picked the next
  // free integer independently, and the collision is harmless because neither
  // is @imported by index.css, so no cascade order depends on the numbers.
  // Deliberately small: the card reuses `.tstats-card`/`.tstatrow` from
  // 31-wild-card.css; only the half toggle, the group subheadings and the
  // counts block are new.
  // +1 for `66-situational-records.css`: the standalone page that ranks one of
  // that card's rows across a whole level. The table itself is `.standings`,
  // shared with the standings and umpire boards, so only the control strip, the
  // rank badge and two row states are new — and the page imports it itself.
  //
  // 89 -> 90 for `68-around-the-game.css`: ONE sheet for all FIVE pages in
  // src/screens/around-the-game/. Five partials would have cost 94 here and hit the
  // shared-chunk ordering trap src/index.css's header records.
  // 90 -> 91 for `26b-player-contract.css`: the player-page contract scorebug
  // is a self-contained lazy component, and its broadcast treatment would push
  // the already-budgeted 26-player-page.css over its file-size ceiling. Keeping
  // the rules beside the component also leaves them out of unrelated routes.
  //
  // 91 -> 92 for `69-pitch-arsenal.css`: the player page's redressed Pitches
  // card and its times-through-the-order split. Same reason as the line above:
  // 26-player-page.css has no headroom left under its own file-size ceiling,
  // so the card's rules had to land in a partial of their own.
  //
  // 92 -> 93 for `69-hit-chart.css`: the spray chart's own partial. It shares
  // the 69 prefix with the file above — two branches picked the next free
  // integer independently, the same harmless collision 62- and 65- already
  // carry. index.css names every partial in its own explicit order, so the
  // prefix is a label, not a cascade position.
  //
  // 93 -> 95 for `70-contracts-grid.css` and `71-salaries-league.css`: the club
  // ledger at /team/{id}/contracts and the thirty-club board at /salaries. Two
  // partials rather than one because they are two routes — each is imported by
  // its own screen and neither ships on the other's chunk — and this directory
  // cannot nest without breaking the ordering the exception above protects.
  //
  // 95 -> 96 for `70-postseason-race.css`: PostseasonRacePage.jsx's own
  // layout, reusing .seedcard/.seedrow (34-postseason.css) and
  // .standings/.lgstand (30-standings.css) rather than redeclaring them. It
  // SHARES the 70 prefix with `70-contracts-grid.css` above — the two
  // branches picked the next free integer independently off the same base
  // count (93), the same harmless collision 62-/65-/69- already carry;
  // neither is @imported by index.css in a way that depends on the other's
  // position.
  //
  // 97 -> 98 for `72-player-hover-card.css`: the global hover popover's
  // rules, core (not per-route) since PlayerLink, its trigger, is core.
  //
  // 96 -> 97 for `04a-wire-dock.css`: the phone's bottom-anchored presentation
  // of the league roster-move feed (components/transactions/WireDock.jsx). A
  // LETTERED sibling of `04-site-bar.css` rather than the next free integer,
  // and here the position is genuinely load-bearing: the dock's rows are drawn
  // by the same MoveRow.jsx and wear the same `.wire__*` classes 04 declares,
  // so this file's scoped overrides have to cascade AFTER them. Its one
  // alternative was growing 04-site-bar.css, which sits on exactly
  // check-file-size.mjs's 600-line ceiling — and that guard's remedy is to
  // split, not to raise. Same trade the 21/21a, 26/26a and 48/48-stamp-strip
  // entries above record.
  // +1 for 72-club-transactions.css, the club roster-move ledger page. Page-only
  // rules, so folding them into 29-team-transactions.css would put them in the
  // core sheet every other page loads.
  // +1 for 73-spray-map.css, the player page's season spray card. Its two
  // alternatives were both worse: 26-player-page.css has no headroom under its
  // own 1200-line file-size budget, and 69-hit-chart.css — the card this one
  // borrows its dress from — sits at 811 of 900 and namespaces every rule to
  // `.hitchart`, so folding a differently-scoped card in there would give those
  // selectors a second meaning AND need a file-size bump in the same breath.
  // +1 for 26d-command-map.css, the season command map. Component-imported
  // like 26a/26b/26c, so it ships only to the Analytics tab that renders it.
  // +1 for 26c-mound-card.css, the pitcher's mound card. Component-imported like
  // its 26a/26b neighbours, so it ships only to a page that renders the card.
  // The alternative was 26-player-page.css, which is 1145 lines — well past
  // check-file-size.mjs's 600-line ceiling and on a budget of its own, and that
  // guard's remedy is to split rather than to grow. Same trade the 21/21a,
  // 26/26a and 48/48-stamp-strip entries above record.
  // 100 -> 101 for 48b-logbook-milestones.css — split out of
  // 48a-logbook-stats.css the moment that file hit ITS OWN 600-line cap; same
  // trade as the paragraph above, one file over.
  // 101 -> 102 for 06b-offday-cards.css — the off-day club tiles, split out of
  // 06-loader-and-cards.css when their pointer states pushed that file past its
  // own budget. It has to stay a flat sibling in the ordered @import chain: it
  // borrows .gamecard__logobox's tile recipe and must cascade right after it.
  // 102 -> 103 for 48d-stamp-detail.css — the Game Log stamp sheet's tap-to-open
  // detail modal, split out of 48c-stamp-sheet.css the moment that file hit ITS
  // OWN 600-line cap; same trade as the two paragraphs above, one file over.
  // Component-imported (StampDetailModal.jsx), not part of index.css's core
  // cascade, so ordering relative to its sibling doesn't matter here.
  // 103 -> 105 for 74-contract-workbench.css and 74a-contract-lookup.css —
  // the /admin/contracts match workbench (ADR-0067) and its lookup deck. Two
  // files, not one, because two agents built them against a fixed component
  // interface and a shared partial would have been the only place they could
  // collide. They stay flat siblings in the ordered @import chain: the deck
  // sits inside the workbench's layout and has to cascade right after it.
  'src/styles': 105,
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
  // +1 for careerTimeline.js — the Team history rail's fetch side, split OUT of
  // person-fetch.js when that file hit its own size budget. It cannot go in
  // src/api/person/, whose one convention is that nothing there fetches.
  // +1 for pitcherSplit.js — the shared Starting Pitchers/Bullpen partition
  // pulled out of loadRoster.js and recentForm.js, which had each grown their
  // own copy of the same cap-and-slice logic (independently, so a pitcher
  // could rank below both cutoffs and vanish from the roster page entirely).
  // +1 for scheduleGames.js — recentDecidedGames/allDecidedGames/
  // allStartedGames split OUT of schedule.js when that file hit its own size
  // budget. Sibling of schedule.js in every sense that matters (same rows in,
  // no fetch of its own), so it belongs beside it rather than in a
  // subdirectory invented just to hold one file.
  // +1 for gamePreview.js — the preview poster's data model, and the single
  // file a spoiler audit of that poster has to read. It is a selector over
  // the live feed like every other module here, and putting it in a
  // subdirectory would take it out of the flat set check-spoiler-manifest
  // classifies, which is exactly where it needs to stay.
  // +1 for between-innings.js — the post-half hold's card builder, same
  // caller-gated-selector shape as prehalf-callouts.js beside it.
  // +1 for scorecardGame.js — the scorecard grid's reveal-gated builders,
  // split out of loadScorecard.js so each half of that old mixed module
  // carries one honest classification. Both belong in the flat set
  // check-spoiler-manifest classifies, same argument as gamePreview.js.
  // +1 for attendance.js — the Ballpark card's attendance reader, same
  // spoiler-free static-JSON shape as comebackWins.js beside it, and
  // belongs in the flat set check-spoiler-manifest classifies.
  // +1 for teamRecords.js — the static reader behind the Numbers tab's
  // situational Records card, sibling to comebackWins.js already here. Same
  // argument as every entry above: a subdirectory would take it out of the
  // flat set check-spoiler-manifest classifies, which is where a module that
  // reads per-game results needs to stay.
  // +1 for situationalRecordRankings.js — the same ledger pivoted across a
  // level for the standalone Situational Records page. Kept OUT of
  // teamRecords.js on purpose:
  // one module answers "this club's fifty splits", the other "this split's
  // thirty clubs", and merging them would put a page-sized fan-out fetch in the
  // module every Numbers tab loads. Flat for the manifest reason above.
  // +1 for salaries.js — the club-ledger and league-rollup readers behind the
  // two new money pages. Flat for the manifest reason above: check-spoiler-
  // manifest classifies the flat set, and a subdirectory would quietly take a
  // new module out of the thing that proves it carries a classification at all.
  // +1 for playerHoverCard.js — the hover card's lean data loader. Flat for
  // the check-spoiler-manifest reason above.
  // +1 for spray.js — the season spray map's bucket reader. Flat for the
  // check-spoiler-manifest reason above, and it earns its own file rather than
  // riding in hitchart.js precisely because the two carry OPPOSITE
  // classifications: one game's batted balls are reveal-only, a season of them
  // on the player page is not.
  // +1 for commandMap.js — the season command map's shard reader, sibling to
  // pitchArsenal.js and swept by the same generator. It sits beside the other
  // per-player static readers rather than in a subdirectory of its own, which
  // would separate it from the mix card it is read next to.
  // +1 for levelTenure.js — the level-tenure-benchmark reader, sibling to
  // prospectTrend.js and read by the same Prospect Card; splitting it into a
  // subdirectory would separate it from the exact module it complements.
  // 104 -> 105 for logbookMilestones.js — the Game Log retrospective's
  // milestone/collection-progress engine (docs/design-inspiration.md §8),
  // sibling to logbookStats.js/logbookRetrospective.js and read only by
  // LogbookStatsPage.jsx, same shape as the other two. Landed on `main`
  // alongside levelTenure.js above (two branches, same directory, each
  // measured against the pre-merge tree) — re-measured post-merge per this
  // file's own "rebase and re-measure" rule rather than trusting either
  // branch's number.
  // 105 -> 106 for contractsHistory.js — the read-side merge that joins an
  // admin's live identity override onto the static historical-contract
  // shards (ADR-0067). It belongs beside the other src/api readers: it is a
  // data-layer module with no surface, and its spoiler class is the same
  // spoiler-FREE as its neighbours — historical contract records carry no
  // game, no linescore and no reveal state.
  'src/api': 106,
  // src/api/person, 13: awards.js, the player page's Awards section, split OUT
  // of transactions.js when the honors half it carried outgrew that file's
  // 600-line budget. It belongs beside its siblings — same "nothing here
  // fetches" convention, same person-shaping job — and a subdirectory for one
  // module would only hide it from check-spoiler-manifest's flat classification.
  'src/api/person': 13,
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
  // +2 for gen-prospect-trend.mjs (the nightly prospect percentile generator)
  // and gen-prospect-trend-backfill.mjs (its one-time historical backfill) —
  // the same pair-of-files shape as gen-rookies.mjs/gen-rookies-backfill.mjs
  // already noted above, flat here like every other gen-*.mjs.
  // +1 for check-strike-links.mjs — another flat lint guard over src/styles/,
  // the same shape and directory as check-focus-ring.mjs and
  // check-typography.mjs already here. A guards/ subdirectory would have to
  // take all fourteen of them at once, which is a move, not this change.
  // +2 for gen-milb-ballparks.mjs (the MiLB venue-list generator) and
  // gen-ballpark-thumbs.mjs (mobile-sized ballpark-photo thumbnails) — flat
  // here like every other gen-*.mjs in this directory.
  // +1 for gen-milb-alumni.mjs — the nightly precompute behind the "Made The
  // Show" card. A generator belongs beside its siblings here: the nightly
  // workflow runs this directory as a flat list, and scripts/lib/ is for
  // testable helpers, not top-level scripts (a generator file RUNS on import,
  // so it cannot live there).
  // 77 -> 79 for the /learn landing pages: gen-sitemap.mjs (the site had no
  // sitemap at all, which is a real gap for an app whose routes only exist once
  // React has run) and check-learn-css.mjs (guards public/learn.css against
  // palette drift, since a page served outside the bundle cannot import the
  // token sheet). Both are top-level by the rule stated below — a generator runs
  // on import, and scripts/lib is for helpers that do not.
  // +1 for gen-attendance.mjs — the nightly per-team attendance sweep behind
  // the Ballpark card's avg/high/low/rank, flat like every other gen-*.mjs.
  // +1 for gen-team-records.mjs — the nightly per-game ledger behind the
  // Numbers tab's situational Records card. Same reason gen-milb-alumni.mjs
  // took a number above: the nightly workflow runs this directory as a flat
  // list, and a generator file RUNS on import, so it cannot live in
  // scripts/lib/ — which is where its testable half (team-records.mjs) went.
  // +1 for check-line-endings.mjs — another flat lint guard, same shape and
  // argument as check-dead-exports.mjs and check-strike-links.mjs already
  // counted here. It is the REPORTING half of the LF rule whose enforcing half
  // is .gitattributes; a guards/ subdirectory would take all sixteen at once.
  //
  // 83 -> 85 for the broadcast reports' two generators, `gen-gate.mjs` and
  // `gen-farm-system.mjs`. Both RUN on import, which the note above says
  // scripts/lib is not for, so they stay flat with every other gen-*.mjs.
  //
  // 86 -> 87 for check-comment-citations.mjs — another flat lint guard, same
  // shape as check-dead-exports.mjs and its siblings already here.
  //
  // 87 -> 89 for check-fixture-freshness.mjs and check-feed-shape-drift.mjs,
  // the e2e mock-fixture guards — flat lint/cron scripts, same shape as
  // every other check-*.mjs already counted here.
  //
  // +1 for gen-spray.mjs — the nightly batted-ball sweep behind the player
  // page's spray map. A generator RUNS on import, so it cannot live in
  // scripts/lib/; it stays flat with every other gen-*.mjs, and its two pure
  // halves are exported from it for the unit suite the way
  // gen-pitch-arsenal.mjs already exports its own.
  //
  // 94 -> 95 for check-searchable-sport-ids.mjs — another flat lint guard,
  // same shape as check-report-pages.mjs and its siblings already here
  // (issue #852).
  //
  // +1 for gen-level-tenure-benchmark.mjs — a generator RUNS on import, so it
  // cannot live in scripts/lib/; stays flat with every other gen-*.mjs.
  // +1 for scan-game-notes-insights.mjs — the MANUAL Game Notes curation scan
  // (issue #774). Not a generator and not on any cron, but it sits flat with
  // them for the same reason: it runs on import (a CLI with a dispatch at the
  // bottom), so scripts/lib/ is not open to it. Its pure half DID go to
  // scripts/lib/game-notes-corroboration.mjs.
  //
  // +1 for check-word-choice.mjs — another flat lint guard, same shape as
  // check-caps.mjs and check-typography.mjs already here. It enforces the
  // house word list ("postseason", never the other word) across src/, api/,
  // scripts/ and docs/.
  // +1 for check-diary-voice.mjs — the plain-language guard for both research
  // diaries (standing instruction, 2026-08-25). A flat lint guard exactly like
  // check-caps.mjs and check-typography.mjs beside it, and it runs on import,
  // so scripts/lib/ is not open to it either.
  // +1 for research-db.mjs — the local DuckDB query layer over the research
  // diaries' cached panels (research tool, never shipped). A standalone CLI
  // entry point with a dispatch at the bottom, not a helper another script
  // imports, so scripts/lib/ is not open to it; stays flat with every other
  // top-level script here.
  // +2 for gen-contracts-season-players.mjs and gen-contracts-identity.mjs —
  // the historical-contract identity-resolution pipeline (ADR-0066). Each
  // runs on import (fetches statsapi / writes the resolved crosswalk), same
  // shape as every other gen-*.mjs already flat here.
  // 102 -> 104 for gen-contracts-shards.mjs and gen-contracts-search-index.mjs,
  // the two hand-run generators behind the historical-contracts read path
  // (ADR-0067). Neither can live in scripts/lib/: both RUN on import and
  // write files, which is exactly what that subdirectory is not for. They
  // stay flat with every other gen-*.mjs, like their sibling
  // gen-contracts-identity.mjs.
  // 104 -> 105 for check-data-freshness.mjs, which fails the nightly job when a
  // committed public/data dataset is older than the cron meant to write it. It
  // belongs beside its siblings — check-fixture-freshness.mjs, check-dir-size.mjs
  // and the rest of the check-*.mjs guards are all flat here, and a guard nobody
  // can find next to the others is a guard nobody maintains. It is not in
  // scripts/lib/ because it RUNS as a script; its pure half is exported from the
  // same file for test/data-freshness.test.js, the guard-plus-CLI shape
  // gen-attendance.mjs and friends already use.
  // 105 -> 106 for gen-abs-challenges.mjs, the nightly sweep behind
  // /abs-challenges (the ABS Challenge System season board). It RUNS on
  // import, fetching statsapi and writing public/data, which is exactly what
  // scripts/lib/ is not for; its pure half lives there instead, as
  // abs-challenges.mjs. Flat with every other gen-*.mjs here.
  scripts: 106,
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
  // +1 for sealTear.js — where the kraft seal's cover splits when it is torn
  // off, as pure math (the two clip-path polygons; the motion is CSS). It sits
  // here for the reason passportLayout.js and stampArt.js do: a component that
  // types its own coordinates has put them somewhere nothing can check, and the
  // promise this one makes — the same seal tears identically forever — is only
  // testable if the path is a function. It seeds off stampArt.js's own
  // `stampSeed` rather than adding a second answer to that question. A leaf
  // module, not a new subsystem.
  // +1 for scorecardNotes.js — the scorecard's per-cell override store, the
  // same React-free-core-under-a-hook shape as stamps.js/books.js beside it.
  // +2 for playerHoverStore.js (external store, SyncStatusProvider shape) and
  // playerHoverPosition.js (pure clamp/flip geometry, sealTear.js's reason).
  // +1 for prefetchHeadshots.js — a leaf warm-the-CDN-cache helper (one
  // function, one import of teams.js's realHeadshotUrl) InningViewer calls
  // when at-bat stepping begins, same small-utility-beside-its-caller shape
  // as logoCdn.js/buildInfo.js above. Not a new subsystem.
  // 58 -> 59 for milestoneCelebrations.js — the milestone shelf's one-shot
  // completion-animation store, same shape as account/prompts.js beside it.
  'src/lib': 59,
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
  // +1 for century-club.mjs: the SQLite query + row-shaping behind
  // gen-callouts.mjs's veloVariety/centuryClub/veloPeak join (docs/callouts.md)
  // against gen-pitch-arsenal.mjs's century-pitch sweep — pulled out for the
  // same reason as pitcher-starts.mjs above (unit-testable row shaping,
  // gen-callouts.mjs kept under its own line budget, ADR-0038).
  // +1 for prospectAgeBenchmark.mjs — the batched birthDate fetch behind the
  // Prospect Card's age-vs-level fact, its own module since it's the first
  // caller either gen-prospect-trend.mjs or its backfill has needed for a
  // /people lookup, not a fit for prospectPercentile.mjs's pure math.
  // +1 for umpire-accuracy-merge.mjs — gen-umpire-accuracy.mjs's crew-
  // reassignment merge logic, pulled out so it can be unit-tested (a
  // generator is a top-level script; importing one RUNS it).
  // +1 for reassignable-merge.mjs — the generic version of that same fix,
  // so any future append-only generator keyed on an upstream-asserted
  // identity can adopt it instead of hand-rolling the same bug again.
  // +1 for milb-alumni.mjs — the ranking, the incremental-scan decision and the
  // games floor behind gen-milb-alumni.mjs. This directory exists precisely for
  // this: a generator file RUNS on import, so a helper worth a unit test has to
  // live here to be testable at all (test/milb-alumni.test.js).
  // +1 for team-records.mjs — gen-team-records.mjs's per-game derivations
  // (linescore lead states, walk-off detection, series tagging, daily division
  // ranks), here for exactly the reason the entry above gives: a generator is
  // a top-level script, so importing one RUNS it, and this is the half worth
  // pinning with tests (test/team-records.test.js).
  // 20 -> 21 for contract-pay-rank.mjs — the Contract card's positional pay rank
  // (which pool a player is ranked in, the prorated-salary normalisation, the
  // competition ranking). Here for the reason every entry above gives: a
  // generator is a top-level script, so importing one RUNS it, and this is a
  // pile of judgement calls that is worth pinning with tests
  // (test/contract-pay-rank.test.js) rather than leaving inline in
  // fever/gen-player-contracts.mjs.
  // 21 -> 22 for salaries.mjs — gen-salaries.mjs's pure roll-up (cell kinds, per-year
  // totals, the league board), here for the same reason as the entry above:
  // importing the generator would RUN it, so the arithmetic the two money
  // pages print has to live beside it to be testable at all
  // (test/salaries.test.js). Both landed the same day, each independently
  // bumping the budget from the pre-stack count of 20.
  // +1 for command-grid.mjs — the pitch-location sweep's counting and storage,
  // split OUT of gen-pitch-arsenal.mjs because that file hit check-file-size's
  // 600-line ceiling when the grid arrived, and that guard's remedy is to split
  // rather than to widen. It sits here beside the other sweep helpers the
  // generators share.
  // +1 for game-notes-corroboration.mjs — the vocabulary, validation and
  // staleness window the Game Notes curation signal shares between the manual
  // scan, gen-callouts.mjs and its unit test (issue #774). Pure, importable,
  // and shared by three callers: exactly what this directory is for.
  // +1 for rookie-crossing.mjs — the rookie-limit crossing-detection walk,
  // pulled out of what used to be two independent copies in gen-rookies.mjs
  // and gen-rookies-backfill.mjs so the fix for a real bug (Negro League
  // seasons, now sport.id=1 since MLB's 2020 reclassification, wrongly
  // counting toward an AL/NL rookie limit) can't drift between them, and so
  // it's unit-testable at all — a generator file RUNS on import, so this pure
  // half moved here the same way command-grid.mjs and
  // game-notes-corroboration.mjs did.
  // +1 for arsenal-side.mjs — the batter-side pitch-mix split behind
  // gen-callouts.mjs's sideSplit join (docs/callouts.md), against the `stand`
  // gen-pitch-arsenal.mjs now sweeps. Pulled out for exactly the reasons
  // century-club.mjs above was, and it reads the SAME table: the show floors
  // and row shaping are unit-testable without a live DB, and gen-callouts.mjs
  // stays under its own line budget (ADR-0038).
  // +3 for retrosheet-teams.mjs, contract-identity-match.mjs, and csv.mjs —
  // the pure, unit-tested pieces of the contract-identity pipeline
  // (ADR-0066): a flat club-code crosswalk, the name/position/service-time
  // scoring, and the CSV reader for scripts/data/contracts/*.csv. All three
  // are imported by scripts/gen-contracts-identity.mjs and tested without a
  // live statsapi call, exactly the testable-helper convention this
  // directory exists for.
  // +1 for war-splits.mjs — the retry and carry-forward half of gen-war.mjs's
  // ~180 per-player split requests, moved here for the same reason as every
  // entry above it: gen-war.mjs does its work at import, so this behavior was
  // untestable while it lived there. It earned the move by breaking in
  // production first — one transient HTTP 500 aborted the whole generator on
  // 2026-08-28 — and test/war-splits.test.js now pins all five cases (retry,
  // give-up, one-player-fails, carry-forward, outage threshold).
  // +1 for abs-challenges.mjs — the pure half of gen-abs-challenges.mjs: one
  // Final game's feed to challenge rows, and the accumulated rows to every
  // split public/data/abs-challenges.json ships. Both halves are unit-tested
  // without a live statsapi call (test/abs-challenges.test.js), which is the
  // testable-helper convention this directory exists for, and neither could be
  // tested inside a generator that does its work at import.
  'scripts/lib': 32,
  // +1 for LogbookCollection.jsx — one open book's whole page (topbar, tray,
  // the passport book, the season grid), split out of LogbookPage.jsx when
  // the multi-book shelf pushed that file past check-file-size.mjs's 600-line
  // ceiling. LogbookPage.jsx keeps the route-facing shell (the Clerk gate,
  // and the shelf-vs-single-book resolver); this file is the part that draws
  // one book. It is the reason GameStamp.jsx's containment allowlist
  // (scripts/check-stamp-surfaces.mjs) now names this file instead of
  // LogbookPage.jsx — a mechanical move, not a new spoiler-relevant surface.
  // +1 for GamePreview.jsx — the preview-poster studio, a lazily-loaded
  // game section (step 4) alongside TeamInfo/InningViewer/BoxScore. Same
  // shape as its siblings: one route, one screen, in the flat set.
  // +1 for BetweenInningsLab.jsx — an unlisted QA page, same shape as
  // AnimationLab.jsx beside it.
  // +1 for SituationalRecordsPage.jsx — the standalone Situational Records
  // ranking page, one
  // more entry in REPORT_PAGES and so the same shape as StandingsPage.jsx and
  // UmpireRankingsPage.jsx already here: one route, one screen, in the flat
  // set. It is not a team-hub screen and does not belong in src/screens/team/,
  // which holds the tabs of one club's page.
  // +1 for SalariesPage.jsx — the league salary board, one route, one screen,
  // the same shape as StandingsPage.jsx beside it. The club-scoped half of the
  // same feature is a team-hub TAB and correctly went to src/screens/team/.
  // +1 for PostseasonRacePage.jsx — the current-season "if it ended today"
  // bracket + Wild Card standings, same one-route-one-screen shape.
  'src/screens': 45,
  // 21 -> 19: useFavoriteTeam.js and useKeepAwakePreference.js moved into
  // src/hooks/preferences/ alongside the usePreferences store they are now
  // thin wrappers over. Tightened rather than left pinned, per the rule above.
  // 19 -> 20 for useBooks.js — useStamps.js's sibling for the new multi-book
  // store (src/lib/books.js), same React-wiring-over-a-pure-core shape as the
  // hook it sits beside.
  // 20 -> 21 for useScorecardNotes.js — the storage wiring over
  // lib/scorecardNotes.js, the same shape one more time.
  // 21 -> 22 for useCalloutLedger.js — the per-game "already shown" memory the
  // callout surfaces rank against. React wiring (a context over a Map) with its
  // rules pure in api/callout-notes/shared.js, the same split one more time.
  // 22 -> 23 for usePlayerHoverStats.js — the hover card's cached fetch hook.
  // 23 -> 24 for useHeadshotPrefetch.js — InningViewer's headshot-CDN warm-up,
  // the same React-wiring-(useEffect/useRef)-over-a-pure-selector shape as
  // usePlayerHoverStats.js beside it.
  // 24 -> 25 for useMilestoneCelebration.js — one collection's one-shot
  // completion-animation state, same shape as usePromptDismiss.js beside it.
  'src/hooks': 25,
  'src/screens/identity-lab': 15,
  // New entry: +1 for PlayerHoverCard.jsx — a player-identity primitive like
  // Headshot/PlayerLink beside it, not one of this bucket's ten player-PAGE cards.
  // 13 -> 15 for GameLog.jsx (the Game log card, split out of PlayerPage.jsx so
  // its MLB/AAA level toggle can own its own useState — PlayerPage can't add a
  // hook past its `if (gate) return gate` loading gate, same reason
  // CareerRegister is its own component) and GameLink.jsx (the boxscore link
  // GameLog.jsx needs, promoted out of PlayerPage.jsx so the two other
  // PlayerPage call sites and this one share one definition instead of three).
  'src/components/player': 15,
  // New entry: +1 for blockageCorrected.js — the diary's first `corrected`
  // entry that sits ABOVE the entry it corrects rather than replacing it
  // (the diary is append-only, see docs/agents/research-diary.md's second
  // rule), same shape as humpArtifact.js/movementWindows.js already prove out
  // in team-movement-windows.md's history.
  'src/lib/research/diary': 13,
  // New entry: same one-file-per-finding shape as its sibling diary above,
  // and the same reason that one carries a budget — a research diary is
  // append-only (docs/agents/contender-diary.md), so this count only grows.
  // 12 -> 14 for a five-spike batch landing in one synthesis pass:
  // tradeDeadlineValue.js, rosterAgeDeadlineCut.js, starDiversityAwards.js,
  // organizationTenure.js, exitReasonMix.js.
  'src/lib/research/contenderDiary': 14,
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
