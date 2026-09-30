# test/

`node:test` unit suite — pure logic only, no browser, no live network. CI-gated via
`npm test` (see root `CLAUDE.md`). `test/fixtures/` holds shared captured-feed JSON;
most files keep their fixtures inline (see "Fixtures" below for why).

## Finding a test

There is no index table. Test files are named after the module they cover: run
`ls test/` or `git grep -l "<module>" test/` to find coverage. The spoiler invariant
is pinned on a captured real game (`test/fixtures/game-823035.trimmed.json`, see
`docs/testing.md`). Two soft consolidation candidates, not acted on:
`milb-color-chain.test.js` + `milb-team-wiring.test.js`, and
`scorecard-placed-runner.test.js` + `scorecard-sac-double-play.test.js`.


## Working with this suite without burning context

- **Run narrow when debugging.** `node --test test/foo.test.js` (or
  `npm run test:verbose -- test/foo.test.js`-style single-file invocation) instead of
  the full `npm test` when chasing one failure — keeps output to one file's worth of
  noise instead of ~1000 tests' worth.
- **`npm test` uses the `dot` reporter** (one char per test, not one line) to keep a
  full-suite passing run's output small. `npm run test:verbose` reruns with the
  per-test `spec`-style reporter when you actually want test names (e.g. finding
  which specific case is slow or silently skipped).
- **Fixtures stay inline on purpose.** Several of the largest files
  (`team-transactions.test.js`, `day-highlights.test.js`) embed real captured feed
  rows directly in the test body with comments explaining *why* each row matters
  (which bug it pins, which real gamePk/date it came from). That provenance is the
  point — moving the data into a bare `test/fixtures/*.json` would strip the
  comments that make the fixture legible and wouldn't reduce total tokens read once
  you need both files open anyway. Don't extract a fixture just because the file is
  long; only extract if the data itself (not its rationale) is reused across files.
- **A captured feed goes in `test/fixtures/` with the script that built it.** A WHOLE
  real game is the exception to the rule above: it is far too big to read inline and
  its value is that it is unedited. `game-823035.trimmed.json` (MLB, the spoiler
  invariant), `game-815863.trimmed.json` (Triple-A, the ABS challenge clamp) and
  `game-820258.trimmed.json` (Single-A at the one park that runs challenges and
  reports no bank) are all field-trimmed to the paths the selectors under test read,
  and all rebuilt by a committed script under `.scratch/` rather than by hand — the
  ABS pair by the same one, which takes the gamePk as its argument. The suite reads them
  from disk, so it stays offline.
- **A hook is exercised through one server render.** `callout-ledger.test.js` reads
  `useCalloutLedgerValue` by rendering a probe component with
  `react-dom/server`'s `renderToStaticMarkup`. That is the only React in the suite,
  and it stays node-only — no DOM, no browser, no timers. Prefer a pure module
  (`revealProgressCore.js` is the pattern) when a hook's logic can live in one; use
  the probe only when the value the hook returns IS the thing under test.
- **Prefer asserting the field(s) under test, not the whole object**, when adding new
  cases — `assert.equal(sig.performer.id, 2)` over
  `assert.deepStrictEqual(sig, entireExpectedObject)`. A failing assertion on a whole
  feed/derived object dumps its full diff into context; a narrow assertion fails with
  a one-line diff. Existing broad `deepStrictEqual` calls on small, already-minimal
  fixtures (e.g. `wpa-logo.test.js`) are fine as-is — this is guidance for new tests
  on large objects, not a mandate to rewrite passing assertions.
