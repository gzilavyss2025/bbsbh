# Research for #2234: plate-appearance rows from Retrosheet, 1961 to 2014

Part of #2234. Run 2026-10-21 in a cloud session. Research only. No app code changed.
The PR holds this file and nothing else.

**Labels.** A number is **measured** when a build in this session produced it, or when
a cited page states it. *(Inference)* marks my reasoning. *(Not tested)* marks a claim
I could not check here. Sizes use "MB" for 1,000,000 bytes and "gz" for `gzip -9`.

## The answer in brief

1. **Size.** The 8,647,152 plate-appearance (PA) rows of 1961 to 2014 weigh
   **46.3 MB gz** (537.5 MB raw JSON) with the 17 columns Gary chose for version 1
   (the 11 filter columns, hands, score margin, lineup place, hit value, RBI) **and**
   the raw pitch string. With only the 11 filter columns and the pitch string they
   weigh 37.3 MB gz; without the pitch string, 28.5 MB gz. The game index
   (112,902 games) adds **0.92 MB gz**. The version 1 cost is 5.4 bytes gz per PA.
2. **Pitch strings.** Two eras. **1961 to 1987:** 4% of PAs have a pitch string
   (0.1% to 16.3% a season). **1988 to 2014:** 89.6% to 100% a season, 98.4% over the
   27 seasons. Where a string exists it is sound: 99.998% of strings end the way the
   play result says.
3. **Hosts.** Three compared: Vercel Blob, Cloudflare R2, GitHub release assets.
   **GitHub release assets fail for a browser** (no CORS on the download host, per a
   GitHub community report). **Vercel Blob fits version 1 on the free Hobby plan** and
   the repo already uses it. **R2 is the fallback** if transfer grows. One test must
   run first: whether Blob serves JSON compressed. If it does not, the user's
   download is about 10 times larger than the gz sizes below.
4. **Layout.** Shard by **season and month**: 371 files, median 85 KB gz, largest
   181 KB gz, rows in date order. Add one small game index per season. Keep the pitch
   string in a parallel file (it is 23% of the bytes). Add park files now and person
   files only if a measured need appears. See section 4.

## Method

- **Inputs.** Retrosheet event files for 1961 to 2014 (`https://www.retrosheet.org/events/{YYYY}eve.zip`,
  54 seasons) and the Chadwick register, from the spike's `fetch.sh`. Chadwick `cwevent`
  0.7.2 (SourceForge tarball, built in the container) expands each file into one row
  per event. I kept the rows where the batter event flag is `T` (one row per PA).
- **Join.** The spike's `join.mjs`, rerun for 1961 to 2014. It gave 112,902 of 112,902
  games joined to a `gamePk` and 8,647,152 PAs, the same totals as
  `.scratch/research-retrosheet-spike/findings.md`. Ids pass through the Chadwick
  register to MLBAM ids. `cwevent` field 16 is the responsible pitcher.
  *(Inference: for a future pitch-level store, field 14, the pitcher at the play, may
  fit better. The spike found both equal on all 6,288 Savant PAs of six sample days.)*
- **Rows.** Sorted by date, then `gamePk`, then event number. This is the order a "last
  time" scan needs. Stored as JSON column arrays: `{season, month, cols, c: [[...], ...]}`.
  An unknown count is `null`, not `0`.
- **Columns.**
  - `min` (11): `gamePk`, `ab` (the `cwevent` event number in the game), `batter`, `pitcher`,
    `event` (Retrosheet event code), `inn`, `half`, `outs`, `bases` (bit mask 1/2/4),
    `balls`, `strikes`. These serve the filters: season (the shard), team and park
    (through the game index), batter, pitcher, and count, outs, runners, inning.
  - `min+pseq` (12): `min` plus `pseq`, the raw Retrosheet pitch string.
  - `rich+pseq` (18): `min+pseq` plus `stand`, `throws`, `bsd` (batting club's score
    margin), `slot` (lineup place), `hit` (hit value), `rbi`.
- **Count columns.** `balls` and `strikes` hold the count when the PA ended its last
  pitch, before the pitch that put the ball in play. They do not say "the PA was in
  this count at some point". That needs the pitch string *(inference, from the data
  shape; 1961 line 3 `BBBB` stored as 3-0)*.
- **Script.** `measure.mjs` in this folder is the build script (about 250 lines). It
  reads the folder layout of the Reproduce section and writes `measure.json`.
- **Two bugs found and fixed while measuring** (both would have changed the answer):
  `cwevent` does not number `NP` (substitution) lines, so raw play lines drift from
  event numbers after the first substitution. And the 1984 to 1987 files leave the
  count field empty instead of writing `??`. After the fixes, 8,647,152 of 8,647,152
  `cwevent` pitch strings equal the raw strings.

## 1. Size of the PA rows, 1961 to 2014

Month shards, `gzip -9`, summed over 371 files. 8,647,152 PAs, 112,902 games.

| Row set | Columns | Raw JSON | gz | Bytes gz per PA |
|---|---|---|---|---|
| `min` | 11, no pitch string | 350.2 MB | **28.5 MB** | 3.30 |
| **`min+pseq`** | 12, with the raw pitch string | 395.8 MB | **37.3 MB** | **4.32** |
| **`rich+pseq` (version 1)** | 18, adds hands, score margin, lineup place, hit value, RBI | 537.5 MB | **46.3 MB** | **5.36** |

The pitch string adds **8.8 MB gz** (31% on top of `min`). Written to parallel files it
weighs 8.56 MB gz, and the core columns 28.55 MB gz. The sum, 37.1 MB, is less than 1%
under the combined 37.3 MB. So splitting costs almost nothing.

Per decade (`min+pseq`):

| Years | Seasons | PAs | Raw MB | gz MB | Bytes gz per PA | Pitch string adds, MB gz |
|---|---|---|---|---|---|---|
| 1961-1969 | 9 | 1,114,816 | 52.1 | 3.6 | 3.20 | 0.2 |
| 1970-1979 | 10 | 1,510,990 | 71.0 | 4.6 | 3.03 | 0.1 |
| 1980-1989 | 10 | 1,551,900 | 72.4 | 5.4 | 3.47 | 0.6 |
| 1990-1999 | 10 | 1,668,131 | 75.2 | 8.7 | 5.22 | 2.8 |
| 2000-2009 | 10 | 1,877,536 | 83.1 | 10.0 | 5.32 | 3.3 |
| 2010-2014 | 5 | 923,779 | 42.0 | 5.1 | 5.51 | 1.8 |

Single seasons: 1961 is 0.37 MB gz (5.1 MB raw). 2014 is 1.02 MB gz (8.4 MB raw).
The per-season sizes are in the table in section 2.

**Other measured sizes**

- **Game index.** One row per game: `gamePk`, day of year, home and away club id,
  Retrosheet park code, game number, day or night, DH flag, pitch-data flag, both
  scores, attendance. 112,902 games: 5.03 MB raw, **0.92 MB gz** as one file, or
  1.08 MB gz as 54 per-season files (14 KB gz for 1961, 23 KB gz for 2014). 30 clubs,
  73 park codes.
- **One file per season** instead of per month: 54 files, 35.1 MB gz in all (6% less
  than the shards, since larger files compress better). Median 0.62 MB gz, largest
  0.98 MB gz.
- **Brotli level 11**, six sample seasons, `min+pseq` month shards: 1961 369,849 bytes
  gz against 301,360 br (-18.5%); 1987 -21.0%; 1995 -15.0%; 2014 -15.0%
  (1,017,754 gz; 864,935 br). *(Inference: brotli is 15% to 21% smaller. A host that
  serves brotli would cut the user's download by that much.)*
- **Compared with the spike.** The spike's lean store (23 columns, no sort) was 47.8 MB
  gz, or 56.5 MB gz with the pitch string. My 12-column store is smaller because it has
  fewer columns. I did not isolate the effect of the date sort.
- **Parse and scan, Node 22 on this container, not a phone.** `JSON.parse` of all 54
  season files (395.7 MB raw) took 3.2 s in one run and 5.8 s in another. One filter
  scan (2 outs, bases loaded, 3-2 count) over all rows took 87 to 88 ms and found 6,818
  PAs. *(Inference: the download and the parse cost more than the filter. Phone parse
  time is not measured.)*

## 2. Which seasons have a pitch string

**Definitions.** *Pitch string filled* = the PA has a non-empty Retrosheet pitch
string. *Known count* = the play line has a two-digit count (not `??`, not empty).
*Games: pitches / count / none* = the game's own `info,pitches` flag in the event file.
*Strings that end as the result says* = of PAs that end in a strikeout, walk, hit by
pitch or ball in play, the share whose last pitch fits that result (a strikeout string
reaches three strikes, a walk reaches four balls, a hit by pitch ends in `H`, a ball in
play ends in `X` or `Y`). The check does not use the count field.

**By era**

| Years | PAs | Pitch string filled | Known count | Games: pitches / count / none |
|---|---|---|---|---|
| 1961-1983 | 3,214,627 | 4.2% | 8.5% | 1,817 / 2,061 / 38,367 |
| 1984-1987 | 643,666 | 2.6% | 5.7% | 209 / 0 / 8,207 |
| 1988-1990 | 479,729 | 95.8% | 95.7% | 6,056 / 1 / 252 |
| 1991-1998 | 1,318,123 | 95.1% | 95.1% | 16,270 / 0 / 791 |
| 1999-2014 | 2,991,007 | 99.9% | 100.0% | 38,869 / 0 / 0 |
| **1961-2014** | **8,647,152** | **56.1%** | **58.0%** | 63,221 / 2,062 / 47,617 |

(Two games carry no `info,pitches` line, so the games sum to 112,900.)

- **Strings are sound where they exist.** 4,817,383 of 4,817,458 classed PAs
  (99.998%) end as the result says. An unknown-pitch mark (`U` or `?`) appears in 636
  of 4,852,489 strings (0.01%). No season passes 0.19%.
- **The count filter and the pitch string go together** from 1988 to 1998: the two
  shares differ by 0.2 points or less. In 1999 all 2,428 games carry pitches, 1.6% of
  PAs have no string, and the count is known for all of them. Before 1988 the known count is 8.5% and
  5.7%, patchy by season (0.5% in 1982; 22.6% in 1961).
- **Agreement with the spike.** My filled share by decade is 21.6% (1980s), 95.2%
  (1990s), 3.3% (1970s). The spike measured the same values.
- **Gaps in 1988 to 1998.** The games flagged `none` explain it: 252 games in
  1988-1990 and 791 in 1991-1998. The worst season is 1996 (89.6%, 229 games). The
  filled share tracks the share of `pitches` games within 0.5 points in 1988 to 1998
  *(inference: PAs inside a flagged game almost all carry a string)*.
- **Seasons at 100.0%:** 2000 to 2014, and 1991 and 1992. Seasons below 95%:
  1990 (92.1%), 1995 (93.3%), 1996 (89.6%), 1997 (92.9%), 1998 (93.7%).
- **Before 1988 the strings are scattered.** 1961 to 1964 have 9% to 16% (12% to 17% of
  games carry pitches in 1961 to 1963). 1965 to 1987 stay under 5.1%, and 1983 has
  0.1%. *(Inference: for a pitch-string or count filter, 1961 to 1987 can answer a
  narrow set of games only. The coverage line (decision 11 in #2234) should print the
  share per season.)*

**Per season**

| Season | PAs | Games: pitches / count / none | PAs with a pitch string | PAs with a known count | Strings that end as the result says | MB gz (rows with string) |
|---|---|---|---|---|---|---|
| 1961 | 109,571 | 178 / 308 / 944 | 12.5% | 22.6% | 100.0% | 0.37 |
| 1962 | 124,554 | 217 / 51 / 1353 | 13.1% | 16.5% | 100.0% | 0.41 |
| 1963 | 122,361 | 281 / 95 / 1243 | 16.3% | 21.9% | 100.0% | 0.42 |
| 1964 | 122,997 | 149 / 10 / 1467 | 9.0% | 9.6% | 99.9% | 0.39 |
| 1965 | 122,765 | 39 / 100 / 1484 | 2.0% | 8.5% | 99.9% | 0.38 |
| 1966 | 121,692 | 17 / 109 / 1489 | 1.0% | 7.9% | 100.0% | 0.37 |
| 1967 | 121,848 | 43 / 133 / 1444 | 2.3% | 10.4% | 99.9% | 0.38 |
| 1968 | 120,827 | 45 / 97 / 1483 | 2.2% | 8.1% | 100.0% | 0.37 |
| 1969 | 148,201 | 104 / 284 / 1558 | 4.9% | 17.7% | 99.9% | 0.48 |
| 1970 | 149,332 | 73 / 141 / 1730 | 3.5% | 10.0% | 100.0% | 0.47 |
| 1971 | 146,705 | 99 / 16 / 1823 | 4.7% | 5.2% | 100.0% | 0.45 |
| 1972 | 139,968 | 46 / 26 / 1787 | 2.5% | 3.9% | 100.0% | 0.42 |
| 1973 | 148,794 | 53 / 7 / 1883 | 2.7% | 3.3% | 100.0% | 0.44 |
| 1974 | 148,855 | 42 / 31 / 1872 | 2.1% | 2.3% | 99.8% | 0.44 |
| 1975 | 148,621 | 78 / 0 / 1856 | 4.3% | 4.3% | 100.0% | 0.44 |
| 1976 | 147,598 | 61 / 136 / 1742 | 3.3% | 10.8% | 100.0% | 0.45 |
| 1977 | 161,547 | 2 / 161 / 1940 | 0.9% | 7.8% | 100.0% | 0.49 |
| 1978 | 159,192 | 80 / 139 / 1883 | 4.3% | 10.6% | 99.8% | 0.49 |
| 1979 | 160,378 | 123 / 1 / 1974 | 5.0% | 5.3% | 100.0% | 0.49 |
| 1980 | 161,210 | 39 / 1 / 2065 | 1.8% | 2.1% | 99.9% | 0.48 |
| 1981 | 105,892 | 35 / 182 / 1177 | 2.4% | 15.6% | 100.0% | 0.34 |
| 1982 | 161,104 | 10 / 0 / 2097 | 0.5% | 0.5% | 100.0% | 0.47 |
| 1983 | 160,615 | 3 / 33 / 2073 | 0.1% | 1.9% | 100.0% | 0.47 |
| 1984 | 160,566 | 48 / 0 / 2057 | 2.3% | 4.1% | 99.9% | 0.49 |
| 1985 | 160,320 | 62 / 0 / 2041 | 2.8% | 2.8% | 100.0% | 0.49 |
| 1986 | 160,858 | 87 / 0 / 2016 | 4.0% | 5.1% | 100.0% | 0.50 |
| 1987 | 161,922 | 12 / 0 / 2093 | 1.5% | 10.7% | 100.0% | 0.50 |
| 1988 | 159,380 | 2070 / 0 / 30 | 98.4% | 98.3% | 100.0% | 0.82 |
| 1989 | 160,033 | 2046 / 1 / 59 | 97.0% | 97.0% | 100.0% | 0.83 |
| 1990 | 160,316 | 1940 / 0 / 163 | 92.1% | 92.0% | 100.0% | 0.82 |
| 1991 | 160,746 | 2104 / 0 / 0 | 100.0% | 100.0% | 100.0% | 0.86 |
| 1992 | 160,545 | 2105 / 0 / 1 | 100.0% | 100.0% | 100.0% | 0.85 |
| 1993 | 174,564 | 2201 / 0 / 68 | 96.7% | 96.7% | 100.0% | 0.92 |
| 1994 | 124,483 | 1534 / 0 / 66 | 95.7% | 95.7% | 100.0% | 0.66 |
| 1995 | 156,703 | 1884 / 0 / 133 | 93.3% | 93.3% | 100.0% | 0.82 |
| 1996 | 177,261 | 2038 / 0 / 229 | 89.6% | 89.6% | 100.0% | 0.92 |
| 1997 | 175,541 | 2110 / 0 / 156 | 92.9% | 92.9% | 100.0% | 0.92 |
| 1998 | 188,280 | 2294 / 0 / 138 | 93.7% | 93.7% | 100.0% | 0.95 |
| 1999 | 189,692 | 2428 / 0 / 0 | 98.4% | 100.0% | 100.0% | 0.98 |
| 2000 | 190,261 | 2429 / 0 / 0 | 100.0% | 100.0% | 100.0% | 0.96 |
| 2001 | 186,976 | 2429 / 0 / 0 | 100.0% | 100.0% | 100.0% | 0.94 |
| 2002 | 186,615 | 2426 / 0 / 0 | 100.0% | 100.0% | 100.0% | 0.94 |
| 2003 | 187,449 | 2430 / 0 / 0 | 100.0% | 100.0% | 100.0% | 1.01 |
| 2004 | 188,539 | 2428 / 0 / 0 | 100.0% | 100.0% | 100.0% | 1.03 |
| 2005 | 186,292 | 2431 / 0 / 0 | 100.0% | 100.0% | 100.0% | 1.01 |
| 2006 | 188,071 | 2429 / 0 / 0 | 100.0% | 100.0% | 100.0% | 1.02 |
| 2007 | 188,623 | 2431 / 0 / 0 | 100.0% | 100.0% | 100.0% | 1.03 |
| 2008 | 187,631 | 2428 / 0 / 0 | 100.0% | 100.0% | 100.0% | 1.03 |
| 2009 | 187,079 | 2430 / 0 / 0 | 100.0% | 100.0% | 100.0% | 1.03 |
| 2010 | 185,553 | 2430 / 0 / 0 | 100.0% | 100.0% | 100.0% | 1.02 |
| 2011 | 185,245 | 2429 / 0 / 0 | 100.0% | 100.0% | 100.0% | 1.02 |
| 2012 | 184,179 | 2430 / 0 / 0 | 100.0% | 100.0% | 100.0% | 1.02 |
| 2013 | 184,873 | 2431 / 0 / 0 | 100.0% | 100.0% | 100.0% | 1.02 |
| 2014 | 183,929 | 2430 / 0 / 0 | 100.0% | 100.0% | 100.0% | 1.02 |

## 3. Storage hosts

Files here: 371 PA shards, 54 game indexes, a few small index files. About 47 MB gz for the version 1 columns, and 73 park files add about 43 MB,
about 430 files in version 1. Gary's rule: outside git, fetched on demand by the PWA.

**What the repo already does.** `api/ballpark-photo.js` and `api/identity.js` write to a
**public Vercel Blob store** (`ballparks/`, `identity-logos/`; URLs end in
`.public.blob.vercel-storage.com`). A token pattern and a lazy `@vercel/blob` import
exist. ADR-0025 and ADR-0044 cover it (cited in `api/CLAUDE.md`).

| | Vercel Blob (public store) | Cloudflare R2 | GitHub release assets |
|---|---|---|---|
| Free allowance | Hobby: 1 GB storage, 10 GB data transfer, 10,000 simple ops, 2,000 advanced ops, a month | 10 GB-month storage, 1 million Class A ops, 10 million Class B ops, a month | No stated cap on release size or bandwidth |
| Price beyond free | Hobby: none; Blob stops (below). Pro: $0.023 per GB-month storage, $0.05 per GB transfer (example, region iad1) | $0.015 per GB-month; egress $0 | None |
| Limits that touch us | 5 TB per file. Rate: 900 advanced ops a minute on Hobby. 512 MB per file is the CDN cache limit | Free tier covers Standard storage only | 1,000 assets per release; under 2 GiB per file |
| Fetch from the PWA | Direct URL. Preflight shows `access-control-allow-origin: *` in a 2025 community post. A plain GET has no preflight *(Not tested)* | Needs CORS rules on the bucket. A custom domain returns them. `r2.dev` is for development only (rate-limited) | **Fails.** The download host sends no CORS header |
| Cache | CDN and browser cache up to 1 month by default. Minimum configurable 60 s. ETag, so a repeat read is a 304 | Custom domain can use Cloudflare Cache. You must set a cache-everything rule for JSON | Not applicable |
| New thing to run | None. Store and token exist | Cloudflare account, bucket, domain, upload keys | An upload step in a workflow |

Sources, in table order:
[Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) (page dated
2026-09-23), [Vercel Blob public storage](https://vercel.com/docs/vercel-blob/public-storage),
[Vercel changelog: 100 stores on Hobby](https://vercel.com/changelog/increased-blob-store-limit-for-hobby-users),
[community thread on Blob CORS](https://community.vercel.com/t/cors-issues-with-vercel-blob/4742),
[R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/),
[R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/),
[GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases),
[GitHub community discussion 45446](https://github.com/orgs/community/discussions/45446).

**Vercel Blob on Hobby, with our numbers**

- **Storage.** Version 1 is about 47 MB gz of 1 GB (5%), or about 90 MB with park files *if the host stores what I
  upload*. The existing photo and logo blobs share the 1 GB. Their size is not measured.
- **Uploads.** About 430 files is 430 of 2,000 advanced operations in a month, and
  the 900 a minute rate cap is not near. *(Inference: the doc says an upload counts as
  an advanced operation.)* The 13,112 person files of section 4 are **not** possible on
  Hobby in one month.
- **Transfer.** 10 GB a month is 268 reads of the whole 1961 to 2014 store at 37.3 MB,
  or about 118,000 reads of a median shard (84.7 KB). A repeat read on the same device
  hits the browser cache and costs nothing *(inference, from the 1 month default)*.
  If Blob serves JSON **uncompressed**, the same 10 GB is 25 full reads and 8,000
  median shards.
- **The hard stop.** On Hobby you "will not pay for any additional usage", but "you
  will not be able to access Vercel Blob if limits are exceeded" for 30 days. *(Inference:
  that would also break ballpark photos and club logos. The doc says splitting data
  across stores does not change costs, so a second store probably does not isolate
  the limit.)*
- **Not documented, test first:** whether the Blob CDN compresses JSON for a browser,
  and whether it answers `Range` requests. The test is one throwaway 1 MB JSON upload,
  then `curl -sI -H 'Origin: https://example.com' -H 'Accept-Encoding: gzip, br'` on its URL,
  reading `content-encoding`, `access-control-allow-origin` and `accept-ranges`, then a delete.
  **Status: not run.** This environment has no Blob token (no `BLOB_*` or `VERCEL_*`
  variable is set). The result sets whether files ship as plain `.json` or as
  pre-gzipped bytes that the page unpacks with `DecompressionStream`.
  [DECISION: Run the header test from a session that holds the store's read-write token, or paste the token's environment variable name into the session. Recommended: run it before any build. Nothing else in this file depends on the answer except the user's download size.]
- **Versioned paths.** Put a version in the path (`retro/v1/...`). The 1961 to 2014
  data is frozen, so set a long `cacheControlMaxAge`. A rebuild writes `v2` and the
  manifest points to it. This avoids the stale-cache trap that `api/ballpark-photo.js`
  already documents for overwritten paths.

**Cloudflare R2.** The best free transfer (egress $0, 10 million reads a month) and no
per-upload cap that matters (1 million Class A ops). It costs a new vendor, a bucket, a
custom domain for caching and CORS, and a second secret for the hand-run upload. Our
47 MB sits inside the free 10 GB, and the person files (about 140 MB) would too.
*(Inference: pick R2 if Blob transfer nears 10 GB, or if
person files are wanted. The layout in section 4 does not depend on the host.)*

**GitHub release assets.** Generous limits, and a workflow can upload them. The browser
cannot read them. A user report says "codeload.github.com … and the release assets
download bucket do not support CORS", and the thread is unanswered (labeled "Bug").
Workarounds are a proxy you run or a copy into another repo's raw URLs. A proxy through
a Vercel function would pay function transfer on Hobby. *(Inference: not worth it while
Blob is already in the stack.)* Not compared: a separate data repo served by
`raw.githubusercontent.com` (which the same thread says has CORS) or jsDelivr. A repo
is still git, so history growth returns there.

**Recommendation.** Vercel Blob for version 1, after the one-file test. Keep the paths
host-neutral, so a move to R2 is a copy and a base-URL change.

## 4. Recommended layout

### Measured facts that drive it

| Layout (all `min+pseq`, 1961-2014) | Files | Total gz | Per file gz (median / largest) | Use |
|---|---|---|---|---|
| By season and month | 371 | 37.3 MB | 85 KB / 181 KB | Any filter; the base layout |
| By season | 54 | 35.1 MB | 0.62 MB / 0.98 MB | Fewer files, heavier reads |
| By batting club and season | 1,416 | 35.4 MB | 30 KB / 36 KB | Team filter |
| By both clubs and season | 1,416 | 75.1 MB | 62 KB / 73 KB | Team filter, both halves (2.0 times) |
| By park (all seasons) | 73 | 34.8 MB | 476 KB / 1.36 MB | Park filter |
| By batter (career) | 8,098 | 59.0 MB | 1.4 KB / 88 KB | Batter filter |
| By pitcher (career) | 5,014 | 44.6 MB | 3.9 KB / 95 KB | Pitcher filter |

Person files drop the key column. Together they hold 103.6 MB gz in 13,112 files, 2.8
times the base store.

**What a person filter costs on the base layout.** A batter touches a median of 12 of
371 shards (1.3 MB gz). At the 90th percentile it is 66 shards (7.2 MB), at the 99th
113 shards (14.0 MB), at the maximum 158 shards (21.7 MB). Pitchers are alike: median
12 shards (1.5 MB), 90th percentile 61 (7.3 MB). Named players, batting side, bytes via
month shards against the person file:

| Player | PAs | Shards touched | Via month shards | Person file |
|---|---|---|---|---|
| Pete Rose | 15,890 | 158 | 10.5 MB | 67.8 KB |
| Derek Jeter | 12,602 | 125 | 18.6 MB | 87.9 KB |
| Barry Bonds | 12,606 | 139 | 18.3 MB | 85.1 KB |
| Hank Aaron | 9,411 | 105 | 6.7 MB | 43.6 KB |
| Clayton Kershaw (pitching) | 5,489 | 44 | 6.8 MB | 31.1 KB |
| Roger Clemens (pitching) | 20,240 | 140 | 19.0 MB | 92.3 KB |

A person-to-shard map lets the page skip shards the person never appears in: 88 KB gz
for batters, 53 KB gz for pitchers. It does not cut bytes much for a long career, since
the career spans most months. A person file is 100 to 200 times smaller for a star.

**What a "last time" scan costs, newest shard first** (it stops at the first match).
Shards and bytes are measured on this store. A row with an unknown count never
matches a count filter:

| Question | Newest match | Shards read | gz bytes read | All matches |
|---|---|---|---|---|
| Strikeout, bases loaded, 2 outs, 3-2 count | 2014-09 (`gamePk` 382952) | 1 | 163 KB | 1,593 |
| Home run on an 0-2 count | 2014-09 (`gamePk` 382968) | 1 | 163 KB | 4,165 |
| Home run, bases loaded, bottom 9th or later, trailing by 3 | 2014-06 (`gamePk` 381782) | 4 | 666 KB | 19 |
| Home run, bases loaded, 2 outs, 3-2, 9th or later | 2013-09 (`gamePk` 349075) | 8 | 1.19 MB | 21 |

Rarer questions read more shards. The worst case, a question with no match, reads
the whole 37 MB.
A month shard lets the scan stop within one month. A season file would read about
1 MB for the first two rows.

### The layout

```
retro/v1/manifest.json              versions, season list, shard list (rows, bytes), coverage per season
retro/v1/games/{season}.json        game index, 14 to 23 KB gz each, 54 files
retro/v1/parks.json                 Retrosheet park code -> MLBAM venue id, name, first and last season
retro/v1/pa/{season}/{mm}.json      17 core columns (the 11 filter columns plus the 6 extras), rows in date order, 371 files
retro/v1/pitches/{season}/{mm}.json pitch string per row, same row order as the core file, 371 files
retro/v1/idx/batters.json           person -> shard numbers, 88 KB gz
retro/v1/idx/pitchers.json          person -> shard numbers, 53 KB gz
retro/v1/by-park/{code}.json        73 files, 35 MB gz measured with 12 columns; about 43 MB with 18 (inference, +24%)
```

- **A row's key** is `gamePk` plus `ab`. A later pitch store joins on that pair (the
  #2311 advice), so each pitch row can point to its PA.
- **Why month shards.** The median shard is 85 KB gz, small enough for a phone. A season
  file is 7.4 times bigger at the median for 6% less total. A "last time" scan reads
  one shard, not a season. 371 files need 371 uploads, which fit Hobby's 2,000 a month.
- **Why a separate pitch file.** A filter on count, outs, runners or inning at the end
  of the PA (the common case) reads the core file only. The pitch file is 23% of the
  bytes. A filter on the pitch sequence or "was in this count" reads both. Rows in both
  files share one order, so the page zips them by index. The pre-1988 pitch files are
  mostly empty strings, which compress to almost nothing. Splitting adds 371 files
  (742 in all) and no bytes (the two files sum to 0.6% under the combined file).
- **Team filter.** The game index maps a club to its `gamePk` set, but the month shards
  mix all clubs. Reading one club for five seasons costs about 35 shards (about
  3 MB gz). *(Inference: a batting-club-season file is 30 KB, 20 times less than a
  season file, but adds 1,416 files and 35 MB.)* Start with the shards. Add club files
  if team questions dominate.
- **Park filter.** The index maps a park to its games. The 73 park files cost 35 MB
  gz and 73 uploads, and one park's whole history is 0.5 MB gz at the median. Cheap
  enough to build with the base store *(recommended)*.
- **Park ids.** Retrosheet gives a park code. The repo's park data uses MLBAM venue ids.
  I joined the two on `gamePk` over 113,470 schedule rows of 1961 to 2014 (a suspended
  game shows on two dates): **73 park codes
  map to 73 venue ids**. The exceptions are one-game, so the mapping is clean: 10 codes
  carry a second venue id on 1 to 3 games each (13 games in all), for example `CHI11`
  has venue 17 on 4,366 games and one game each at venues 21, 29 and 20. I did not
  diagnose them *(Inference: games played away from the designated home park, like the
  spike's second-pass cases.)* Put the dominant pair in `parks.json` and keep the venue
  id per game in the index if exactness matters.
- **Person files.** They make a star's batter filter 100 times cheaper, and they cost
  13,112 uploads, which is over Hobby's 2,000 advanced operations a month and over
  GitHub's 1,000 assets per release. They fit R2. Not in version 1.

### Rules for the page *(inference)*

- Load `manifest.json` first. It lists each shard's row count and the coverage line data.
- Resolve team, park and date from the game index, then fetch only shards whose
  months hold those games.
- Start a "last time" scan at the newest shard of the chosen range and stop at the first match.
- A "how often" count over a range reads the whole range. Show the byte cost before
  a 37 MB read, or cap the range.
- Gray out the count and pitch-sequence chips for a season under the share in section 2.

## Decided (Gary, 2026-10-21, relayed by the parent session)

1. **Host:** Vercel Blob, public store, versioned paths `retro/v1/...`.
2. **Sharding:** month files (371), with the pitch string in a parallel file.
3. **Columns:** the 11 filter columns plus the pitch string **and** the extras: batter
   and pitcher hand, score margin, lineup place, hit value, RBI. Measured size of that
   row set, 18 columns with the pitch string: **46.3 MB gz**, 537.5 MB raw (table in
   section 1). The core files (17 columns, no pitch string) are about 37.8 MB gz and the
   pitch files 8.56 MB gz *(inference: 46.33 minus 8.56; the 17-column core was not
   gzipped alone)*. Section 4 tables list the 12-column sizes because the layout
   experiments ran on them.
4. **Park files:** yes, build them (73 files). Club-by-season and person files stay out of version 1.
5. **Script:** committed as `measure.mjs` in this folder.
6. **Header test:** yes, run it (1 MB JSON, throwaway path in the existing store, then delete).

**Still open:** the header test did not run, because no Blob token is in this environment.
See the DECISION line in section 3. No data files were built or uploaded.

## What this research did not measure

- Phone download and parse time. Node parse time is in section 1 only.
- What Vercel Blob or R2 serve for compression, `Range` and CORS on a GET. Section 3
  lists the test.
- Any pitch-level rows. Retrosheet strings give the call and result of each pitch,
  not type or location. A pitch row built from a string has no speed or plate position.
- 1961 to 2014 postseason games, Negro League games, and pre-1961 seasons.

## Reproduce

From the repo root. `DL` is a new, empty folder outside the repo.

```bash
DL=/tmp/retro-pa
bash .scratch/research-retrosheet-spike/fetch.sh "$DL" 1961 2014            # event zips, game logs, register
node .scratch/research-retrosheet-spike/pull-schedules.mjs "$DL/sched" 1961 2014
node .scratch/research-retrosheet-spike/join.mjs "$DL" 1961 2014 > "$DL/join-out.txt"
# Chadwick 0.7.2 from SourceForge (github.com is blocked in the cloud environment)
curl -L -o cw.tgz https://sourceforge.net/projects/chadwick/files/chadwick-0.7/chadwick-0.7.2/chadwick-0.7.2.tar.gz/download
tar xzf cw.tgz && (cd chadwick-0.7.2 && ./configure --prefix="$DL/cw" && make && make install)
node --max-old-space-size=9000 measure.mjs "$DL" "$DL/cw/bin/cwevent" "$DL/measure.json"   # about 25 minutes
```

The run holds all 8.6 million rows in typed arrays and needs the large heap above.
Delete `$DL` when done.
