# Shape: shrink public/data (#2288)

Part of #2288. This is a plan. It changes no product code.

Measured on `main` at `cbaa5da` (2026-10-21). Items marked **(inference)** are
my reading and are not tested.

## 1. Summary

- Do **Option A** now: move the four crosswalk files
  (`salaries`, `free_agency`, `arbitration`, `extensions`) from
  `public/data/contracts-history/identity/` to `scripts/data/contracts/identity/`.
  It saves **8.95 MB raw** from `public/` (5.1% of 175.0 MB). It needs **no
  new delivery path**, because no runtime code reads these files.
- Do not do Option B (`search-index.json`) or Option C (`pending.json`) now.
  The admin pages fetch them in the browser, so a move needs a new delivery
  path through a Vercel function. That path is near the 4.5 MB function response
  limit. See section 4.
- The other options in the issue stay dropped: rounding, reshaping, and
  splitting. Section 5 gives the reasons.

## 2. Three corrections to the issue

1. **`api/contract-identity.js` does not read the identity files.** The issue
   and the 2026-10-19 triage comment say it fetches them over HTTP. It does
   not. It imports only `_lib/adminAuth.js`, `_lib/nodeHandler.js` and
   `_lib/redis.js`, and it stores only the override map in Redis. Its header
   comment (lines 8-18) says this. Check:
   `grep -n "fetch\|readFile\|/data/" api/contract-identity.js` gives only
   comment lines.
2. **No runtime code reads the four crosswalk files.** In `src/` and `api/`,
   the only fetch under `identity/` is `pending.json`
   (`src/screens/admin/ContractIdentityReviewPage.jsx:76`). The page comment at
   `api/contract-identity.js:16-18` says "the admin review page fetches the base
   rows". That is stale: the page fetches `pending.json` and
   `/api/contract-identity` only. Check:
   `grep -rn "identity/salaries\|free_agency\.json\|arbitration\.json\|extensions\.json" src api`
   gives no fetch.
3. **These files do not ride the nightly cron.** `contracts-history/` is
   hand-run from committed CSVs (`scripts/check-data-freshness.mjs`,
   `EXCEPT['contracts-history/']`). The nightly workflow does not name
   `contracts-history`. Check:
   `grep -n "contracts-history" .github/workflows/*.yml` gives nothing.
   The identity folder has 5 commits since 2026-08-26, and
   `search-index.json` has 2. So the move does **not** slow `.git` growth by a
   useful amount. The files also stay in the repo, so the checkout size does not
   change. The gain is **deploy output size** only (`public/` is copied
   into `dist/`). **(inference)** Vite copies `public/` into `dist/` without
   change, so `dist/` drops by the same bytes. Slice 2 measures it.

## 3. Measurements

Command (run from the repo root, no install needed):

```sh
node -e '
const fs=require("fs"),z=require("zlib");let r=0,g=0;
for(const f of process.argv.slice(1)){const b=fs.readFileSync(f),n=z.gzipSync(b).length;r+=b.length;g+=n;
console.log(f,b.length,"bytes raw",n,"bytes gz")}
console.log("TOTAL",r,"bytes raw",g,"bytes gz")' \
  public/data/contracts-history/identity/*.json public/data/contracts-history/search-index.json
du -sb public public/data
```

| File | Raw | Gzipped | Runtime reader |
|---|---|---|---|
| `identity/salaries.json` | 6.49 MB | 793 KB | none |
| `identity/free_agency.json` | 1.37 MB | 160 KB | none |
| `identity/arbitration.json` | 0.77 MB | 75 KB | none |
| `identity/extensions.json` | 0.32 MB | 31 KB | none |
| **Option A subtotal** | **8.95 MB** (8,945,675 bytes) | 1.06 MB | none |
| `identity/pending.json` | 1.03 MB | 94 KB | `ContractIdentityReviewPage.jsx` (admin browser fetch) |
| `search-index.json` | 5.81 MB | 922 KB | `LookupDeck.jsx` (admin browser fetch) |
| **All six** | 15.79 MB | 2.07 MB | |

`public/` is 175.0 MB and `public/data/` is 161.6 MB (`du -sb`).
Gzip is `zlib.gzipSync` at the default level.

`search-index.json` split by source file (needed for section 4):

| Source | Rows | Raw | Gzipped |
|---|---|---|---|
| salaries | 27,349 | 4.34 MB | 686 KB |
| free_agency | 5,598 | 0.91 MB | 142 KB |
| arbitration | 2,420 | 0.40 MB | 66 KB |
| extensions | 999 | 0.16 MB | 27 KB |

Command: group the array by `sourceFile`, then measure
`JSON.stringify(group).length` and `zlib.gzipSync(...)` for each group.

## 4. Options, ranked by MB saved per risk

| Rank | Option | Saves (raw, deploy) | Risk | Verdict |
|---|---|---|---|---|
| 1 | **A. Move the 4 crosswalk files out of `public/`** | 8.95 MB | Low. No runtime reader. Only generators, one hand-run script, one test, the research database and docs read them. | **Do it.** |
| 2 | B. Move `search-index.json` behind a function | 5.81 MB | Medium. See below. | Defer. |
| 3 | C. Move `pending.json` behind a function | 1.03 MB | Low-medium. Needs the same new delivery path as B. | Defer; do with B or not at all. |
| 4 | D. Move `contracts-history/season-players/` (4.21 MB) | 4.21 MB | Medium. Read by `RosterSearch.jsx` (admin) and by tests and generators. | Not in scope. Found in passing. **(inference)** Admin-only at runtime; not audited fully. |
| — | Rounding `spray/`, `pitch-arsenal-starts/` | 0 | — | Drop. Both hold integers already (issue comment 1). |
| — | Reshape `salaries.json`, `search-index.json` | 48-64% raw, 8-20% gz | Medium | Drop. Out of scope by triage. Option A removes `salaries.json` from `public/` anyway. |
| — | Split big files per team or season | speed, not size | Medium | Drop for this issue. |
| — | Nightly data off `main` | `.git` growth | Large | Out of scope by triage. Separate issue. |

**Why B is not worth it now.**
- The admin browser must still get the data, so B needs a new path through a
  Vercel function. The function response limit is 4.5 MB
  ([Vercel Functions limits](https://vercel.com/docs/functions/limitations),
  "Request body size"). The whole index is 5.81 MB raw, so one response cannot
  carry it.
- A per-source split puts `salaries` at 4.34 MB. That is under the limit by a
  small margin, and the file grows when the CSVs grow. **(inference)** I do not
  know if Vercel counts the limit before or after compression.
- A server-side search (send the query, get 100 rows back) avoids the limit.
  But it changes how `LookupDeck.jsx` filters (its team and season lists come
  from the full index), and it adds a new GET mode to `api/contract-identity.js`
  plus `includeFiles` in `vercel.json`. That is a medium change for 5.81 MB of
  admin-only data that downloads only when an admin opens the lookup panel.
- No public page downloads these files. The win is deploy output size only.

**Effect on the deploy budget.** Moving files to `scripts/` also takes them out
of the `scripts/vercel-ignore-build.sh` watch list (`src public index.html
package.json package-lock.json vite.config.js vercel.json api`). **(inference)**
A rerun of `gen-contracts-identity.mjs` still deploys, because it also writes
`pending.json` and the shards under `public/`. So the deploy count does not
change in practice.

**Service worker.** No change needed. `vite.config.js:475` precaches only
`data/teams.json` from `data/`, and the runtime rule at line 544 matches only
`/data/{one segment}.json`. Neither matches `identity/*.json`.

## 5. Option A: what reads the four files today

| Reader | Kind | What to do |
|---|---|---|
| `scripts/gen-contracts-identity.mjs:47` (`outDir`) | writes all five identity files | Write the four crosswalk files to the new folder. Keep `pending.json` in `public/`. |
| `scripts/gen-contracts-shards.mjs:69` (`identityDir`) | reads | New path. |
| `scripts/gen-contracts-search-index.mjs:33` (`identityDir`) | reads | New path. |
| `scripts/migrate-contract-row-keys.mjs:75` (`identityDir`) | reads, hand-run | New path. |
| `test/contract-row-key.test.js:38,52,63,149` | reads from disk | New path. Do not loosen or skip any assertion. |
| `scripts/data/research-db-panels.json:81-84` | DuckDB panel list | New path. |
| `test/research-db-catalog.test.js` | checks every panel path exists and the doc names every view | Passes only if the panel list and the doc change in the same commit as the move. |
| `docs/agents/research-database.md:123-126` | view catalog | New path and new view name. |
| `docs/scripts/generators.md:1848-1896` | catalog | New path. |
| `docs/contracts-arbitration-warp.md:34`, `docs/contracts-extension-value.md:30,222` | prose | New path. |
| `api/contract-identity.js:8-18` | comment only | Fix the stale claim (section 2, item 2). |
| 7 `.scratch/` research builders | hand-run research | See slice 4. |

The `.scratch/` builders are: `service-clock/build.mjs`,
`service-clock/k0-blank-rate.mjs`, `team-success/build-payroll.mjs`,
`team-success/build-free-agency-market.mjs`, `contracts/build-arbitration-warp.mjs`,
`contracts-extensions/lib.mjs`, `prospect-value/panel.mjs`.

**Target folder.** `scripts/data/contracts/identity/`, next to the source CSVs
in `scripts/data/contracts/`. `check-dir-size` and `check-file-size` count only
`.js .jsx .mjs .css`, so JSON there trips no guard.

**Where the path lives.** Put one exported constant in the existing
`scripts/lib/contract-row-key.mjs` (every reader except the search-index
generator imports it already). Do not add a new file to `scripts/lib/`: its
`check-dir-size` budget is 42 and a ratchet only moves down.

**DuckDB view names change.** `research-db.mjs` names a view from its path.
`public/data/contracts-history/identity/salaries.json` gives
`public_contracts_history_identity_salaries`. The new path gives
`scripts_data_contracts_identity_salaries`. Only
`docs/agents/research-database.md` uses the old names (checked with
`grep -rln public_contracts_history_identity`).

## 6. Slices (Option A)

Each slice is one draft PR, at most 5 changed files. Slices 1-3 land in order in
one `/stack-prs` batch, so `main` gets one deploy.

### Slice 1: one source for the crosswalk path (no move)

Files (5):
- `scripts/lib/contract-row-key.mjs`: export `CROSSWALK_DIR` (the repo-relative
  folder, still `public/data/contracts-history/identity`) and the four file names
  from the existing `CONTRACT_SOURCES`.
- `scripts/gen-contracts-identity.mjs`: write the four crosswalk files to
  `CROSSWALK_DIR`. Keep `pending.json` at its own `public/` path, named in the
  file.
- `scripts/gen-contracts-shards.mjs`: read from `CROSSWALK_DIR`.
- `scripts/gen-contracts-search-index.mjs`: read from `CROSSWALK_DIR`.
- `test/contract-row-key.test.js`: read the crosswalk files from
  `CROSSWALK_DIR`. Keep `search-index.json` and the shards at their `public/`
  paths. Change no assertion.

Done means:
- [ ] No file under `public/` changes (`git diff --stat origin/main -- public` is empty).
- [ ] `node scripts/gen-contracts-shards.mjs && node scripts/gen-contracts-search-index.mjs && git diff --exit-code public/`
      passes (byte-identical output).
- [ ] `grep -rn "'contracts-history', 'identity'" scripts test` lists only `contract-row-key.mjs`
      and the `pending.json` path in `gen-contracts-identity.mjs`.
- [ ] `npm run lint` and `npm test` pass.

### Slice 2: move the four files

Files (4 pure renames + 4 edits):
- `git mv` the four files to `scripts/data/contracts/identity/` (no content change).
- `scripts/lib/contract-row-key.mjs`: `CROSSWALK_DIR` becomes `scripts/data/contracts/identity`.
- `scripts/migrate-contract-row-keys.mjs`: read from `CROSSWALK_DIR`.
- `scripts/data/research-db-panels.json`: the four new paths.
- `docs/agents/research-database.md`: the four new paths and view names, and the
  intro line that says panels live under `.scratch/` and `public/data/`.

Done means:
- [ ] `git ls-files public/data/contracts-history/identity` lists only `pending.json`.
- [ ] `git diff -M --stat origin/main` shows the four files as renames at 100% similarity.
- [ ] `du -sb public` drops by 8,945,675 bytes against `main`.
- [ ] `npm run build`, then `du -sb dist` on this branch and on `main`. State both numbers in the PR.
- [ ] `node scripts/gen-contracts-shards.mjs && node scripts/gen-contracts-search-index.mjs && git diff --exit-code public/` passes.
- [ ] `node scripts/research-db.mjs --sql "SELECT count(*) FROM scripts_data_contracts_identity_salaries"` gives 27349.
- [ ] `npm run lint` and `npm test` pass (`contract-row-key` and `research-db-catalog` included).
- [ ] `/admin/contracts?nointro` loads its queue and the lookup panel in Chromium. Send the screenshot.

### Slice 3: docs and the stale comment

Files (5):
- `docs/scripts/generators.md` (lines 1848-1896): new crosswalk path; say
  `pending.json` stays in `public/` because the admin page fetches it.
- `docs/contracts-arbitration-warp.md:34`: new path.
- `docs/contracts-extension-value.md:30,222`: new path.
- `api/contract-identity.js` (comment lines 8-18 only): the base rows are not
  public static files now, and the review page fetches `pending.json`, not the
  base rows.
- `scripts/gen-contracts-search-index.mjs` header (lines 1-25): name the new input folder.

Done means:
- [ ] `grep -rn "contracts-history/identity/\(salaries\|free_agency\|arbitration\|extensions\)" docs api scripts src test`
      gives no line.
- [ ] No code line changes (`git diff -U0` shows comment and Markdown lines only).
- [ ] `npm run lint` passes.

### Slice 4: `.scratch/` research builders (optional)

Files (5): `service-clock/build.mjs`, `service-clock/k0-blank-rate.mjs`,
`team-success/build-payroll.mjs`, `team-success/build-free-agency-market.mjs`,
`contracts/build-arbitration-warp.mjs`.

### Slice 5: `.scratch/` research builders, the rest (optional)

Files (2): `contracts-extensions/lib.mjs`, `prospect-value/panel.mjs`.

Done means (slices 4 and 5):
- [ ] `grep -rn "contracts-history/identity/\(salaries\|free_agency\|arbitration\|extensions\)\|'contracts-history', 'identity'" .scratch --include=*.mjs`
      gives no line after slice 5.
- [ ] Each changed builder reads its file without error (run its read step, or
      `node -e` an import of the path). No builder output is rewritten.

## 7. Decisions for Gary

[DECISION: Scope. Recommended: do Option A only (8.95 MB). Other choice: also do B and C (+6.84 MB, total 15.79 MB), with a new function path.]
[DECISION: Target folder. Recommended: scripts/data/contracts/identity/ (next to the source CSVs). Other choice: a new top-level data-private/.]
[DECISION: Slice 2 changes 8 paths, 4 of them pure renames. Recommended: accept that, because a split would leave main with a test that reads a missing file. Other choice: count renames against the 5-file cap and split the panel list and research doc into their own slice, which breaks test/research-db-catalog.test.js between slices.]
[DECISION: DuckDB view names. Recommended: accept the new names (scripts_data_contracts_identity_*), because only one doc uses the old names. Other choice: pin the old names in VIEW_NAMES in scripts/research-db.mjs (one more file in slice 2).]
[DECISION: .scratch research builders. Recommended: do slices 4 and 5, so a rerun does not fail on a missing file. Other choice: leave them; each fails loudly on rerun.]
[DECISION: The triage goal said "stop growing .git through the nightly cron". Recommended: accept that Option A does not do this (these files are hand-run, 5 commits in 2 months); the gain is deploy size. Other choice: open the nightly-data-off-main issue for the .git goal.]
