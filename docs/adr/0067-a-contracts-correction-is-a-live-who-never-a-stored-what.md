# A contracts correction is a live WHO, never a stored WHAT

PR3 ships the admin workbench a reviewer uses against the crosswalk ADR-0066
built: `/admin/contracts` groups the `exact`/`fuzzy`/`ambiguous`/`unresolved`
rows and lets a human confirm or correct the `mlbId` on any of them. This ADR
records the decisions that shape, from there, how a correction reaches a
reader, what the stored override may and may not hold, how a public surface
should trust the result, and two decisions inside the workbench itself.

## The override says who, not what

A correction propagates live, not on the next rebuild. Contract terms live in
static, `rowKey`-keyed chunks under `public/data/contracts-history/terms/`,
and `src/api/contractsHistory.js` joins a row's terms to its identity itself
at read time. That split means an admin's override only ever has to say WHO a
row belongs to — it never has to restate the row's terms — and the correction
reaches a reader inside the override map's own 60-second cache, with no
regeneration step in between. This is the same instant-write,
live-read-through shape `src/copy/` and `api/identity.js` already use: write
once, cache briefly, never rebuild.

**Terms did not go into the override record.** No Vercel function in this
repo reads a file from disk. Putting the first such read on a write path,
inside `api/contract-identity.js`'s closed-shape validator, was the wrong
trade for what it would have bought: the validator's whole job is to reject
an out-of-set value outright, and a disk read on that path adds a new failure
mode to every write for a field the override never needed to carry.

## Public surfaces trust exact and fuzzy alike

An `ambiguous` or `unresolved` row carries `mlbId: null` (ADR-0066), so a
public surface has nothing to gate on either tier — there is no id to trust
or withhold. A human who confirms a `fuzzy` row promotes its `confidence` to
`exact` while leaving `originalConfidence` as `'fuzzy'`. The matcher's own
verdict is never overwritten, only signed off on: a reader that only wants
"human-confirmed and machine-confirmed alike" reads `confidence`; a reader
that wants to know how the id was actually found still can.

## No attribution, anywhere

Gary owns this data. `SourceLine.jsx` exists to satisfy a reuse-permission
term that does not apply here, so the correct implementation is an omission,
not a rewrite: the component already renders nothing when `meta.source` is
unset, and no contracts surface ever sets it.

## Team-keyed ledgers are deliberately absent

`salaries.csv` carries no club column, and all 27,349 salary rows resolve
with `rawTeamCode: null`. Inferring a club from a season roster would mis-file
anyone traded mid-year — a real fraction of any season's rows, not an edge
case. That call belongs with issue #928, which owns where this data renders
and, with it, whether a club-scoped view is worth the roster-inference risk
at all.

## The review page routes by what a row holds, not by which tab is open

A pending row lands in one of three decision modes, chosen from the row's own
shape, not from which tab the reviewer has open. All 1,036 `fuzzy` rows carry
an already-assigned `mlbId` and an EMPTY `candidates` array, so there is no
shortlist to rank for any of them — a single reviewing pane with a filter
would have rendered an empty candidate list on every one of the 1,036. They
get a confirm pane instead. The 775 rows that do carry candidates get the
ranked list; the 40 rows with neither get a cold search.

## The group key includes confidence

Grouping keys on `sourceFile|confidence|rawName`, not `sourceFile|rawName`,
because the same name can resolve at two different confidence tiers across
its rows — folding those into one group would hide the split a reviewer
needs to see. Bulk confirm is withheld on the six groups whose rows the
matcher assigned to different players; those groups show the differing ids
instead of a single confirm action. Bulk confirm stays available on the 133
groups whose candidate lists merely differ row to row: each row was matched
against its own season's roster, so a differing candidate list reflects a
differing roster, not a differing person.
