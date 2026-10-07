# Notice — the slice plan (#1132)

Small PRs, each revertible without the others. This mirrors the EmptyState plan
(`../empty-state-collapse/slices.md`) and the Table plan. The row list for each
slice is `census.md` (the `slice` column of Parts 1 and 2); the API is
`spec.md`; the open questions are `decisions.md`.

**9 slices after this census (N0), 11 PRs.** N1 builds `Notice` and moves one
pilot. N2 and N3 move the open-page members. N4 to N8 are the spoiler-scope
slices: the shared error line, the delay card and its kin, and the pitcher card
in three steps (frame, frame, rename; the rename is three PRs). N9 cleans up.
97 sites move; 71 sites are held.

**This plan assumes the recommended answers to `decisions.md`.** If Gary answers
otherwise, the plan changes as "If Gary answers otherwise" says, before the slices.

| slice | what | sites | files | runs |
| --- | --- | --- | --- | --- |
| N1 | build `Notice` + lab + pilot (`.posterstudio__warn`) | 1 | 10 | first |
| N2 | the bare error lines on open pages | 9 | 9 | after N1 |
| N3 | the other open-page notices (photos, finder, erase, club list, All-Star Legacy) | 6 | 8 | after N1 |
| N4 | **spoiler**: the shared error line (`AsyncGate.jsx`), the slate card back, Box Lines | 45 (3 lines of code + 42 callers that need no edit) | 5 | after N1 |
| N5 | **spoiler**: the delay card, the extra-innings line, the postponed strip | 3 | 9 | after N1 |
| N6 | **spoiler**: the pitcher frame, part 1 (event bars, handoff cards) | 6 | 4 | after N1 |
| N7 | **spoiler**: the pitcher frame, part 2 (actor cards, the lens button; delete the old frame) | 5 | 9 | after N6 |
| N8a, b, c | **spoiler**: the pitcher rename (ADR-0084), three PRs | 22 (+ 24 selector rows) | 5, 4, 12 | after N7 |
| N9 | clean-up: dead rules, budgets, docs, the status on #1132 | 0 | ≤ 8 | last |

N8c counts 12 files, two over the target of 10: the renames are one mechanical
change that a single search finds, and splitting it would leave a half-renamed
card on screen between two merges.

---

## Before any slice

1. Gary answers `decisions.md`. Q1 and Q4 change what N1 builds. Q2 decides
   whether N2 and N4 exist. Q3 decides whether N6 and N7 exist. Q5 changes the
   hold list. "If Gary answers otherwise" (below) says what each answer does.
2. Re-run `node .scratch/design-system/notice-collapse/census.mjs` on the
   current `main`. A site added since N0 prints as UNREVIEWED; an override that no
   longer matches prints STALE. Fix both before slicing. Keys are `file#n`, so a
   new site above an old one in the same file shifts the old key: read the STALE
   list, do not delete it blind. (The census reads the EmptyState census with
   `--dump`, which writes nothing.)
3. Each slice is green before review: `npm run lint` in the foreground with the
   exit code echoed (`npm run lint; echo "exit=$?"`), `npm test`, `npm run build`,
   and a browser pass over each route listed for the slice at 390px and 900px,
   with `?nointro` on every URL.
4. **A notice is often hard to see on a live page**, because the data is on file
   and the fetch works. Each slice below says how to reach its notice. To see an
   error, fail the API in the browser: relay `statsapi.mlb.com` through Node with
   `page.route` and answer 500 (N0 did this for the slate). Never edit data, a
   fixture or a spec to force a state.
5. Screenshots: list the slice's routes in the PR body for #1177's suite. An
   agent runs `npm run visual` only when Gary asks (a hook enforces it). A
   changed page the PR did not mean to change is a bug.
6. For each slice that deletes a raw value, lower `scripts/check-raw-values.mjs`'s
   budgets (#1178) in the same PR. `check-caption-budget.mjs` too, if a deleted
   rule used `--fs-caption`.
7. **Every spoiler slice (N4 to N8) adds a seal pin** to its test file, copied
   from `C4_SEAL` in `test/card-cascade.test.js:918-950`: per touched file, the
   reveal-only imports, the `<SealBox>` count and the `revealedThrough` count,
   measured on `origin/main` BEFORE the first edit. If it fails, stop and ask.
   Never edit the literal to match.
8. Slice PRs say "Part of #1132", never "Closes #1132".

---

## The order, and what can run at the same time

```
N1 (Notice + pilot) ──┬─ N2 open-page errors ─────────────────────────────┐
                      ├─ N3 other open-page notices ──────────────────────┤
                      ├─ N4 shared error line (spoiler) ──────────────────┤
                      ├─ N5 delay, extras, postponed (spoiler) ───────────├─ N9 clean-up
                      └─ N6 pitcher frame 1 ─ N7 pitcher frame 2 ─ N8a ─ N8b ─ N8c ─┘
```

- **N2, N3, N4, N5 and N6** share no file with each other. Run them side by side
  once N1 is on `main`. (N3 edits `AllStarLegacyPage.jsx` and `GamePhotosPage.jsx`;
  N4 does not edit them. They are `AsyncStatus` callers, and N4 changes the line
  they call.)
- **N7 waits for N6.** Both edit `12-sealbox.css`: N6 moves the margins onto the
  event bars and the handoff cards, N7 deletes the old `--pbp` frame rule.
- **N8a, N8b and N8c wait for N7** and run one after the other. All three edit
  `12-sealbox.css` and `13-play-by-play.css`.
- **Run at most one spoiler slice at a time on the innings viewer.** N5, N6, N7
  and N8 all touch `components/inning/` or `components/playbyplay/`. N5 and N6 share
  no file, but a reviewer checking the innings viewer should see one change per PR.
- **N9 is last.** It deletes rules that only become dead once every site has
  moved.

---

## If Gary answers otherwise

| answer | what changes |
| --- | --- |
| Q1 = rail | N1's CSS draws a 3px left rule and no other edge. N6 to N8 get larger: the pitcher cards lose their box. The wording in `spec.md` section 13 flips for the delay card (no change) and for the pitcher family (a big change) |
| Q1 = per tone | N1 builds two frames. N1 grows by one test |
| Q2 = text stays | N2 and N4 vanish. `.hint--error` stays, and so does `AsyncStatus`'s line. `Notice` has about 40 sites. N3 loses its erase, club-list and All-Star lines |
| Q3 = out | N6 and N7 vanish. N8 stays (the rename is needed either way). The ledger rows become HOLDs. The `event` tone has one user (the postponed strip) |
| Q4 = three tones | merge `caution` into `error`; the photos notice announces as an alert. No slice changes |
| Q5 = move the tapes or the as-of banner | add a slice after N5; each needs a fifth look or a `dismiss`/two-action prop |

---

## The slices

### N1 — build `Notice`, and the pilot

Model and effort: Sonnet 5.5 (`claude-sonnet-5-5`), high. A new component with
a new CSS file, a class helper and a lab entry; the pilot is one line of text.

The paste-ready prompt is `prompt-n1.md` in this folder. Gary answered Q1 to Q5
on 2026-10-06 (`decisions.md`), so it builds to those answers and asks nothing.
It also lists what changed on `main` since this plan was measured (the Scout
restructure, 12 files instead of 10, three import-order pins).

- **Build:** `src/components/ui/state/Notice.jsx`,
  `src/styles/system/notice.css` (imported in `src/index.css` right after
  `system/empty-state.css`, line 69), `src/lib/design/noticeClass.js`,
  `test/notice-cascade.test.js` (pins the slot; an unknown `tone` or `size`
  throws; `label`, `icon` and `action` render only when given; `tone="error"`
  defaults to `role="alert"`; `Notice.jsx` and the helper import no `api/` and no
  stamp module; `notice.css` names no `--seal` token). A `/design-lab` entry:
  `screens/designlab/catalog.js` + `screens/designlab/components.jsx`.
  `src/components/ui/CLAUDE.md` gains one line for `Notice`.
- **Directory budget:** `styles/system/` goes from 11 to 12, the cap. Say so in
  the PR body: the next file there needs the `system/state/` subfolder
  (`spec.md`, section 5).
- **Pilot (1):** `.posterstudio__warn` on `screens/GamePreview.jsx:167`, a bare
  clay line that says sections overflow the poster. It is on an open page and
  needs no gate. Tone `caution`.
- **Why this pilot and not the delay card:** the delay card is on the innings
  viewer. It waits for N5.
- **Files (10):** the 7 above, `screens/GamePreview.jsx`,
  `styles/62-game-preview.css`, and `src/components/ui/CLAUDE.md`.
- **Routes:** `/design-lab?nointro` (the entry, at 390px and 740px),
  `/07072026/milstl-2/preview?nointro` (turn on three full sections: the
  warning shows when the poster overflows; not checked which sections do it).

### N2 — the bare error lines on open pages (Q2: box)

Model and effort: Sonnet 5.5 (`claude-sonnet-5-5`), medium. Nine sites on pages
outside the scoring scope; the same move nine times, with `role="alert"` where
the line was silent.

- **Rows (9):** `App.jsx` (the schedule and the not-found lines),
  `screens/FirstScorebookPage.jsx`, `screens/PostseasonSeriesPage.jsx`,
  `screens/postseason-live/LiveSeriesPage.jsx` (2 lines),
  `screens/scout/ScoutPage.jsx`, `screens/team/StampInPage.jsx`,
  `screens/game-notes/GameNotesArchivePage.jsx`. And the `.hint--error` hook in
  `styles/35-postseason-series.css:368`.
- **Files (9):** the 7 JSX files, `styles/35-postseason-series.css`,
  `test/notice-n2.test.js`.
- **Care — the hook:** `.psseries__entry .hint--error { grid-column: 1 / -1 }`
  reads the class by name. Pass a namespace class that carries that rule and
  change the selector. A grid child that loses it falls into one column.
- **Care — size:** the per-game lines in the series pages and Stamp In sit inside
  an article or a list row. Use `size="compact"`.
- **Care — role:** `App.jsx:648` already has `role="status"`; it becomes
  `alert` (the default). The other eight had none.
- **Care — Stamp In:** gated on the PAGE (ADR-0042). The line is copy only and
  renders no stamp art (ADR-0035).
- **Routes:** a bogus matchup, `/07072026/zzzaaa/lineup1?nointro` (the not-found
  line; inferred, not checked), the same page with `statsapi.mlb.com` failing
  (the schedule line), `/first-scorebook?nointro` (fail the archive),
  `/scout?nointro` (pick a pair, then fail the fetch), `/game-notes?nointro`
  (the CSV line), `/postseason/{seriesId}?nointro` and
  `/team/milwaukee-brewers-158/stamp-in?nointro` with the game fetch failing.

### N3 — the other open-page notices

Model and effort: Sonnet 5.5 (`claude-sonnet-5-5`), medium. Six sites; the one
shape that is new is the `label` plus text of the photos notice, which the lab
already proves.

- **Rows (6):** `.gamephotos__notice` on `screens/GamePhotosPage.jsx` and
  `screens/team/TeamPhotosPage.jsx` (tone `caution`, `label="Unsealed"`);
  `components/game/GameFinder.jsx:60` ("Pick two different teams", tone
  `caution`, `role="status"`); `components/profile/EraseDataDialog.jsx` (tone
  `error`); `screens/profile/sections/ClubSection.jsx:45`;
  `screens/AllStarLegacyPage.jsx:316` (an error that is grey today).
- **Files (8):** the 6 JSX files, `styles/14-strike-zone.css`,
  `test/notice-n3.test.js`. `styles/55-my-tally-account.css:302` keeps its margin
  rule (`.erasesheet__error`) as the namespace.
- **Care — the dashed edge:** `.gamephotos__notice` is dashed today. Keep
  `border-style: dashed` in its namespace rule so nothing changes on screen. The
  dashed-rule PR decides (`spec.md`, section 11). Say so in the PR body.
- **Care — role:** the photos notice is on the page at load: `role="note"`. The
  finder line appears after the reader acts: `role="status"`.
- **Routes:** `/photos?nointro` (shows at once; seen at N0), `/team/milwaukee-brewers-158/photos?nointro`,
  the game finder from the site menu (pick the same club twice), `/profile?nointro`
  (the erase sheet, with the account call failing; the club-list line shows only
  if the static file is missing: not checked), `/all-star-legacy?nointro`
  (fail the active-roster fetch).

### N4 — **spoiler**: the shared error line

Model and effort: Opus 5.5 (`claude-opus-5-5`), high. Three lines of code draw
the error of 39 `AsyncStatus` callers and 22 `AsyncGate()` pages, including the
slate and the lineup page. The edit is small and the blast radius is wide.

- **Rows (45):** `components/ui/AsyncGate.jsx` lines 29, 69 and 82 (the three
  error lines); the 39 `AsyncStatus` callers (no edit; they pass text); the slate
  card back (`components/game/PastGameFlipCard.jsx:106`); the Box Lines error
  (`components/boxlines/BoxLinesSheet.jsx:202`, with its Try again button as the
  `action`).
- **Files (5):** `components/ui/AsyncGate.jsx`,
  `components/game/PastGameFlipCard.jsx`, `components/boxlines/BoxLinesSheet.jsx`,
  `styles/boxlines/boxlines.css` (the `.boxlines__hint` error rule; the loading
  line keeps the class), `test/notice-n4.test.js`.
- **Change:** `AsyncStatus`'s two error branches render
  `<Notice tone="error" action={Retry}>` (the stale branch passes
  `role="status"`). `AsyncGate()`'s error branch renders the same. The loading
  branch (`Loader`) and the empty branch (`EmptyState`) do not change.
- **Care — the slate:** `screens/GameSelect.jsx:936` is a caller. The slate
  uppercases `.hint` through `.screen--slate .hint` (`styles/05-masthead-nav.css:649`);
  Notice text is uppercase everywhere (`01-base.css`), so nothing reads
  differently. A day with no games or a failed fetch carries no score; the test
  stays where it is.
- **Care — the lineup page:** `screens/GameView.jsx:354` passes
  `staleErrorMessage`. A stale error with the feed on screen is the one case
  where a Notice sits next to a revealed value. Check that the lineup page and
  the innings viewer render the same sealed or revealed state before and after.
- **Care — spacing:** `.hint` gave every caller `padding: 12px 2px` for free.
  `Notice` owns no margin. Walk every caller's route for a squeezed gap, and put
  any fix in that caller's namespace, not in `Notice`. `.player .hint`
  (`styles/26-player-page.css:52`) uppercases the player page's lines: the error
  line no longer wears `.hint`, so that rule has nothing to do there.
- **Care — the seal pin:** pin the touched files (`BoxLinesSheet.jsx`,
  `PastGameFlipCard.jsx`; `AsyncGate.jsx` has no `SealBox` and no
  `revealedThrough`) and the two scoring callers (`GameSelect.jsx`,
  `GameView.jsx`), which this slice does not edit.
- **Routes:** `/?nointro` with `statsapi.mlb.com` failing (seen at N0: bare clay
  text), `/standings?nointro` and `/attendance?nointro` with the API failing (the
  standings route did not show its error line at N0: not seen), a player and a
  team page for an id that does not exist (the `AsyncGate()` not-found line),
  `/07072026/milstl-2/lineup1?nointro` with the feed failing, and the slate's past
  game card after Reveal with the box fetch failing.

### N5 — **spoiler**: the delay card, the extra-innings line, the postponed strip

Model and effort: Opus 5.5 (`claude-opus-5-5`), high. Three members, each beside
a scoring surface; one is renamed (`.delaycard` → `.delay`); the delay card draws
OUTSIDE the seal for the half on screen.

- **Rows (3 sites, 3 selectors):** `.delaycard` (`components/inning/DelayCard.jsx:12`,
  tone `info`, `icon`), `.innings__extras` (`components/inning/ExtrasBanner.jsx:9`,
  tone `info`, `size="compact"`), `.postponed` (`components/game/GameCardParts.jsx:113`,
  tone `event`, `role="status"`).
- **Files (9):** `DelayCard.jsx`, `ExtrasBanner.jsx`, `GameCardParts.jsx`,
  `styles/27-player-position-innings.css`, `styles/11-innings.css`,
  `styles/06-loader-and-cards.css`, `styles/46-consent-modal.css`
  (`.animlab__frame .delaycard` reads the class), `screens/designlab/catalog.js`
  (the `delaycard` row names the class as data), `test/notice-n5.test.js`.
- **The rename:** `.delaycard` becomes the namespace `.delay`
  (`.delay__icon`, `.delay__title`, `.delay__detail`) and keeps its pop-in and
  its icon bubble. The ledger row `.delaycard → .notice--delay` is rewritten in
  N9 (`spec.md`, section 6).
- **Care — the visible change:** the delay card loses its 3px bar and its shadow
  (Q1). The extra-innings line changes face. Look at both at 390px and 900px.
- **Care — the dashed edge:** `.postponed` is dashed. Keep it in the namespace
  rule.
- **Care — the gates:** `selectDelays` and the half filter
  (`InningViewer.jsx:864-868`) stay byte for byte. `effInning > regulation`
  (`InningViewer.jsx:854`) stays. The `postponed &&` mount (`GameCard.jsx:291`)
  stays. The copy does not change: it names a stoppage, a season record or a
  make-up date, never a result (ADR-0060).
- **Care — the second delay design:** the in-feed `DelayNotice`
  (`EventCards.jsx:229`) is NOT this card. It moves in N6.
- **Routes:** `/animation-lab?nointro` (the delay card, rain and pause; seen at
  N0 with the pop-in frozen). No delay game is in `docs/test-games.md`; find one
  with `selectDelays` output (not checked). The extra-innings line:
  `/05272025/bosmil/top10?nointro` (the walk-off game, `docs/test-games.md`; step
  to the 10th). The postponed strip: a slate date with a postponed game (not
  checked); the markup was injected at N0.

### N6 — **spoiler**: the pitcher frame, part 1

Model and effort: Opus 5.5 (`claude-opus-5-5`), high. Six sites on the innings
viewer. It introduces the helper into the feed's cards while the old frame rule
is still there.

- **Rows (6):** the four one-line bars in `components/playbyplay/EventCards.jsx`
  (mound visit, ejection, baserunning event, the in-feed DELAY) and the two
  handoff frames in `components/playbyplay/PitcherHandoffCard.jsx`.
- **Files (4):** `EventCards.jsx`, `PitcherHandoffCard.jsx`, `styles/12-sealbox.css`,
  `test/notice-n6.test.js`.
- **Change:** each root takes `noticeClass({ tone: 'event' })` instead of
  `pitchernotice--pbp`. The frame's `margin: 4px 14px` moves to the bar's
  namespace (`.pitchernotice--event`) and to `.pitcherhandoff`. The `--pbp` rule
  stays in `12-sealbox.css` for the actor cards that still wear it.
- **Care — identical pixels:** the old frame is a 1px `--border-rule` edge, a
  16% `--marker` wash and `--radius-sm`; the event tone draws the same values.
  Compare screenshots before and after.
- **Care — the seal pin:** `EventCards.jsx` and `PitcherHandoffCard.jsx` import
  no reveal-only module today (verify). Pin that.
- **Routes:** `/07072026/milstl-2/top6?nointro` and `/top7?nointro` (a mound
  visit, a pinch runner, two handoff cards; seen at N0, with a reveal mark in
  `localStorage`, the way a reader's device holds it). An ejection, a steal and a
  delay card need another game (not checked).

### N7 — **spoiler**: the pitcher frame, part 2

Model and effort: Opus 5.5 (`claude-opus-5-5`), high. The actor cards, the lens
button and the deletion of the old frame; one console rule and one test pin the
old class by name.

- **Rows (5 sites):** the roots of `PitcherNotice.jsx`, `BatterNotice.jsx`,
  `FielderNotice.jsx` and `PinchRunNotice.jsx`, and the arm button in
  `components/scoring/lens/LensCards.jsx:37`.
- **Files (9):** the 5 JSX files, `styles/12-sealbox.css` (delete `.pitchernotice--pbp`),
  `styles/focus/console.css` (the `:has(.pitchernotice--pbp)` rule at line 120),
  `test/card-cascade.test.js` (the pin at line 905), `test/notice-n7.test.js`.
- **Change:** each root takes `noticeClass({ tone: 'event' })`. The callers keep
  passing `className="pitchernotice--pbp"` for now; it is a dead class until N8c.
  `ArmNotice` stays a `<button>`.
- **Care — the console rule:** `.innings--focus … .half:has(.pitchernotice--pbp):not(:has(.statgrid))`
  hides the card's chrome in the console. It must key on the new frame class in
  the same commit, or the console loses its layout with no error. Update the
  `card-cascade` pin by changing the selector it looks for, never by loosening
  the assertion.
- **Care — the full card:** `PitcherCard` (`pitcherCard/`) is not edited. It
  renders `PitcherNotice` as its header and receives the frame through
  `className`. Check that the full card (about 600px tall) keeps its frame at
  390px and 900px.
- **Care — the seal pin:** pin `HalfInning.jsx` and `PlayByPlay.jsx` too, even
  though N7 does not edit them: a frame change must not move their gates.
- **Routes:** `/07072026/milstl-2/top1?nointro` (the full card), `top2`
  (the persistent header), `top6` (batter), `bottom6` (fielders), `top7`
  (pinch runner), and the scorecard lens on a phone, `/07072026/milstl-2/scorecard?nointro`
  (the arm button and the pitcher sheet; not checked). The console (focus mode)
  at 900px.

### N8a, N8b, N8c — **spoiler**: the pitcher rename (ADR-0084)

Model and effort: Sonnet 5.5 (`claude-sonnet-5-5`), high. A mechanical rename
that changes no pixel; the risk is a class that exists only at run time or in a
comment. Run them in order.

The new namespace (no shape word) is picked before N8a: `.moment` or `.change`
(`decisions.md`, Q3). Every row below says "rename only".

- **N8a — the headshot well.** Rows: `.pitchernotice__shot`, `__shot--logo`,
  `__shot--fallback` and the 3 sites in `PitcherNotice.jsx:113-137`. Files (5):
  `PitcherNotice.jsx`, `styles/12-sealbox.css`, `styles/13-play-by-play.css:60`,
  `styles/focus/atbat.css:28-38`, `tokens/layout.css:19` (a comment).
- **N8b — the event bar parts.** Rows: `__code`, `__code--alert`, `__label`,
  `__teammark`, `__spacer`, `__mvcount`, `__eventtext`, `__pitchno`. Files (4):
  `EventCards.jsx` (the inner spans fold into the four bar sites, so the census
  lists no site row), `styles/12-sealbox.css`, `styles/13-play-by-play.css:415`,
  `styles/01-base.css:49` (a comment).
- **N8c — the root, the body and the callers.** Rows: `.pitchernotice`,
  `__badges`, `__body`, `__entering*`, `__flag`, `__forline`, `__hand`,
  `__jersey`, `__now`, `__pitcher`, `__prtag`, and the 19 sites. The callers
  (`HalfInning.jsx`, `PlayByPlay.jsx`, `PitcherSheet.jsx`) drop the dead
  `className="pitchernotice--pbp"`. Files (12): `PitcherNotice.jsx`,
  `BatterNotice.jsx`, `FielderNotice.jsx`, `PinchRunNotice.jsx`,
  `PitcherHandoffCard.jsx`, `LensCards.jsx`, `PitcherSheet.jsx`, `HalfInning.jsx`,
  `PlayByPlay.jsx`, `styles/12-sealbox.css`, `styles/pitcher-card/card.css`,
  `styles/scorecard/lens-cards.css`.
- **Left for N9:** the comment-only mentions in `21a-box-score-stars.css:123`,
  `postseason/series-live.css:91`, `lib/design/contrastPairings.js:233`, and the
  prose in `src/components/playbyplay/CLAUDE.md`, ADR-0017 and the naming
  ledger. (The ledger's `†` means "named only in a comment"; no script reads
  these files by name.)
- **Care — run-time classes:** `rg 'pitchernotice'` over `src/`, `e2e/`,
  `test/`, `scripts/` and `api/` before each PR and after. ADR-0084's note about
  `pitcherhandoff__chip--${…}` applies to this family's neighbours: look for
  template strings.
- **Care — the pin:** `test/card-cascade.test.js` keeps its seal pin and gains
  the new names. Never loosen it.
- **Routes:** the same as N7.

### N9 — clean-up

Model and effort: Sonnet 5.5 (`claude-sonnet-5-5`), high. Mostly mechanical, but
it merges nine slices' census edits and decides which rules are dead by reading
each one.

- Delete `.hint--error` from `styles/05-masthead-nav.css:613` **only if** no
  site wears it. Five dev pages still do (`UniformNamesPage`, `ScorecardLab`,
  `ColorLabBody`, `DugoutRail`, `milb.jsx`). The tool hold keeps the rule; say so.
- Delete the `.screen--slate .hint` rule (`05-masthead-nav.css:649`) if no slate
  `.hint` is left, and `.hint__link` (no use in `src`, `e2e`, `test`, `scripts` or
  `api`; check again).
- Re-run the census. Delete any candidate rule that no site wears. Keep every
  rule a held page wears.
- Lower `check-raw-values` and `check-caption-budget` budgets for what the
  slices deleted (#1178).
- Fix the docs: `src/components/ui/CLAUDE.md` (`state/` names `Notice`),
  `src/components/playbyplay/CLAUDE.md` (the card's new name),
  `docs/design-system-naming.md` (the two rows and the 157-class count),
  ADR-0017's prose, and a short addendum to ADR-0084 for the two rows that did
  not fit.
- `src/styles/system/` is at 12 files. If the next family needs a 13th, the
  subfolder move is its job (`spec.md`, section 5).
- Post the status on #1132: what moved (by slice and PR), what is held and why
  (Q5), the rules deleted, the budgets before and after, and the "not seen live"
  list. Say that the dashed-rule fix is the last item.

---

## N1 as built (what the next slices need)

Written by the N1 session. It records what shipped. It does not write the prompts
for N2 to N8.

1. **The API as built.**
   - `src/components/ui/state/Notice.jsx` exports `Notice({ tone, label, icon,
     action, size, className, role, children, ...rest })`. The root is
     `div.notice.notice--{tone}.notice--{size}` plus `className`, with
     `notice__icon` (a `span`, always `aria-hidden`), `notice__body` (holding
     `notice__label` and `p.notice__text`) and `notice__action`. The icon, the
     label and the action render only when given.
   - `src/lib/design/noticeClass.js` exports `TONES` (`info`, `event`,
     `caution`, `error`), `SIZES` (`block`, `compact`), `noticeClass({ tone,
     size, className })` and `noticeParts({ tone, size, className, label, icon,
     action })`. The defaults are `info` and `block`. An unknown tone or size
     throws. `noticeClass` returns the root string for a caller that owns its
     root (N6 and N7). `noticeParts` returns `{ root, role, label, icon, action }`.
   - **Role.** `noticeParts` says `role: 'alert'` for the error tone and
     `undefined` for the rest. `Notice` writes `role={role ?? parts.role}`, so any
     role the caller passes wins, and an explicit `role={undefined}` keeps the
     default. N2 and N4 pass `role="status"` where a line is stale or follows an
     action.
   - **CSS** (`src/styles/system/notice.css`, 12 rules). A tone sets
     `--notice-edge`, `--notice-wash` and `--notice-ink`. `caution` also sets
     `--notice-label` (clay-deep over body ink). The root is `display: flex`,
     wrapping, centred: a long sentence pushes the action under it on a phone.
     The text is the body face at `--fs-small`, semibold. There is no shadow, no
     dashed edge, no rail and no `--seal`. Margin is `0` on the root and the text.
   - **Children are phrasing content.** The sentence sits inside a `<p>`, as in
     `EmptyState`. A site with a list or a block child needs a different shape
     (N3 and N4 check their callers). `tone` and `size` take `undefined` for the
     default; a `null` is a caller typo and throws.
2. **The three pins moved.** `test/empty-state-cascade.test.js` (only
   `notice.css` sits between `empty-state.css` and 06), `test/card-cascade.test.js`
   (`table.css`, `empty-state.css`, `notice.css` between `card.css` and 06) and
   `test/table-cascade.test.js` (`empty-state.css`, `notice.css` between
   `table.css` and 06). Each is as strict as before: a `deepEqual` on the exact
   list. The next family partial adds its name to the same three lists, and the
   `notice-cascade` pin pins "right before 06" the way the others do.
3. **The pilot needed no namespace.** `.posterstudio__panel` is a grid with
   `gap: var(--space-3)`, so the `Notice` takes its space from the grid. The
   `.posterstudio__warn` rule had only a margin reset and four declarations the
   Notice now draws, so the rule and the class are gone. No raw value left with
   it, so no `check-raw-values` budget moved. Lesson for N2 to N7: read the
   parent first. A grid or `Stack` parent needs no namespace margin. A block
   parent does (the old `.hint` gave `padding: 12px 2px` for free).
4. **The pilot line cannot show today.** `posterLayout(...).overflows` is true
   only when the stack is taller than 1044px. The tallest stack (all three
   blocks, nine lineup rows) is 958px, plus four gaps of 20px, so 1038px. The
   line never shows with the current constants. I saw it by rewriting
   `headHeight` from 500 to 700 in the browser only (a `page.route` on
   `posterLayout.js`; the repo is unchanged). The copy and the component are the
   real ones. A later slice may decide whether to delete the dead line.
5. **The census counts `<Notice` as a site.** A `<Notice` element is a candidate
   tag (the two research diary pages define a local `Notice`; spec section 12,
   item 6). Adding the lab demos shifted the keys of a lab file: the old
   `screens/designlab/components.jsx#1` (the AsyncStatus demo) became `#6`.
   Rows `#1` to `#5` are the Notice demos, job `tool`, HOLD. A later slice that
   adds a `<Notice` above an old row in a file must re-key the rows below it:
   read the STALE and UNREVIEWED lists together.
6. **The seal guard reads prose.** `check-seal-scope.mjs` fails on the literal
   `--seal` in a `CLAUDE.md` outside `src/styles/`. Say "seal token" in docs.
7. **Not done in N1** (outside the file list): the contrast pairs of spec section
   14 are not in `src/lib/design/contrastPairings.js`. Only `clay-deep` on
   `clay-soft` is asserted today. The slice that first puts a `caution`, `info`
   or `event` Notice on a scoring surface should add its pair.
8. **Directory budget.** `src/styles/system/` is now at 12 files, the cap. The
   next file there needs the `system/state/` subfolder (spec section 5): move
   `empty-state.css` and `notice.css`, and edit `src/index.css` and the pins in
   `test/empty-state-cascade.test.js` and `test/notice-cascade.test.js`.

## N7 as built (what the next slices need)

Written by the N7 session. It records what shipped. It does not write the prompts
for N8.

1. **The plan was wrong; the frame stays the caller's.** `PitcherNotice` is also the
   bare header inside the full card (`pitcherCard/PitcherCard.jsx`, inside
   `div.pcard ${className}`). A frame on the four role roots would draw a card in
   the card. The four roots (`PitcherNotice`, `BatterNotice`, `FielderNotice`,
   `PinchRunNotice`) are not edited. Every call site passed a frame class; none
   passed nothing.
2. **The call sites (9 + 1).** Each passes
   `className={noticeClass({ tone: 'event', className: 'pitchernotice--pbp' })}`:
   `HalfInning.jsx` 3 (the Now Pitching card, the staged batter, the staged
   fielder), `PlayByPlay.jsx` 4 (mid-half pitcher, fielder, pinch runner, pinch
   hitter), `PitcherSheet.jsx` 1, `PitcherNotice.jsx` 1 (`ReliefRepeat`). `ArmNotice`
   is `` `pitchernotice ${noticeClass({ tone: 'event', className: 'pitchernotice--pbp' })} sc-armnotice` ``,
   still one `<button>`. A repeated call, as N6 did; no constant.
3. **The namespace rule.** `.pitchernotice--pbp` (`12-sealbox.css`) is now
   `margin: var(--space-1) var(--space-3h)` and `flex-wrap: nowrap`. The padding,
   edge, radius and wash left it. N8c renames it and drops the callers' class.
   The batter, fielder and pinch-runner roots are never rendered bare, so N8c may
   move the frame onto those three roots; `PitcherNotice` must keep it at the caller.
4. **The full card.** `.pcard` (`pitcher-card/card.css`) adds `flex-wrap: nowrap`
   and `align-items: stretch`; its gap stays `var(--space-2h)` (card.css loads after
   `.notice`). The computed `align-items` on `.pcard` reads `stretch` where it read
   `normal`. In a flex column `normal` acts as `stretch`; the geometry is identical
   (N6 saw the same on the handoff cards).
5. **The console.** `styles/focus/console.css` says
   `.half:has(.notice--event):not(:has(.statgrid))`. The pin in
   `test/card-cascade.test.js` looks for that selector. Seen at 900px: the rule fires
   on the sealed `top1`, `bottom6` and `top7` (a staged card only) on `main` and on
   this branch, and the half's chrome comes back once a stat grid shows.
6. **The seal pin** (`test/notice-n7.test.js`, measured on `f150612ab`):
   `HalfInning.jsx` imports `boxscore.js`, `highlights.js`, `hitchart.js` and
   `playbyplay.js`, 1 `<SealBox`, 12 `revealedThrough`. `PlayByPlay.jsx` imports
   `playbyplay.js`, no `<SealBox`, 1 `revealedThrough`. `ScorecardPage.jsx`: no
   reveal-only import, no `<SealBox`, 7 `revealedThrough`. `PitcherSheet.jsx`,
   `PitcherNotice.jsx`, `LensCards.jsx`, `PitcherCard.jsx`, `BatterNotice.jsx`,
   `FielderNotice.jsx` and `PinchRunNotice.jsx`: none, 0, 0.
7. **`flex-wrap: nowrap` against `.notice`: six namespaces now.** N5: `.delay`,
   `.innings__extras`. N6: `.pitchernotice--event`, `.pitcherhandoff`. N7:
   `.pitchernotice--pbp`, `.pcard`. A Notice-level fix needs Gary.
8. **Seen** (mock anchor game 823035, `main` and this branch side by side, each
   side captured twice first and stable; reduced motion so the pitch scene holds
   still): geometry, page text and the reveal mark identical on 26 views:
   `top1`, `top2`, `top6`, `bottom6`, `top7` sealed and open, `top8` open, at 390 and
   900px; `top6` stepped once and twice (`ReliefRepeat`, a mid-half pinch hitter) at
   390px; the scorecard lens at 390px with the arm button, and with the pitcher
   sheet open. Computed colour, fill, edge, radius, padding, margin, gap and wrap
   are the same on every card kind. **Not seen:** a pre-pitch staged pinch hitter
   (`HalfInning`'s `BatterNotice`; this game has none). The live feed was not loaded.
9. **Census.** No key moved. The four role-root rows and `LensCards.jsx#1` say
   DONE in N7 with the reason; the nine call-site rows say they carry the frame.
   The STALE keys are N6's list, unchanged.

## N6 as built (what the next slices need)

Written by the N6 session. It records what shipped. It does not write the prompts
for N7 and N8.

1. **The roots.** The four event bars in `EventCards.jsx` are
   `` `pitchernotice ${noticeClass({ tone: 'event' })} pitchernotice--event` ``
   (the mound visit adds `pitchernotice--mv`). The two handoff cards are
   `<Stack gap="snug" className={noticeClass({ tone: 'event', className: 'pitcherhandoff' })}>`.
   No root wears `pitchernotice--pbp` now. The inner `div.pitchernotice` header
   row and the table did not change. This is the first production caller of
   `noticeClass`.
2. **The namespace rules** (`styles/12-sealbox.css`). `.pitchernotice--event` is
   `margin: var(--space-1) var(--space-3h)` (4px 14px, as tokens, so no
   `check-raw-values` budget moved), `flex-wrap: nowrap` and its old
   `gap: var(--space-2)`. `.pitcherhandoff` is a new rule: the same margin,
   `flex-wrap: nowrap` and `align-items: stretch`. The `.pitchernotice--pbp` rule
   and its actor-card callers did not change.
3. **The wrap and the stack.** `.notice` wraps; the bars must not, so both
   namespaces say `nowrap` (N5's trap, item 2 there). On the handoff cards
   `.notice` loads after `stack.css` and says `align-items: center`, which would
   shrink the table; `stretch` keeps it full width. The computed value on those
   two roots reads `stretch` where it read `normal` before. In flexbox `normal`
   acts as `stretch`, and the geometry is identical. The gap stays 8px: `.notice`
   says `var(--space-2)`, the same as Stack's "snug".
4. **The colour.** `.notice` sets `color: var(--text-body)`. The roots inherited
   the same `rgb(27, 42, 58)` before, so no namespace needed a colour rule.
5. **The console trap fired.** `HalfInning.jsx` renders the "Final line" card
   (`FinalizedLineCard`) ABOVE the seal, not from the feed. `nowPitching` reads the
   half's first play. In a live game between halves the next half has no play
   yet, so the Now Pitching card does not render, and `closingPitcher` compares
   against `undefined`, so the "Final line" card can be the ONLY card in `.half`.
   Seen: the anchor feed trimmed in the browser to the end of the 6th, mark 11,
   `/top7` at 900px. The old selector did not match (a card in a card); the new
   one does. `styles/focus/console.css` now says
   `.half:has(.pitchernotice--pbp, .notice--event):not(:has(.statgrid))`, and the
   pin in `test/card-cascade.test.js` looks for that selector. N7 can drop
   `.pitchernotice--pbp` from the list when it deletes the rule: every actor card
   then wears `.notice--event`.
6. **The seal pin** (`test/notice-n6.test.js`, measured on `118f08809`):
   `EventCards.jsx` and `PitcherHandoffCard.jsx` have no reveal-only import, no
   `<SealBox` and no `revealedThrough`. `PlayByPlay.jsx` imports `playbyplay.js`,
   has no `<SealBox` and 1 `revealedThrough`. `HalfInning.jsx` imports
   `boxscore.js`, `highlights.js`, `hitchart.js` and `playbyplay.js`, has 1
   `<SealBox` and 12 `revealedThrough`.
7. **Census.** The census reads the literal `'event'` in the new className as a
   class (`.event` on the four bar rows). The two Stack roots are no longer
   census sites (their className has no candidate class), so the handoff keys
   moved: old `#2`, `#3`, `#5` are now `#1`, `#2`, `#3`. The two DONE root rows
   are `#` comment lines in `overrides.tsv`. The STALE keys left are not N6's
   (`.gamephotos__noticetag`, `.xl-film__msg`, `.xl__prerollmsg`,
   `PitcherNotice.jsx#10`, three `ExpressLanePage.jsx` keys, `StampInPage.jsx#1`).
8. **Seen.** Geometry, element by element, the same before and after (`main` and
   this branch served side by side, each route twice): the anchor game
   (`/07072026/milstl-2/top6` and `/top7`, sealed with the mark at 9 and 11, and
   open with the mark at 99 and the whole half shown) at 390 and 900px, mocked and
   live; the in-feed DELAY bar live on 778107 (bottom 4th), 778087 (top 1st) and
   778108 (top 8th); a steal bar (SB) live on 778087 (top 1st). **Not seen:** an
   ejection bar.
9. **Docs.** `components/playbyplay/CLAUDE.md`, the header comment of
   `EventCards.jsx` and the tier-2/3 comment in `12-sealbox.css` now say the
   event bars and handoff cards take the event Notice frame, and the actor cards
   wear `.pitchernotice--pbp` until N7. N7 updates those three lines again.
10. **Review items left open.** `.notice` makes each owning namespace undo
   `flex-wrap: wrap` (N5 twice, N6 twice). A Notice-level fix needs Gary.
   On the handoff cards, `Stack`'s `gap="snug"` does nothing now (`.notice`'s
   gap wins, the same 8px); the test pins that the two stay equal.

## N5 as built (what the next slices need)

Written by the N5 session. It records what shipped. It does not write the prompts
for N6 to N8.

1. **Two members moved; the postponed strip is held.**
   - The delay card is `<Notice tone="info" role="note" className="delay"
     icon={glyph} label={title}>`. The namespace `.delaycard` is now `.delay`
     (`styles/27-player-position-innings.css`). It has no `__` part: Notice's
     parts replaced `__icon`, `__body`, `__title` and `__detail`. `.delay` keeps
     the margin, the `delay-pop` pop-in and its reduced-motion rule, and
     `flex-wrap: nowrap`. `.delay .notice__icon` keeps the 38px round bubble.
     `.delay b` keeps the mono face on the duration. The Animation Lab freeze
     list says `.animlab__frame .delay`. The design lab row is
     `cls: 'notice notice--info notice--block delay'`.
   - The extra-innings line is `<Notice tone="info" size="compact" role="note"
     className="innings__extras" icon="⚾️">`. `.innings__extras` keeps
     `margin: 0 0 10px` and `flex-wrap: nowrap`. `.innings__extras-team` stays.
     `.innings__extras-icon` is gone.
   - **The postponed strip is HOLD (the fallback).** Notice puts its label ABOVE
     the text. The strip puts the stamp in a ROW beside two stacked lines. A port
     needs a row-layout rule on `.notice__body`, a padding override and display
     rules on both lines. That is more than namespace rules for the stamp and the
     motion, so N5 did not force it. `GameCardParts.jsx` and
     `06-loader-and-cards.css` are unchanged. A later slice can move it with a
     Notice layout option, or after the dashed-rule PR.
2. **A Notice with an icon and no action must not wrap.** `.notice` is
   `flex-wrap: wrap` and `.notice__body` is `flex: 1 1 auto`. A long sentence
   then wraps the whole body under the icon. At 390px the extras line drew the
   ball alone on one row. Both N5 namespaces set `flex-wrap: nowrap`. The fix
   cannot go in `notice.css` as a `:not(:has(.notice__action))` rule:
   `notice-cascade.test.js` pins every rule there as one class at one weight.
   N6 and N7: a Notice with an icon needs the same line, or a Notice-level fix
   that Gary approves.
3. **The seal pin** (`test/notice-n5.test.js`, measured on `608c6062e`):
   `DelayCard.jsx`, `ExtrasBanner.jsx`, `GameCardParts.jsx` and `GameCard.jsx`
   have no reveal-only import, no `<SealBox` and no `revealedThrough`.
   `InningViewer.jsx` imports `winprob.js`, has no `<SealBox` and has 15
   `revealedThrough` reads. The three gates are pinned as source snippets.
4. **Contrast.** `contrastPairings.js` now asserts `text-body` and
   `text-caption` on `#EBE8DD` (the info wash, by hand). The caption pair is
   4.72:1, a thin margin. N1's item 7 asked for this.
5. **Seen live.** Delay card: STL@CIN 2025-05-01 (gamePk 778107, bottom 4th,
   rain, 1 hr 36 min), MIN@CLE 2025-05-01 (778108: top 7th 16 min, top 8th
   2 hr 5 min, none on top 6th) and WSH@CIN 2025-05-02 (778087, top 1st,
   "Inclement Weather", 2 hr 19 min). Extras line: LAD@SF 2026-09-27 (823164,
   top 10th; the 2025 walk-off game has no callout bundle, so its line does not
   render, on `main` too). Page text outside the notice and the reveal mark were
   the same before and after on 9 routes at 320, 390 and 900px. **Not seen:**
   the "Delay in progress" copy on a live game (seen only in the Animation Lab).
   The postponed strip did not change, so I did not load it.
6. **Census.** The STALE keys left on `main` are not N5's: `.xl-film__msg`,
   `.xl__prerollmsg`, three `ExpressLanePage.jsx` keys and
   `PitcherNotice.jsx#10`. `.xl-film__mark` and `.xl-film__mark--over` are
   UNREVIEWED. N5 added a row for `.notice__icon` (seen through
   `.delay .notice__icon`).
---

## N4 as built (what the next slices need)

Written by the N4 session. It records what shipped. It does not write the prompts
for N5 to N8.

1. **The namespace class is `asyncstatus__notice`.** AsyncStatus's two error
   Notices and AsyncGate()'s page error wear it. Its one rule,
   `margin: var(--space-3) 0`, is in `styles/08-site-shell.css` (a sixth file). It
   must load after `system/notice.css`: `05-masthead-nav.css` (where `.hint` lives)
   loads before it, so `.notice { margin: 0 }` would win there. It first went into
   06, next to the loader, but 06 is at its 800-line cap and a cap never goes up
   (`scripts/CLAUDE.md`), so it moved to 08, the screen shell. The old line was a `<p>` with the
   browser's 1em margin plus the `.hint` padding. The box's own padding takes the
   place of that margin, so the text sits within a few px of where it was.
2. **Parents.** Every one of the 36 callers sits in a block parent (29 on
   `.screen`, 2 in the team hub shell, 3 in a photos section, the slate's
   `.slatebody__main`, one lab `Entry`). The one shared margin keeps the gap the old
   padding gave to all of them, so no caller needed its own rule. Box Lines took
   `.boxlines__notice` (the same margin as `.boxlines__empty`; two rules, because
   `test/empty-state-e3.test.js` reads `.boxlines__empty` as a lone selector). The
   slate card back needs no namespace: the Notice fills the top of the card's slot.
3. **Roles.** Cold error and AsyncGate(): the error default (`alert`). Stale
   error: `status`. Slate card back: `note` (static, like the old line), because
   Reveal all turns every card at once. Box Lines: `alert`. The Retry and Try again
   are a plain `Button` (tap size, 44px): `btn--control` is 34px with no larger
   tap area.
4. **The seal pin** (`test/notice-n4.test.js`, measured at `608c6062e`). Every
   pinned file has no reveal-only import, no `<SealBox`, and no `revealedThrough`
   read: `BoxLinesSheet.jsx`, `PastGameFlipCard.jsx`, `AsyncGate.jsx`,
   `GameSelect.jsx`, `GameView.jsx`. All zeros would pin little, so the pin also
   lists each file's other gated api/ imports: `boxlines/fetch.js`;
   none; none; `postseason/text.js`; `postseason/bracket.js` and
   `postseason/text.js`. A browser check of the lineup page, top 1st, bottom 2nd
   and the box score (sealed, and after a tap) read the same before and after.
5. **Three old pins flipped.** `empty-state-e2`, `-e3` and `-e9` asserted that
   the error lines stayed `.hint`. They now assert the Notice, with the same
   counts. The EmptyState census's overrides were re-keyed too (its
   `BoxLinesSheet.jsx#3` is `#2` now; its five N4 error rows became comment lines).
6. **Not reached** (a failed request does not show them): most `AsyncStatus`
   pages read a static file whose loader turns a failure into the empty state
   (standings, attendance, the report boards, the team hub tabs, the photos
   pages). AsyncGate()'s "Couldn't load this {noun}" branch was not seen either:
   a failed person fetch reads as "not found". Seen: the slate, the lineup page
   (cold and stale), the player and team not-found pages, the slate card back,
   the Box Lines sheet, and the lab.
---

## N3 as built (what the next slices need)

Written by the N3 session. It records what shipped. It does not write the prompts
for N4 to N8.

1. **Six sites moved.** Both photos pages (`tone="caution" label="Unsealed"
   role="note"`), the game finder (`caution`, `role="status"`, `size="compact"`),
   the erase-failed line (`error`, `role="status"`), the club-list line (`error`,
   `role="note"`) and the All-Star Legacy line (`error`, `role="status"`). The
   All-Star line was grey and is now an error: a deliberate change.
2. **Namespace classes.** `.gamephotos__notice` (14-strike-zone.css) keeps the
   margin `4px 0 space-4` and `border-style: dashed`. The dashed edge stays so
   nothing changes on screen; the dashed-rule PR decides (spec section 11). The
   tag and paragraph rules are deleted. `.erasesheet__error`
   (55-my-tally-account.css) stays margin-only. `.gamefinder__notice` (08-site-shell.css) and
   `.mytally__notice` (54-my-tally.css) are margin-top only: the parent gave no
   gap. The All-Star line needs none (the section title's margin is enough).
3. **Caps-exempt selectors widened** in 54-my-tally.css: `#root .erasesheet
   .notice__text` and `#root .mytally .notice__text`, under the one existing
   `/* caps-exempt: ... */` marker. A class on the Notice root does not reach the
   inner `<p>`, so any later Notice inside `.mytally` or `.erasesheet` is
   mixed-case too.
4. **Spacing.** The old `.hint` gave `padding: 12px 2px`. See the PR for what
   each parent gives now.
5. **One extra file.** `test/empty-state-e6.test.js` pinned the finder's old
   `<p className="hint">`. It now pins the Notice and still forbids an
   EmptyState there.
6. **Not reached:** the club-list line (needs the static club file to be
   missing) and the erase-failed line (needs a signed-in account whose erase
   call fails). Both are pinned by `test/notice-n3.test.js` only.
7. **Census.** No key shifted. `.gamephotos__noticetag` prints STALE (its rule is
   deleted, as planned). The other STALE keys are not N3's.
---

## N2 as built (what the next slices need)

Written by the N2 session. It records what shipped. It does not write the prompts
for N3 to N8.

1. **Nine lines moved**, all `<Notice tone="error">`: `App.jsx` (schedule, not
   found), `FirstScorebookPage`, `PostseasonSeriesPage` and `LiveSeriesPage` (the
   per-game line, `size="compact"`), `LiveSeriesPage` (leaders and rosters),
   `ScoutPage`, `StampInPage` (`size="compact"`, no namespace: it sits in a list
   row that pads itself) and `GameNotesArchivePage` (`role="status"` kept: it
   follows an action). The sentences and the tests that decide WHEN a line shows
   did not change. The schedule line lost its `role="status"` and is now the
   default alert.
2. **Namespace classes.** `appstate__notice` (`02-app-shell.css`),
   `scorebookstory__notice` (`42-first-scorebook.css`), `pslive__notice`
   (`postseason/series-live.css`), `scout__notice` (`scout/scout.css`),
   `gnotes__notice` (`report/game-notes.css`). Each is one rule,
   `margin: var(--space-3) 0`: the 12px the old `.hint` padding gave. Every one of
   those parents is a block (`.screen`), so none had a grid or Stack to give the
   space. That is five CSS files beyond the nine the slice listed; the slice
   could not keep the old spacing otherwise.
3. **The grid hook.** `.psseries__entry .psseries__entryerror { grid-column: 1 / -1 }`
   replaces the `.hint--error` selector in `35-postseason-series.css`. The Notice
   is a DIRECT child of `article.psseries__entry` on both series pages (a ternary
   branch, no wrapper), so the rule still reaches it. `.hint--error` in
   `05-masthead-nav.css` stays: five dev pages wear it (N9).
4. **`.pslive > *` zeroes the bottom margin** in the 740px grid, at the same
   specificity as `.pslive__notice`, so the rule sits BEFORE the media block and
   the grid zeroes the notice's bottom margin too (the review caught the first
   order).
5. **Census.** A `<Notice>` with no candidate class is not a census site, so the
   per-game lines (no rule draws them) and the plain loading `.hint` of the live
   page left the census. Their override rows are gone:
   `PostseasonSeriesPage#2` (the line), `LiveSeriesPage#2` and `#3` (the game
   line and the loading hint), `StampInPage#1`. `PostseasonSeriesPage#3` is now
   `#2` (the MVP band) and `LiveSeriesPage#4` is now `#2` (the leaders line).
   The six rows that still match say "DONE in N2". After the run, the one STALE
   key is `components/playbyplay/PitcherNotice.jsx#10`, as on `main`. It is not
   N2's. A run while `npm test` or the build is running can print a long STALE
   list, because the EmptyState hand-off fails under load: run it again alone.
6. **Order trap.** `system/notice.css` loads right before `06`, and its root says
   `margin: 0`. A namespace rule in a partial numbered BEFORE 06 (`02-app-shell.css`)
   loses on order at one class, so `.screen .appstate__notice` has two. The other
   four load later and use one class. N3 to N8: check where your partial sits.
7. **Seen in the browser** (390px and 900px, `statsapi.mlb.com` or the data file
   answered with 500 through `page.route`; nothing edited): seven of the nine
   lines (both App lines, the archive, a series entry, Scout, Stamp In and the
   CSV line). **Not seen:** the two `LiveSeriesPage` lines (the per-game line and
   leaders and rosters). No live series was open to load. Their markup matches
   the final series page's per-game line and the `pslive__notice` rule is pinned
   by `test/notice-n2.test.js`.
