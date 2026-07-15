# Team Transactions — data layer

**Status:** data-layer design approved and verified against the live API — ready for implementation
**Slug:** team-transactions
**Relationship to prior work:** The visual/product design is locked in
`scope.md` + `wireframe.html` in this directory — this document does NOT revisit
it. It scopes only the pipeline that feeds the locked card: a nightly
`scripts/gen-team-transactions.mjs` precompute → static, season-chunked
`public/data/team-transactions/{season}.json` files → same-origin
`src/api/teamTransactions.js` reader, following the build-time-fetch pattern
(`src/api/CLAUDE.md`), with the grouping/de-dupe/cutline logic in pure,
testable shapers the generator imports (the `gen-callouts.mjs` /
`gen-minors-leaders.mjs` "import the app's own shaper so the two can't drift"
convention).

The card is **spoiler-free** by nature — roster moves and their dates carry no
score, exactly like the roster/rehab surfaces — so no `SealBox` is involved. The
reader still accepts the Team Page's `asOf` cutoff and trims stories dated after
it, purely for *temporal* consistency on a historical page (never showing a move
that hadn't happened from that page's vantage point), mirroring `seasonScoreFor`.

## 1. The `public/data/*.json` shape

**One file per season, all teams, keyed by teamId — chunked by season, not a
single ever-growing file (maintainer decision).**
`public/data/team-transactions/{season}.json` (e.g. `2026.json`, `2025.json`,
…). Full history accumulates permanently — nothing is ever pruned — but it's
stored as one immutable file per completed season plus one "live" file for the
season in progress, so the client only pays for what it actually loads.

- **Only the current season's file is rewritten nightly.** Once a season ends
  (rolls to a new year), that season's file is written one final time and
  never touched again — a naturally immutable, indefinitely-cacheable
  artifact, no merge-with-previous-output logic required.
- **The client loads lazily, 45 days at a time, oldest-first pagination.** A
  team page fetches only the current season's file by default and renders up
  to the most recent 45 days of stories. A "Load more" affordance pages
  further back: first through the remainder of the current season's
  already-fetched file, then — once that's exhausted — fetching the prior
  season's file, and so on. Nothing beyond the current season is ever
  downloaded unless the reader actually asks for more.
- **No manifest needed.** Season files are just `{currentYear}.json`,
  `{currentYear - 1}.json`, … — the reader tries the previous year down from
  the current one and treats a 404 as "no more history" (a team's inaugural
  season, or simply reaching back further than this feature has existed).

~~~jsonc
// public/data/team-transactions/2026.json
{
  "version": 1,
  "season": 2026,
  "generatedAt": "2026-07-15T09:12:00Z",
  "seasonStart": "2026-03-25",          // this season's Opening Day (regularSeasonStartDate,
                                         // GET /api/v1/seasons/2026?sportId=1); fixed once known
  "final": false,                       // true once the season has ended and
                                         // this file stops being rewritten
  "byTeamId": {
    "158": {
      "days": [                          // newest day first
        {
          "date": "2026-07-12",          // YYYY-MM-DD, the story's effectiveDate
          "stories": [                   // order within a day: significance
            {
              "id": "158-2026-07-12-trade-660271",   // stable React key
              "type": "trade",           // enum → drives pill + fallbacks
              "typeLabel": "Trade",      // the .txstory__type pill text
              "rail": [                  // .photorail slots, In/Up first
                { "role": "in",  "banner": "In",  "playerId": 700123,
                  "name": "Braden Shewmake", "surname": "Shewmake",
                  "pos": "SS", "tintTeamId": 158 },
                { "role": "out", "banner": "Out", "playerId": 656514,
                  "name": "Greg Jones", "surname": "Jones",
                  "pos": "LF", "tintTeamId": 158 }
              ],
              "cutline": [               // ordered segments; emphasis → b / i / plain
                { "text": "Acquired " },
                { "text": "SS Braden Shewmake", "emphasis": "primary", "playerId": 700123 },
                { "text": " from the Astros for cash; " },
                { "text": "designated LF Greg Jones for assignment",
                  "emphasis": "secondary", "playerId": 656514 },
                { "text": "." }
              ]
            }
          ]
        }
      ]
    }
  }
}
~~~

Notes on the shape:
- **Dateline** ("SUNDAY, JULY 12") is formatted client-side from `date` (the app
  owns the caps invariant + locale); the file stores only the ISO date.
- **`rail`** carries whatever count a move involves (0 for a rail-less IL-to-IL
  transfer, 1 for a solo signing or same-player double-move, 2–3+ for a shuffle).
  Each slot has everything the `Headshot` component needs — `playerId` (mlbstatic
  CDN, no fetch), `tintTeamId` (feeds `teamTintColor()`), and the `surname`
  caption. `banner` is the pre-decided kicker text (`In`/`Out`/`Up`/`Down`/
  `Up/Down`/`IL-10`/`IL-60`).
- **`cutline`** is a segment array, not a raw string, so the component renders
  `<b>` (primary/incoming clause) and `<i>` (secondary/outgoing clause) without
  parsing. `emphasis ∈ {primary, secondary, undefined}` maps to the wireframe's
  `.cutline b` / `.cutline i` / plain. `playerId` on a segment is optional (future
  deep-link to the player page).
- `type` enum: `trade | shuffle | roster-move | injured-list | signing |
  suspension`. Drives `typeLabel` and is the story's identity for tests.
- **`final`** lets the generator (and, defensively, the reader) assert a
  completed season's file is never expected to change — a guard against a
  future bug re-triggering a rewrite of frozen history.

Size: ~30 orgs × maybe 150–250 stories per season ≈ est. 400–800 KB **per
season file** — bounded and roughly constant year over year, since chunking
by season means the payload no longer grows without limit the way one
combined file would. **Exclude from the PWA precache** regardless (the
`vs-team-splits.json` treatment): a same-origin runtime fetch of one season's
file is cheap, and precaching every season a team page might page back into
isn't worth it.

## 2. De-dupe algorithm

Two observed dupe classes (from `scope.md` Data findings): (a) byte-identical
repeats — the Logan Henderson rehab ASG logged 3× on 2026-06-28; (b) a
two-team-perspective mirror — the Easton McGee → Royals trade logged twice on
2026-07-14, the second copy missing the `person` field. Run in two passes over
each org's raw rows, keeping `date = effectiveDate || date` as the row's date.

**Pass A — exact collapse (kills class a).**
Signature per row:
`sig = id != null ? "id:" + id : ["c", date, typeCode, personId ?? "", fromId ?? "", toId ?? "", description].join("|")`.
Keep the first row per `sig`; drop the rest. (Three identical rehab rows share
one `sig` → one survives. Uses the transaction `id` when present, exactly as the
scope suggested; the composite is the fallback when `id` is absent.)

**Pass B — semantic mirror collapse (kills class b).**
Group Pass-A survivors by `(date, typeCode, clubPair)` where
`clubPair = [min(fromId,toId), max(fromId,toId)]` (unordered — reusing
`person.js`'s `tradeKey` idea). Within each group:
1. Collect the distinct **non-null** `personId`s → the real people involved.
2. Keep, per distinct `personId`, the single **fullest** row (prefer a row that
   has `person`, both teams, and the longer `description`).
3. **Drop any null-`person` row when the group has ≥1 non-null `personId` row** —
   that null row is the opposite-perspective mirror (the McGee case: keep the
   Brewers-perspective copy that names him, drop the Royals-perspective copy that
   doesn't).
4. If the entire group is person-less (rare), keep one row.

Why this shape works for every observed case: the identical-rehab triple collapses
in Pass A; the trade mirror collapses in Pass B step 3; a *genuine* multi-player
trade on the same date+clubPair keeps one row per distinct `personId` (step 2), so
a real 2-for-1 isn't flattened; and unrelated same-day recalls/options/selections
(different `personId`, and mostly different clubPair — MLB club ↔ its own
affiliate) never share a group, so de-dupe leaves them intact for §3 to pair.

De-dupe runs **before** noise-filtering and story-grouping.

## 3. Story-grouping / pairing heuristic

Design goal per the brief: **explainable and testable, not intent-guessing.** The
lever is roster arithmetic — a fixed-size roster means a same-day IN usually forces
an OUT — not free-text reading. Per day, over the de-duped + noise-filtered
(§4) rows, annotate each with a **direction** from its typeCode/description:

- `in` — gains a body: `CU` recall, `SE` select, `TR`-incoming, `CLW`/`PUR`
  claim/purchase, `SFA`/`SGN`/`IFA` signing, `SC` "activated … from the injured
  list".
- `out` — loses a body: `OPT` option, `DES` DFA, `OUT` outright, `REL`/`URL`
  release, `TR`-outgoing, `WA` waived, `RET`, `SC` "placed … on the injured list".
- `transfer` — neutral, no active-roster body: `SC` IL-to-IL ("transferred … to
  the 60-day").

Then, in strict priority order (each step **consumes** the rows it uses):

1. **Same-player double-move → one `roster-move` story (Crow case).** Group the
   day's rows by `personId`; if a person has both an `in` and an `out` row (e.g.
   activated off the IL *and* optioned down), emit ONE story: a single rail slot,
   neutral banner `Up/Down`, cutline joining both verbs. Consume both rows.
2. **Trades → a `trade` story each (Shewmake case).** Each surviving `TR` seeds a
   story. If the trade is a net roster *add* (acquired a player), pull ONE 40-man-
   clearing move from the remaining `out` pool, preferring `DES` → `OUT` → `REL`,
   as its paired secondary clause. (A pure trade-away pulls nothing.)
3. **IL placements → an `injured-list` story each (Hamilton case).** Each `SC`
   IL-placement seeds a story and pulls ONE replacement from the remaining `in`
   pool, preferring `SE` (contract selection) → `CU` (recall) — "placed X on the
   IL; selected Y to fill the spot." Banner on the placed player is `IL-{days}`.
4. **Leftover churn → one `shuffle` story if ≥2 slots, else solo `roster-move`s
   (Gasser+Lara / Perkins case).** Whatever `in`/`out` rows remain are plain
   recalls/options/selections. If ≥2 remain and they contain both an add and a
   subtract, cluster them into ONE `shuffle` story (rail grows to 2-up-1-down,
   etc.). Otherwise each leftover is its own one-slot `roster-move`.
5. **Signings with no corollary → solo `signing` story (Strzelecki case).** Any
   unconsumed `SFA`/`SGN`/`IFA` becomes a one-slot story.
6. **Leftover `transfer` rows → rail-less `roster-move` story (Woodruff case).**
   No headshot; cutline only. Its own story, not folded into a neighbor's
   cutline (see Decisions, #6).

All four cases the brief names — clean 2-player pair (step 2), 3+-player shuffle
(step 4), same-player double-move (step 1), solo with no pair (steps 5/6) — fall
out of the priority order deterministically, and each step is a pure function of
counts + typeCodes, so it unit-tests directly against the Jul 7 / Jul 12 / Jun 24
fixtures already captured in `scope.md`.

Within-day story order: `trade` → `injured-list` → `shuffle`/`roster-move` →
`signing` (significance), matching the wireframe's Jul 12 (trade then roster move)
and Jul 7 (shuffle then injured list) ordering.

## 4. Noise to filter (never a story)

Mirrors `person.js`'s `transactionTimelineView` trimming (keep-by-whitelist, drop
administrative `SC` and number changes) plus the team-scope tightening. Drop a row
when **any** of:

- **typeCode not roster-story-worthy.** Whitelist: `TR, SFA, SGN, IFA, SE, CU,
  OPT, OUT, DES, REL, URL, CLW, PUR, WA, RET, SU`, plus `SC` **only** when its
  description is an IL placement / activation / transfer (`isIlPlacementTxn` /
  `isIlEndingTxn` / IL-to-IL, the exact predicates already in `person.js`). Every
  other `SC` (paternity, bereavement, "reinstated", ceremonial `#42`/`#21` number
  changes), arbitration filings, and any unlisted code → drop.
- **Rehab ASG.** `ASG` rows and any row whose description matches `/rehab/i` — a
  rehab assignment doesn't change the 40-man/active roster (the player stays on
  the IL), it's the exact record that triple-duplicated, and `person.js` already
  drops it from the player timeline. Filtered here too.
- **Doesn't touch the club's roster.** Keep a row only if it involves the MLB org
  itself — its 40-man club id or an affiliate mapped to that parent org (see §5
  bucketing). This drops pure affiliate-to-affiliate `ASG` laterals (a prospect's
  AA→AAA move), which belong on the *player* page's career timeline, not the MLB
  club's transactions feed.

`SU` (suspension) is retained as a rare solo story, matching `person.js`'s
existing treatment of it as a `move` (see Decisions, #7).

## 5. Generator + reader shape

**`scripts/gen-team-transactions.mjs`** (nightly, `update-nightly-data.yml`; a
full rebuild of the *current season's file only* — a completed season's file is
never touched again once written with `final: true`):

~~~text
main:
  season      = currentSeasonYear()
  seasonMeta  = getJson(`/api/v1/seasons/${season}?sportId=1`)   // verified: one row, one call
  seasonStart = seasonMeta.regularSeasonStartDate                // Opening Day
  final       = today > seasonMeta.seasonEndDate                 // past the World Series window
  orgs        = fetchMlbTeamIds()          // sportId=1, 30 clubs (as gen-rehab)
  affilToOrg  = fetchAffiliateParentMap()  // affiliate teamId → parent org id
  raw         = getJson(`/api/v1/transactions?startDate=${seasonStart}&endDate=${today}`)
                                           // ONE league-wide fetch per run, like gen-rehab —
                                           // always season-start-to-today, not a rolling window.
                                           // Verified: teamId= is club-scoped (misses affiliate-
                                           // only rows), so this stays league-wide + own bucketing,
                                           // not a per-org teamId= loop.
  positions   = fetchPositions(personIds)  // batch /people, pos fallback (gen-rehab helper)
  byTeamId = {}
  for each org O in orgs:
    rows      = bucketToOrg(raw, O, affilToOrg)      // §4 club-touch filter
    deduped   = dedupeTransactions(rows)             // §2  (imported shaper)
    kept      = filterStoryworthy(deduped)           // §4  (imported shaper)
    days      = groupIntoStories(kept, { positions }) // §3 (imported shaper) → shaped days
    if days.length: byTeamId[O] = { days }
  write to public/data/team-transactions/{season}.json:
    { version, season, generatedAt, seasonStart, final, byTeamId }
~~~

Nothing reads or merges a *previous* run's output — each run recomputes the
current season's file from scratch from the raw feed, same as every other
`gen-*.mjs` in this repo. The only thing that makes history "accumulate" is
that a season's file simply stops being touched (and a new `{season+1}.json`
starts existing) once that season ends — there is no cross-run state to get
wrong.

The `dedupeTransactions` / `filterStoryworthy` / `groupIntoStories` / `buildCutline`
functions and the typeCode tables are **pure, exported from
`src/api/teamTransactions.js`** and imported by the generator — the
`gen-callouts`/`gen-minors-leaders` lockstep convention — so the app and the
precompute can never disagree on de-dupe or pairing, and the shapers unit-test
against the `scope.md` fixtures with no network. Position: parse the `POS Name`
token out of each row's own `description` first (as `person.js`'s
`assignedDescription` does), falling back to the batched `/people` lookup — cheap,
and avoids a per-player fetch.

**`src/api/teamTransactions.js`** (reader + pure shapers):

~~~js
// pure shapers (also imported by the generator)
export function dedupeTransactions(rows) {…}          // §2
export function filterStoryworthy(rows) {…}           // §4
export function groupIntoStories(rows, ctx) {…}       // §3 → [{ date, stories }]
export function buildCutline(story) {…}               // segment array
export const TXN_STORY_TYPES = {…}                    // code → {dir, label, banner}

const PAGE_DAYS = 45

// Loads one season file (session-cached per season, like rehab.js), degrades
// to null on 404/error rather than throwing — a 404 means "no more history."
async function loadSeasonFile(season) {…}             // fetch /data/team-transactions/{season}.json

// Stateful pager: first call with no cursor returns the most recent PAGE_DAYS
// of a team's days (fetching only the current season's file); each subsequent
// call with the previous cursor pages further back, crossing into
// loadSeasonFile(season - 1) only once the newer season's days are exhausted.
// Returns { days, cursor, hasMore } — cursor is opaque ({ season, index }).
export async function loadMoreTeamTransactions(teamId, cursor, cutoff) {…}
~~~

**Cached vs recomputed:** each season file is *fully shaped* (days/stories/rail/
cutline), so nothing is recomputed at request time — the reader only selects
the teamId, trims to the `asOf` cutoff, paginates, and degrades to an empty
state before a file exists or on any error. Each season file is cached
in-memory once fetched (indefinitely for a `final: true` season, once-a-day for
the live one), same lifecycle as `rehab.js` / `seasonScore.js`.

## Non-goals (this scope)

- **No live / on-page transaction fetching.** Everything is the nightly
  precompute; the app does one same-origin read.
- **No React component or CSS.** The card, `TeamTransactionsCard.jsx`, and the
  `src/index.css` styles are the *next* step (design already locked in
  `wireframe.html`); this document stops at the JSON the component consumes.
- **Does not touch `TransactionTimeline.jsx` / `person.js`.** The shared *ideas*
  (rehab/IL/number-change trimming, `tradeKey`) are mirrored, not refactored into
  a shared dependency, keeping this scope self-contained (same convention as
  `gen-rehab.mjs` mirroring `detectRehabAssignment`).
- **No `SealBox` / spoiler mechanism.** Roster moves + dates carry no score; the
  `asOf` cutoff filter is temporal hygiene, not spoiler defense.
- **MLB orgs only in phase 1.** Affiliate-assigned rows bucket up to the parent
  org, but a MiLB-affiliate team page gets no transactions card yet.
- **No editorial flavor copy.** The wireframe's polished connectives ("to open a
  40-man spot", "to make room") are human prose; auto-generation targets
  plainer templated sentences for phase 1 (see Decisions, #3).

## Decisions (approved by the maintainer)

1. **File shape:** chunked by season — `public/data/team-transactions/{season}.json`,
   each keyed by teamId — not one all-teams-all-history file, and not 30
   per-team files. See §1.
2. **Window/history:** full season-to-date, permanently accumulating —
   nothing is ever pruned going forward. Chunking by season (decision 1) is
   what keeps this affordable: each file is bounded to one season's worth of
   stories, and a completed season's file is frozen (`final: true`) and never
   rewritten. The client defaults to loading only the current season and
   pages further back 45 days at a time on request (see §1 and §5's
   `loadMoreTeamTransactions`) — full history exists on disk, but nothing
   beyond what's asked for is ever downloaded.
3. **Cutline fidelity:** plainer auto-generated prose built from templates +
   the feed's own descriptions for phase 1 (dropping "to open a 40-man
   spot"–style hand-authored flavor from the wireframe).
4. **Pairing heuristic:** the roster-balance greedy algorithm of §3 (priority:
   same-player double → trade+clear → IL+replacement → churn cluster →
   signing → transfer) is canonical, accepting it won't always match a human
   editor's intuition on which OUT "belongs" to which IN.
5. **Scope:** MLB orgs only for phase 1, bucketing affiliate signings up to
   the parent org; no MiLB-affiliate transactions card yet.
6. **Leftover transfers:** a rail-less IL-to-IL transfer (Woodruff) gets its
   **own** story rather than folding into a neighboring story's cutline.
7. **Suspensions:** `SU` stays as its own story, matching `person.js`'s
   existing treatment on the player-page timeline.

## Verified against the live API

All three items resolved by hitting `statsapi.mlb.com` directly (2026-07-15):

- **`id` field presence:** confirmed reliably present. Re-pulled the Brewers'
  2026-06-24→07-15 transactions (43 rows, the same fixture in `scope.md`) —
  every row had a non-null `id`. §2 Pass A's dedupe key can lead with `id`
  as the primary case, not just a fallback path to exercise defensively; the
  composite signature stays only as a belt-and-suspenders fallback for the
  rare/older row that might lack one.
- **`teamId=` scope: confirmed club-scoped, not org-scoped.** Every one of
  those 43 rows had `fromTeam.id` or `toTeam.id` equal to `158` (the Brewers'
  MLB club) directly — none were a pure affiliate-to-affiliate row (e.g. an
  AA↔AAA lateral) that only an org-scoped query would include. This confirms
  §5's league-wide fetch + own affiliate→parent-org bucketing (§4) is
  *necessary*, not just a defensive simplification — a per-team `teamId=`
  query would silently miss affiliate call-up/option rows whose `fromTeam`/
  `toTeam` is the Triple-A club, not the MLB club itself.
- **Season boundaries: `GET /api/v1/seasons/{year}?sportId=1`.** Returns
  `regularSeasonStartDate` (Opening Day — `"2026-03-25"` for 2026, one day
  earlier than an earlier draft's placeholder date — now corrected in §1's
  example) and `regularSeasonEndDate`/`seasonEndDate` (`final` can
  flip to `true` once `today > seasonEndDate`, i.e. after the World Series
  window closes — using `seasonEndDate`, not `regularSeasonEndDate`, so a
  late-October trade during the postseason still lands before the file
  freezes). One cheap extra call per generator run, cached same as
  everything else.
