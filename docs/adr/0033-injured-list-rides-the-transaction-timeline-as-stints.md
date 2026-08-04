# The injured list rides the transaction timeline as stints, not rows

The player page's career transaction ledger (`transactionTimelineView` in
`src/api/person.js`, rendered by `components/TransactionTimeline.jsx`) curates
the raw `/transactions` feed down through a `TXN_TYPES` whitelist. That
whitelist dropped Status Change (`SC`) entirely, which meant it dropped the
injured list. An audit against fifteen live careers put the total drop rate at
73% of raw rows, and the single largest dropped bucket — 195 of 521 rows — was
the IL.

## Why the omission was wrong

The rows it cost were not noise. Gerrit Cole's ledger was **empty** from 2023
through 2026 — the two Tommy John years and the rehab back from them, the
defining stretch of his career. Aaron Judge's stopped at his December 2022
re-signing, four years of blank page. Shohei Ohtani got two rows across
2023–2026, neither of them the September 2023 UCL tear that ended his Angels
tenure and set up the free agency the other two rows describe.

It was also the one omission the app contradicted itself on, in three places
that all read the same feed and all decided the IL was worth showing:

- `PlayerPage.jsx` renders an "Injured List · 60-Day" banner at the top of the
  very page whose timeline was silent about it;
- `careerRegisterView`'s gap note reads IL placements to label a blank season
  "Injured — missed season";
- `teamTransactions.js` keeps IL rows explicitly — `injured-list` is a
  first-class story type on the Team Page with its own `IL-N` banner.

So the Team Page told you a player went on the IL and his own page didn't.
That is drift, not an editorial line.

Spoiler footing is unchanged and needs no exception. An IL row carries a date,
a club and an injury ("Right elbow inflammation.") — never game state — and
`transactionTimelineView`'s existing `endDate` cutoff already drops anything
after the page's spoiler cap, so a game-scoped view cannot see a placement that
has not happened yet. No `SealBox`, no ADR-0019-style carve-out.

## Why the fix is stints, not "delete the filter"

Admitting the raw rows would have been the obvious move and it is wrong. The
feed spreads one stay on the list across three to a dozen rows: a placement,
sometimes a duplicate the same day at a different day count (Ohtani is placed
on both a 10-day and a 15-day list on 2023-09-16), an optional transfer to the
60-day list, one rehab row per affiliate visited (Cole's 2026 stint emits ten
across four clubs), and an activation.

Measured on the same fifteen careers, admitting them raw put IL rows in three
or more of the five collapsed slots for ten of the fifteen players, and five of
five for four of them. That fixes the Cole problem by creating the Judge
problem: the ledger stops being a career record and becomes an injury log for
exactly the players most likely to be looked up.

`injuredListStints` folds the feed into one entry per stay instead — roughly
3.5:1 — and the entry carries more than any raw row did: a day count, a reason,
the rehab stops, and the span. The pairing is not new machinery; the same
placement→closer logic already sat under `detectInjuredList`. This is a
granularity change to an existing derivation.

Two rules in it are load-bearing and should not be "simplified":

- **A placement while a stint is open is an escalation, not a second stint.**
  MLB writes the 10-day → 60-day move as a fresh "placed" as often as a
  "transferred" (Judge's 2026 rib fracture is the placed form). Splitting on it
  produced two rows for one absence, the first showing no return at all. The
  merge is bounded by season so a genuinely missed closer cannot fuse two years.
- **An unclosed stint gets no span.** A naive placement→next-closer pairing
  reported 693 days out for Betts's 2024 hand fracture while this was being
  written. A fabricated number is worse than no number.

The card's collapse stretches to the first roster move (bounded by
`VISIBLE_CEILING`, worst observed case seven rows) rather than truncating at
five, so a tenured star with a run of IL stints on top still previews the trade
or signing underneath — in strict reverse-chronological order, never reordered.

## What stays out, deliberately

The paternity, bereavement, family-medical and restricted lists are **not** an
oversight for a later pass to complete. They are a player's private life rather
than roster strategy — a newborn, a death in the family, a sick child — and this
app has no editorial hand to render them with the care a staffed newsroom can.
MLB.com and CBS publish them; that is not a reason for a solo-maintained scoring
tool to. The information cost is a couple of dozen rows across a career and the
downside is not symmetric.

Number changes, bare activations, roster-status rows, spring reassignments and
All-Star/WBC parking still drop as before — those genuinely are noise, and the
audit confirmed it row by row.

## What other sites do

Two patterns exist and neither is silent omission. Live-ops surfaces (MLB.com's
own transactions page, FanGraphs RosterResource's tracker, CBS) interleave IL
moves as peer transactions alongside trades and options. Reference archives
(Baseball-Reference, Baseball Prospectus's Injured List Ledger) split them into
a separate stint-shaped log. bbsbh is closer to a reference archive but has one
scrolling player page rather than room for a second tool, so it takes the split
pattern's information model — stints with days missed — inside the interleaved
pattern's single-timeline layout.
