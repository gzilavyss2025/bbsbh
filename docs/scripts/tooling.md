# scripts — the lint-guard catalog and the local reporters

Reference moved out of `scripts/CLAUDE.md`. That file keeps the rules.

## The staleness verdicts (`worktrees.mjs`)

The staleness verdicts are pure and unit-tested in
`test/worktrees.test.js`; four cases there are non-obvious and were all live
bugs. A freshly branched worktree is an ancestor of `origin/main` and so looks
merged; requiring commits-ahead to tell those apart flips it and mislabels
every genuinely merged branch; tip-equality (`HEAD == origin/main`) only holds
until `main` next moves, after which every already-open fresh worktree
reclassifies as merged — so freshness is decided by membership of `main`'s
**first-parent chain**, which is stable as `main` advances; and the upstream
must be read with
`for-each-ref`, never `@{u}`, because `@{u}` stops resolving the moment the
remote branch is deleted — which is the end state of every squash-merged PR,
so `@{u}` reports "no upstream" for precisely the worktrees this script
exists to find. That last one shipped in #312 and made the
upstream-deleted branch unreachable dead code.

## The lint guards

`check-all.mjs` runs every guard in its `GUARDS` list. The rules every guard follows are in
`scripts/CLAUDE.md`; the CSS and JSX exemption markers are in `src/styles/CLAUDE.md`. This
list says what each guard checks.

- `check-caps.mjs` — guards the global ALL-CAPS invariant (no CSS `text-transform`
  sneaks a caps-defeating value back in). The `caps-exempt` marker and the `#root` prefix:
  `src/styles/CLAUDE.md`.
- `check-name-casing.mjs` — the JS half of the same invariant: fails if a
  component calls `.toUpperCase()`/`.toLowerCase()` on rendered text (redundant
  with the CSS invariant, and can drift from it on real Unicode names). See ADR-0017.
- `check-typography.mjs` — rejects ad hoc size, weight, line-height, and tracking
  declarations in `src/styles/*.css`; add or reuse the semantic roles in
  `src/tokens/typography.css` instead.
- `check-focus-ring.mjs` — every `:focus-visible` rule that draws a ring must use
  `var(--focus-ring)` (outline) or `var(--ring)` (box-shadow), never a hand-rolled
  color. See ADR-0023.
- `check-raw-values.mjs` — a ratchet on the `src/styles/` declarations that write a
  colour hex, a `border-radius` length, a transition/animation time, or a
  `box-shadow` literal instead of reading a token (#1178). Per-kind budgets, same
  shape as `check-caption-budget.mjs`: growth fails, a drop warns until you lower
  the budget in the same PR. Each count is taken two ways (regex and a character
  scanner) and must agree.
- `check-strike-links.mjs` — every rule that draws a `line-through` must name
  `.plink` in its selector list, because a player name is a `<button
  class="plink">` and neither inherits an ancestor's decoration nor keeps its
  own (`.plink` sets `text-decoration: none`). The
  defense diamond shipped a strike-through that never drew on a surname —
  visible only over the un-linked " (6th)" tag beside a substitute — because the
  fix two other rules already carried was never copied to it.
- `check-contrast.mjs` — resolves the color tokens to hex and asserts WCAG AA
  (≥4.5:1 text, ≥3:1 large/UI) for the known text-on-background pairings (seal ink
  on the kraft stripes, white on the IL clay stripes, the core semantic text roles).
- `check-claude-md.mjs` — guards the CLAUDE.md leanness rule: the root `CLAUDE.md` at
  `ROOT_MAX` lines and `ROOT_MAX_CHARS` characters, AND every nested one at `NESTED_MAX` lines
  and `NESTED_MAX_CHARS` characters, or at a pinned `BUDGETS` entry (downward only). It finds
  nested files by walking the tree. A nested file loads in full the first time Claude reads
  a file in its folder, then stays for the session (ADR-0098).
- `check-claude-md-facts.mjs` — checks the root `CLAUDE.md`'s facts: the three `api/` count
  phrases, the `N-tab hub` phrase, every backticked path, every ADR number, and that the
  "Nested `CLAUDE.md`" bullet lists exactly the directories that hold one.
- `check-spoiler-manifest.mjs` — guards `src/api/spoiler-manifest.json`, the
  machine-readable spoiler classification of every module in `src/api/`. Four
  assertions: every module has an entry, every entry names a real file, entries are
  well-formed (known class, non-empty `why`, `importers` on exactly the gated
  classes), and a `reveal-only`/`reveal-gated` module — or a `mixed` module's named
  reveal-only EXPORTS — is imported only from its allowlist. Unlike its siblings it
  RESOLVES import specifiers rather than substring-matching a basename, because
  `highlights.js` is a substring of `gamehighlights.js` and those two carry opposite
  classifications. See `src/api/CLAUDE.md` and the manifest's own header.
- `check-statsapi-client.mjs` — fails a `.mjs`/`.js` file under `scripts/` or
  `.scratch/` that names `statsapi.mlb.com` or `STATSAPI_BASE` on a code line
  (comments are skipped), or names `cachedGetJson` inside `scripts/`. `src/`,
  `api/`, `test/` and `e2e/` are out of scope: the browser has its own client.
  A small `ALLOWLIST` holds the files that must keep the host, each with a reason;
  a stale entry fails, like `check-dir-size.mjs`'s budgets. The matcher is pure
  and tested in `test/statsapi-client-guard.test.js`.
- `check-dir-size.mjs` — caps source files per directory (`MAX_FILES` 12) across
  `src/`, `api/`, `scripts/`, giving the "flat directories don't stay flat" rule in
  root `CLAUDE.md` the enforcement it never had (that rule was broken to 126 files
  in `src/components`). A **ratchet**: the directories already over the line (14 entries today)
  carry a `BUDGETS` entry pinned at today's count, editable DOWNWARD only, and it
  fails if one grows past its budget *or* shrinks below it without the number being
  tightened in the same commit — so a cleanup has to record itself and the table can
  only shrink. See ADR-0038.
- `check-file-size.mjs` — caps lines per source file (`MAX_LINES` 600, between p90
  and p99 of the repo's source files), to catch the next 2,620-line `person.js`
  while splitting it is still cheap. Deliberately a **weaker** ratchet than its
  sibling: line counts churn every commit, so a budget here is a ceiling (growth
  fails, shrinkage is free) and rot is bounded from the other end — a file back
  under 600 lines must surrender its entry. The 25 oversized `src/styles/*.css`
  partials are listed individually so that splitting it FORCES one entry per oversized partial rather than laundering
  the debt. See ADR-0038.
- `check-dead-exports.mjs` — fails if a named/default export in `src/**/*.{js,jsx}`
  has no reference anywhere (cross-file import OR same-file call) — an orphan left
  behind after its last caller was removed. Regex-based, like its siblings above:
  it cannot tell a forgotten export from a deliberately staged one, so a handful of
  documented-but-not-yet-wired exports sit in an `ALLOWLIST` with the reason, the
  same ratchet-table convention as `check-dir-size.mjs`'s `BUDGETS`. Understands
  this app's two dynamic-import shapes (`lazyNamed(loader, 'Name')` from
  `src/App.jsx`, and `import(...).then((m) => ({ default: m.X }))`/`m.X(...)`) so a
  lazily-routed screen or Clerk-gated component doesn't read as dead just because
  no static `import` statement names it.
- `check-dist-dev-routes.mjs` — post-build (not part of `npm run lint`, since it
  inspects `dist/`): fails if a dev-only save endpoint string reaches the
  production bundle, and equally if `dist/team-logos/` comes out empty. Both
  halves of the same question — the endpoint that WRITES curated art must never
  ship, the art itself always must. Layer 4 of ADR-0029; run it as
  `npm run build && npm run check:dist-dev`.
- `check-report-pages.mjs` — fails if `SiteMenu.jsx` (the hamburger menu) or
  `SiteFooter.jsx` (the slate's "More Baseball" list) stops importing the shared
  `REPORT_PAGES` array from `src/lib/reportPages.js` — the guard against those two
  page lists silently drifting apart again.
- `check-skeleton-ball-frames.mjs` — fails if `BoxScoreSkeleton.jsx`'s
  `BALL_FRAME_COUNT`/`BALL_SPIN_LOOPS` stop matching the hardcoded frame-strip
  width, `steps()` count, and `skel-ball-spin` keyframe fraction in the
  `.skel__ballFrames` CSS rule — those three CSS values can't read the JS
  constants directly (`steps()` needs a literal integer, not a `var()`), so
  this is the guard against them drifting apart.
- `check-caption-budget.mjs` — `--fs-caption` may only ever shrink. It counts the
  declarations that use it and fails on growth; #1128 split the one role by job
  (`--fs-label`, `--fs-cell`, `--fs-small`) and what is left is body-face text too short
  to be a sentence.
- `check-word-choice.mjs` — the house word list: say "postseason", never "playoffs", in <!-- word-choice-exempt: states the rule -->
  `src/`, `api/`, `scripts/`, `docs/`, `.claude/`, and the root `*.md` files. A line opts out only
  with the greppable marker `word-choice-exempt`, for a proper noun someone else owns.
- `check-adr-numbers.mjs` — fails when two ADRs claim one number. Numbers are assigned by
  hand on several branches at once. It checks uniqueness, never gaps.
- `check-diary-voice.mjs` — keeps research-diary entries readable: plain language, no
  statistics vocabulary outside an entry's `technical` list.
- `check-searchable-sport-ids.mjs` — the four hand-copies of the searchable MiLB level set
  (`[1, 11, 12, 13, 14]`), and `api/_lib/cards.js`'s `SPORT_LEVEL` map, must match
  `src/lib/teams.js`. Each copy exists because its file cannot import the canonical one.
- `check-stamp-surfaces.mjs` — contains the Logbook stamp (ADR-0035). `GameStamp.jsx` and
  `StampGameButton.jsx` may be imported only from their allowlists, the surfaces that list
  unrevealed games may name no stamp component, and `FORBIDDEN_ART_DIRS` / `FORBIDDEN_ART_FILES`
  may call `useStamps` but never draw stamp art. Adding a name to a forbidden list
  strengthens the guard; removing one is a spoiler-rule decision.
- `check-seal-scope.mjs` — `var(--seal*)` may appear only where a reveal is possible
  (ADR-0083). Rank and flag emphasis takes `--marker`.
- `check-learn-css.mjs` — `public/learn.css` redeclares a few colours from
  `src/tokens/colors.css`, because the `/learn` guides have no bundle. This fails on drift.
- `check-missing-imports.mjs` — the inverse of `check-dead-exports.mjs`: fails a named
  import whose target does not export that name. Only `vite build` used to catch it.
- `check-line-endings.mjs` — the LF invariant: nothing enters the index with CRLF. It is the
  reporting half of `.gitattributes`.
- `check-comment-citations.mjs` — fails a code comment that cites a pull request number
  (`PR #123`) in `src/`, `api/`, or `scripts/`. Keep the reasoning and drop the number.
- `check-fixture-freshness.mjs` — every captured e2e fixture names its capture date, and
  this fails once one goes stale. It does not check that the data is still shaped right;
  `check-feed-shape-drift.mjs` does, from the nightly cron.
- `vercel-ignore-build.sh` — Vercel's Ignored Build Step (skips a deploy when a push
  touched only docs/scripts/workflow files). See `docs/development.md`.
