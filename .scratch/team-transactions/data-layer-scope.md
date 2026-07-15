# Team Transactions — data layer

**Status:** data-layer plan; awaiting approval before implementation
**Slug:** team-transactions
**Relationship to prior work:** The visual/product design is locked in
`scope.md` + `wireframe.html` in this directory — this document does NOT revisit
it. It scopes only the pipeline that feeds the locked card: a nightly
`scripts/gen-team-transactions.mjs` precompute → static
`public/data/team-transactions.json` → same-origin `src/api/teamTransactions.js`
reader, following the build-time-fetch pattern (`src/api/CLAUDE.md`), with the
grouping/de-dupe/cutline logic in pure, testable shapers the generator imports
(the `gen-callouts.mjs` / `gen-minors-leaders.mjs` "import the app's own shaper
so the two can't drift" convention).

The card is **spoiler-free** by nature — roster moves and their dates carry no
score, exactly like the roster/rehab surfaces — so no `SealBox` is involved. The
reader still accepts the Team Page's `asOf` cutoff and trims stories dated after
it, purely for *temporal* consistency on a historical page (never showing a move
that hadn't happened from that page's vantage point), mirroring `seasonScoreFor`.

## 1. The `public/data/*.json` shape

**One file, all teams, keyed by teamId** — `public/data/team-transactions.json`
(the single-file, keyed-map convention of `rehab.json` / `season-score.json`, not
30 per-team files). Fully shaped: the reader selects and cutoff-filters, nothing
more. The `day → story → rail-slot` nesting matches the card structure 1:1.

~~~jsonc
{
  "version": 1,
  "generatedAt": "2026-07-15T09:12:00Z",
  "season": 2026,
  "windowStart": "2026-05-31",          // earliest date covered (rolling window)
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

Size: ~30 orgs × a few dozen stories over the window ≈ small (est. 150–400 KB).
Provisionally **included** in the PWA precache; revisit and move it out (the
`vs-team-splits.json` treatment) only if it grows past a few hundred KB.

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
   No headshot; cutline only. (See open question 6 on optionally *folding* this
   into a neighboring story's cutline as an "also transferred …" clause instead.)

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

`SU` (suspension) is retained as a rare solo story (matches `person.js` keeping it
as a `move`); flag if the maintainer would rather drop it (open question 7).

## 5. Generator + reader shape

**`scripts/gen-team-transactions.mjs`** (nightly, `update-nightly-data.yml`; a
full rebuild over a rolling window — transactions in a fixed recent window are
cheap to regenerate, so **not** append-only like game-notes/rookies):

~~~text
const WINDOW_DAYS = 45                    // rolling; see open question 2

main:
  orgs        = fetchMlbTeamIds()          // sportId=1, 30 clubs (as gen-rehab)
  affilToOrg  = fetchAffiliateParentMap()  // affiliate teamId → parent org id
  raw         = getJson(`/api/v1/transactions?startDate=${windowStart}&endDate=${today}`)
                                           // ONE league-wide window fetch, like gen-rehab
  positions   = fetchPositions(personIds)  // batch /people, pos fallback (gen-rehab helper)
  byTeamId = {}
  for each org O in orgs:
    rows      = bucketToOrg(raw, O, affilToOrg)      // §4 club-touch filter
    deduped   = dedupeTransactions(rows)             // §2  (imported shaper)
    kept      = filterStoryworthy(deduped)           // §4  (imported shaper)
    days      = groupIntoStories(kept, { positions }) // §3 (imported shaper) → shaped days
    if days.length: byTeamId[O] = { days }
  write { version, generatedAt, season, windowStart, byTeamId }
~~~

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

// reader (dumb — select + cutoff-filter + degrade), session-cached like rehab.js
let cached = null
export async function loadTeamTransactions() {…}      // fetch /data/…json, degrade to {byTeamId:{}}
export function teamTransactionsFor(data, teamId, cutoff) {
  // data.byTeamId[teamId]?.days, dropping days/stories with date > cutoff, → null if empty
}
~~~

**Cached vs recomputed:** the JSON is *fully shaped* (days/stories/rail/cutline),
so nothing is recomputed at request time — the reader only selects the teamId,
trims to the `asOf` cutoff, and degrades to `null` (friendly empty state) before
the file exists or on any error. In-memory session cache (once-a-day file), same
as `rehab.js` / `seasonScore.js`.

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
  40-man spot", "to make room") are human prose; auto-generation targets plainer
  templated sentences unless open question 3 approves richer templating.

## Approval requested

Approve or revise before implementation starts:

1. **File shape:** one all-teams `public/data/team-transactions.json` keyed by
   teamId (vs. 30 per-team files). Recommended: single file.
2. **Window length:** rolling **45 days** (recommended) vs. season-to-date vs.
   "last N stories." How far back should the feed scroll?
3. **Cutline fidelity:** accept plainer auto-generated prose built from templates
   + the feed's own descriptions (dropping "to open a 40-man spot"–style flavor),
   vs. investing in richer per-pattern templates. Recommended: plainer for phase 1.
4. **Pairing heuristic:** approve the roster-balance greedy algorithm of §3
   (priority: same-player double → trade+clear → IL+replacement → churn cluster →
   signing → transfer) as canonical, accepting it won't always match a human
   editor's intuition on which OUT "belongs" to which IN.
5. **Scope:** MLB orgs only for phase 1, bucketing affiliate signings to the
   parent org; no MiLB-affiliate card yet.
6. **Leftover transfers:** a rail-less IL-to-IL transfer (Woodruff) as its **own**
   story (recommended default), vs. folding it into a neighboring story's cutline
   as an "also transferred …" clause (what the wireframe hand-authored).
7. **Verify-against-live / minor calls:** (a) confirm whether the `/transactions`
   `id` field is reliably present (affects §2 Pass A's key) and whether a
   `teamId=` query is org-scoped or club-scoped (affects §5 bucketing — the plan
   uses a league-wide fetch + own bucketing to sidestep this); (b) keep or drop
   `SU` suspensions as stories.
