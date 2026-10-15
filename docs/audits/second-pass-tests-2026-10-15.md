# Second pass: test overlap (2026-10-15)

Issue #1837, "Job B: test overlap". This is research only. No test was deleted,
skipped or loosened. Every break below was made on the live tree and reverted at
once with `git checkout`. The tree is clean apart from this report.

The rule from CLAUDE.md "Test discipline" applies. A test is a deletion
candidate only if another test already fails when the same code breaks.
Coverage numbers are not proof.

## Summary

- The suite is lean. I found **no whole test or file** that another test covers.
- I found **two tiny duplicate assertions**, both proved by a break. Together they
  are about 8 lines. They are not worth a PR on their own.
- I found **one unused fixture**: `test/fixtures/abs-denominators.json`
  (726 lines, 18,671 bytes).
- Fixtures cost 14,582 lines and 966,673 bytes (1.1 MB on disk). Every other
  fixture is read by a test.

## Measured counts

| Item | Count | Command |
| --- | --- | --- |
| Test files | 578 | `ls test/*.test.js test/*/*.test.js \| wc -l` |
| Test lines | 106,878 | `cat test/*.test.js test/*/*.test.js \| wc -l` |
| Non-test files under `test/` | 50 | `find test -type f -not -name '*.test.js' \| wc -l` |
| Fixture files | 44 (14,582 lines) | `find test/fixtures -type f \| xargs wc -l` |
| Fixture bytes | 966,673 | `du -sb test/fixtures` |
| Helper and loader files (`helpers/`, `postseason/fixtures.js`, `CLAUDE.md`) | 517 lines, 22,947 bytes | `find test -type f -not -name '*.test.js' -not -path 'test/fixtures/*' \| xargs wc -lc` |
| Test titles used by 2 or 3 files | 38 | `grep -hoE "^\s*(test\|it)\(..." \| sort \| uniq -c \| awk '$1>1'` |

Note: the helper row is lines then bytes of the non-fixture files (517 lines,
22,947 bytes).

Largest test files, by `wc -l`: abs-challenges 2,439; card-cascade 2,288;
team-transactions 1,563; route 1,285; table-cascade 1,243.

## Question 1: do tests assert the same behaviour twice?

### Method

1. Listed which `src/` and `scripts/` modules each test file imports
   (`grep -oE "from '(\.\./)+(src|scripts)/[^']+'"` per file). Looked for two
   files that import the same module.
2. Listed test titles that appear in more than one file (38 titles). Checked
   whether each pair tests the same module.
3. For each real pair, broke the shared code and ran both files.

### The large files do not overlap

- `abs-challenges.test.js` (155 tests) tests `scripts/lib/abs/index.mjs` and
  `src/api/around-the-game/absChallenges.js`. `abs-exposure.test.js` imports only
  `absExposure.js`. `abs-series-report.test.js` imports only `absSeries.js`.
  `abs-scope.test.js` shares the `scripts/lib/abs` import. I counted calls to
  `exposureRowsFor`, `exposureByPlayer`, `exposureRates`, `buildExposureExport`,
  `ranOutBoard` and `hasExposure`. All of them appear in `abs-challenges` only.
  `abs-scope` tests the scope split (R and P), a different behaviour.
  Result: no overlap. Proof status: inferred from imports and call counts.
- `card-cascade.test.js` is the only file that imports `cardClass.js` and
  `sectionHeadClass.js`. The sibling files (`table-cascade`, `button-cascade`,
  `cluster`, `grid`, `stack`, `pill-cascade`) each test their own class module.
  Same-title tests across them (for example "a list gets the reset modifier")
  pin separate modules. Result: no overlap. Proof status: inferred.
- `team-transactions.test.js` shares `teamTransactions.js` with
  `trade-deadline.test.js`. `trade-deadline` calls `dedupeTransactions` only as
  setup for `groupTradeStories` (lines 107 and 127). **Proved by break:** I made
  `dedupeTransactions` return its input. Six tests failed, all in
  `team-transactions`. None failed in `trade-deadline`. So `trade-deadline` does
  not assert dedupe, and the two files do not repeat each other.
  `trade-deadline.test.js` also copies one fixture row set from
  `team-transactions.test.js` (a comment says so). That is shared data, not a
  repeated assertion.

### Same titles, same shared code: kept (proved by break)

`matchup-arsenal.test.js` and `matchup-callouts.test.js` have three tests with
the same title: sentence SHAPE rotation, rates round, short forms under the
ceiling. They look like copies. Both call `src/api/matchup/voice.js`. I tested
whether one file covers the other.

| Break | Files that failed |
| --- | --- |
| `SHAPES = 1` in `voice.js` | both (1 test each) |
| `pct` prints one decimal in `voice.js` | both (rates round), plus 2 other tests |
| `fitShort` never trims in `voice.js` | `matchup-callouts` only (1 test) |
| `notes.js` ignores `index` | `matchup-callouts` only |
| `arsenal.js` ignores `index` | `matchup-arsenal` only |

The last two rows decide it. Each file guards its own caller. If one test goes,
a break in that caller passes. **Keep both.** The `fitShort` row shows the same
thing from the other side: `matchup-arsenal` does not catch that break, and
`matchup-callouts` does.

The other same-title pairs test different modules, so they are not repeats:
`hitter-similarity` and `pitcher-similarity`, `contender-diary` and
`research-diary`, `books` and `stamps` (shared import `preferences.js` only),
`button-cascade` and `pill-cascade`. Proof status: inferred from imports.

### Duplicate assertions found (ranked)

**1. `halfIndex` boundary values.**
Files: `test/pre-pitch-selectors.test.js` lines 120-124 ("halfIndex agrees with
the gate the selectors enforce", 2 assertions) and `test/spoiler-gates.test.js`
lines 10-18 ("halfIndex is a total order over half-innings").
The first test asserts `halfIndex(2,'top') === 2` and `halfIndex(1,'bottom') === 1`.
`spoiler-gates` asserts both values, plus three more and the extra-inning case.
**Proved by break:** I swapped the top and bottom offsets in `src/api/select.js`.
Both tests failed, and so did 12 more. When I wrapped extra innings at 9, the
`pre-pitch` test still passed and `spoiler-gates` failed. So the `pre-pitch`
test is a strict subset. Saving: 5 lines.
Caution: the `pre-pitch` test has a comment that says it documents the
boundary the null-return tests rely on. A person should decide if that comment
is worth the lines. Proof status: **proved by break**.

**2. `ordinal` teens, in a ranking test.**
Files: `test/league-ranks.test.js` line 60 (one `deepEqual` on `ordinal` for
11, 12, 13, 21, 22) and `test/lib-helpers.test.js` lines 27-44 ("ordinal
suffixes the ones digit except the 11-13 teens").
**Proved by break:** I broke the teen rule in `src/lib/format.js`. The
`lib-helpers` test failed. So did the `league-ranks` test and a third
(`ordinal wrappers keep their empty-value rules`). The `league-ranks` test also
checks `rankMarks`, so only line 60 is the duplicate part. Saving: 1 line.
Proof status: **proved by break** for that one line.

### Not proved

- `express-lane-rail.test.js` "halfIndex is the app-wide seal unit" compares
  `buildRail` rows to `halfIndex`. It checks the rail, not `halfIndex` itself.
  Keep it.
- I did not run a full mutation sweep. Two tests can overlap in a way that no
  title or import match shows. The checks above find only the visible cases.

## Question 2: unused files under `test/`

### Method

For each of the 50 non-test files:

1. `grep -rlF <basename>` over the repo, excluding `node_modules`, `.git`,
   `.scratch` and `dist`, and not counting the file itself. A second pass counted
   hits under `.scratch/` only.
2. For files with zero hits, searched for string-built names. The dirs use
   templates: `player-bio/${name}.json`, `pitcher-card/${name}.json`,
   `${year}-skeleton`, `${year}-results`, and `fixture('135-158', ...)`.
3. Looked for `readdirSync` over `test/fixtures`. None exists. The
   `readdirSync` calls in tests read `src/` and `public/` data, not fixtures.
4. Read `scripts/check-fixture-freshness.mjs`. It reads `e2e/fixtures`, not
   `test/fixtures`.

### Result

Zero direct hits for 22 files. All 22 are read through a template:

- `player-bio/*` (10 files): `test/player-bio.test.js` line 14 and
  `test/crawl-body.test.js` (`aaron-deceased`).
- `pitcher-card/*` (6 files): `test/pitcher-card-data.test.js`.
- `former-teammates/*` (2 files): `test/former-teammates-ladder.test.js` lines 42-43.
- `postseason/*-skeleton.json`, `*-results.json` (7 files):
  `test/postseason/fixtures.js` builds the names from `year`.

Files with one to three hits were each opened. Each one is read by a real test
(for example `scout/*` by `scout-head-to-head`, `scout-meetings`,
`scout-edge`, `scout-play-ids`).

**Unused: `test/fixtures/abs-denominators.json`.**
- Size: 726 lines, 18,671 bytes. Captured 2026-09-15 by
  `.scratch/abs-reports/build-fixture.mjs`.
- Hits outside `.scratch/`: only `docs/audits/ponytail-2026-09-30.md` (a mention).
  No test, script, workflow or doc reads it. The nearby `abs-exposure` and
  `abs-challenges` tests build their rows inline or read `public/` data.
- Proof status: **not proved by a break**. A file with no reader cannot be
  proved by breaking code. The search is the evidence. The git history here is
  shallow (one commit shows it), so I could not see if a removed test once read
  it.
- Caution: `.scratch/abs-reports/build-fixture.mjs` and
  `.scratch/abs-reports/research.md` name it. It is a regeneration target for a
  script. A person decides if it is kept as a spare capture. I did not touch
  `.scratch/`. Removing the file is a data cut, not a test cut, so the
  "never delete a test" rule does not apply. Saving: 726 lines, 18.7 KB.

### What fixtures cost

| Group | Bytes | Note |
| --- | --- | --- |
| `game-823035.trimmed.json` | 217,519 | Spoiler invariant. Read by 17 files. Keep. |
| `scout/*` | about 178,000 | One CSV is 105,679 bytes. Read by 4 tests. |
| `hitdata-823427.trimmed.json` | 112,468 | One reader: `hitchart.test.js`. |
| `game-822740`, `815863`, `820258`, `823787` | 190,000 | One to three readers each. |
| `postseason/*` | about 120,000 | Read through `fixtures.js`. |
| `roster-age-club-totals.json` | 45,388 | One reader. |
| `abs-denominators.json` | 18,671 | **No reader.** |
| Everything else | about 85,000 | Read. |

Large files are not waste when a test reads them. CLAUDE.md in `test/` says a
whole captured game stays on disk on purpose. I do not recommend trimming any
fixture. Trimming changes the data a test reads, so it could loosen the test.

## Ranked findings

| # | Finding | Files | Lines | Proof |
| --- | --- | --- | --- | --- |
| 1 | `abs-denominators.json` has no reader | `test/fixtures/abs-denominators.json` | 726 | not proved (search only) |
| 2 | `halfIndex` boundary test is a subset of `spoiler-gates` | `test/pre-pitch-selectors.test.js` 120-124 | 5 | proved by break |
| 3 | `ordinal` teens assertion repeats `lib-helpers` | `test/league-ranks.test.js` 60 | 1 | proved by break |
| 4 | Matchup pairs look like copies | `test/matchup-arsenal.test.js`, `test/matchup-callouts.test.js` | 0 | **keep**, proved by break |

Findings 2 and 3 save 6 lines out of 106,878. I advise against a PR for them
alone. If a person wants them, take them in a PR that also touches those files.

## Honest limits

- Overlap by import and title finds the visible cases. A full mutation run over
  `src/` would be the next level of proof. It was out of scope.
- I did not run `npm run test:coverage`. Coverage does not prove overlap.
- Line counts are `wc -l`. Byte counts are `du -sb` and `find -printf %s`.
