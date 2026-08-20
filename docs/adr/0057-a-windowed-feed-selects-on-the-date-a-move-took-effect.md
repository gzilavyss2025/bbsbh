# ADR-0057 — A windowed feed selects on the date a move took effect

Status: accepted (2026-08-20)

## Context

The home slate's roster-move card (issue #772) shows "the last 48 hours" of
moves from all thirty clubs. A window needs a rule for which day a move belongs
to, and the wire hands out two dates for every row:

| Field | Means |
| --- | --- |
| `date` | The day the wire FILED the row. |
| `effectiveDate` | The day the move TOOK effect. Often absent. |

The rest of the app already picked one. `txnDate(t)` in
`src/api/rehab-policy.js` returns `effectiveDate || date`, and every consumer of
the transaction pipeline buckets by it — the team page's Transactions card, the
player career register, `groupIntoStories`. Nothing had to choose before now,
because none of those surfaces is a window: a club's card shows a season, so a
row lands on some day of it either way.

A 48-hour card is a window, so it has to choose. The choice is not free, because
**the endpoint filters on the other date**:

```
GET /api/v1/transactions?startDate=&endDate=   ← filters on `date`
groupIntoStories                               ← buckets by `effectiveDate || date`
```

Measured on a 30-day league-wide pull (2026-07-21 to 2026-08-20, 8,211 rows):
**111 rows carry an `effectiveDate` different from their `date`**, and the skew
runs both ways — from 29 days early to 24 days late. The two dates disagree
about which day a move belongs to on about 1.4% of rows, so a window built on
one of them does not match a fetch built on the other.

## Decision

**The window selects on `txnDate` — the day the move took effect.** The filed
date is what the fetch is written in, never what the card is.

Two things follow, and both are load-bearing.

**1. The fetch reaches further back than the window, and the result is trimmed
afterwards.** A move effective today can have been filed days ago, so asking the
endpoint for the two days the card shows does not find it. Backtested over 22
consecutive 48-hour windows against an unbounded-back reference, a **four-day
fetch** is the narrowest that misses nothing:

| Fetch width | Windows complete | Stories missed |
| --- | --- | --- |
| 2 days | 18 / 22 | 12 |
| 3 days | 21 / 22 | 1 |
| **4 days** | **22 / 22** | **0** |

`FETCH_DAYS = 4` and `WINDOW_DAYS = 2` are both in
`src/api/transactions/leagueFeed.js`, beside the arithmetic that uses them.
Re-run `.scratch/home-transactions/probe-card-shape.mjs` (Q6) to re-measure.

**2. A move filed inside the window but backdated outside it does not appear.**
"Colorado Rockies placed C Hunter Goodman on the 10-day injured list retroactive
to August 15" is news on the 19th and belongs to the 15th. The card does not
show it. Measured over the same 22 windows: **102 rows**, about **4.6 per 48
hours**, of which **79 say "retroactive"**. By type they are `SC` 79, `OPT` 10,
`ASG` 9, `ACQ` 2, `CU` 2 — nearly all injured-list placements.

## The alternative, and why it loses

Selecting on the filed date makes the fetch exactly the window and drops
nothing. It costs two things instead, and both are worse.

**The card would print a dateline the move did not happen on.** A placement
retroactive to August 15, shown under "Wednesday, August 20" in a card headed
"Last 48 hours", is not late news — it is a wrong date. The reader cannot tell
it apart from a move made that morning.

**The same move would sit on two different days in one app.** The club's own
Transactions card buckets by `txnDate`, so it files that placement under August
15. Two surfaces reading one pipeline would disagree about when a thing
happened, and the pipeline would have to grow a second date rule to let them.
One rule for which day a move belongs to is worth more than 4.6 rows per window.

The omission is also not a hole in the app. **Every dropped row is still on its
own club's Transactions card**, under the day it took effect, reached from the
row's own club link. The card is a summary of a window, not the record.

## Consequences

- **The window and the fetch are different widths, permanently.** Anyone
  narrowing the fetch to "just the window" re-introduces the 12 stories a 2-day
  fetch missed. The constants say so where they are defined, and
  `test/home-transactions.test.js` pins both directions: a row filed before the
  window and effective inside it is kept; a row filed inside it and effective
  before it is dropped.
- **The card is today-only, for the same reason.** The four-day result holds for
  a window that ends today. `GameSelect.jsx` mounts the card only when the slate
  shows today, which ADR-0056's URL-carried day makes a plain check.
- **A skew wider than four days would be missed silently.** The pull found one
  row at −29 days. It is effective a month before it was filed, which no 48-hour
  card should show anyway — but if the wire's filing habits change, this is the
  number to re-measure rather than assume.
- **Nothing here touches the spoiler rule.** A roster move, its club and its
  date carry no score, on either date (`leagueFeed.js` is classified
  `spoiler-free` in `src/api/spoiler-manifest.json`).
